"""
sentry.models.dsymfile
~~~~~~~~~~~~~~~~~~~~~~

:copyright: (c) 2010-2016 by the Sentry Team, see AUTHORS for more details.
:license: BSD, see LICENSE for more details.
"""

from __future__ import absolute_import

import re
import os
import six
import uuid
import time
import errno
import shutil
import hashlib
import logging
import tempfile
from requests.exceptions import RequestException

from jsonfield import JSONField
from django.db import models, transaction, IntegrityError
from django.utils import timezone
from django.utils.translation import ugettext_lazy as _

from symbolic import FatObject, SymbolicError, ObjectErrorUnsupportedObject, \
    SYMCACHE_LATEST_VERSION, SymCache, SymCacheErrorMissingDebugInfo, \
    SymCacheErrorMissingDebugSection

from sentry import options
from sentry.cache import default_cache
from sentry.db.models import FlexibleForeignKey, Model, \
    sane_repr, BaseManager, BoundedPositiveIntegerField
from sentry.models.file import File, ChunkFileState
from sentry.utils.zip import safe_extract_zip
from sentry.constants import KNOWN_DSYM_TYPES
from sentry.reprocessing import resolve_processing_issue, \
    bump_reprocessing_revision


logger = logging.getLogger(__name__)

ONE_DAY = 60 * 60 * 24
ONE_DAY_AND_A_HALF = int(ONE_DAY * 1.5)

# How long we cache a conversion failure by checksum in cache.  Currently
# 10 minutes is assumed to be a reasonable value here.
CONVERSION_ERROR_TTL = 60 * 10

DSYM_MIMETYPES = dict((v, k) for k, v in KNOWN_DSYM_TYPES.items())

_proguard_file_re = re.compile(r'/proguard/(?:mapping-)?(.*?)\.txt$')


def _get_idempotency_id(project, checksum):
    """For some operations an idempotency ID is needed."""
    return hashlib.sha1(b'%s|%s|project.dsym' % (
        str(project.id).encode('ascii'),
        checksum.encode('ascii'),
    )).hexdigest()


def get_assemble_status(project, checksum):
    """For a given file it checks what the current status of the assembling is.
    Returns a tuple in the form ``(status, details)`` where details is either
    `None` or a string identifying an error condition or notice.
    """
    cache_key = 'assemble-status:%s' % _get_idempotency_id(
        project, checksum)
    rv = default_cache.get(cache_key)
    if rv is None:
        return None, None
    return tuple(rv)


def set_assemble_status(project, checksum, state, detail=None):
    cache_key = 'assemble-status:%s' % _get_idempotency_id(
        project, checksum)

    # If the state is okay we actually clear it from the cache because in
    # that case a project dsym file was created.
    if state == ChunkFileState.OK:
        default_cache.delete(cache_key)
    else:
        default_cache.set(cache_key, (state, detail), 300)


class BadDif(Exception):
    pass


class VersionDSymFile(Model):
    __core__ = False

    objects = BaseManager()
    dsym_file = FlexibleForeignKey('sentry.ProjectDSymFile', null=True)
    dsym_app = FlexibleForeignKey('sentry.DSymApp')
    version = models.CharField(max_length=32)
    build = models.CharField(max_length=32, null=True)
    date_added = models.DateTimeField(default=timezone.now)

    class Meta:
        app_label = 'sentry'
        db_table = 'sentry_versiondsymfile'
        unique_together = (('dsym_file', 'version', 'build'), )


# TODO(dcramer): pull in enum library
class DSymPlatform(object):
    GENERIC = 0
    APPLE = 1
    ANDROID = 2


DSYM_PLATFORMS = {
    'generic': DSymPlatform.GENERIC,
    'apple': DSymPlatform.APPLE,
    'android': DSymPlatform.ANDROID,
}
DSYM_PLATFORMS_REVERSE = dict((v, k) for (k, v) in six.iteritems(DSYM_PLATFORMS))


def _auto_enrich_data(data, app_id, platform):
    # If we don't have an icon URL we can try to fetch one from iTunes
    if 'icon_url' not in data and platform == DSymPlatform.APPLE:
        from sentry.http import safe_urlopen
        try:
            rv = safe_urlopen(
                'https://itunes.apple.com/lookup', params={
                    'bundleId': app_id,
                }
            )
        except RequestException:
            pass
        else:
            if rv.ok:
                rv = rv.json()
                if rv.get('results'):
                    data['icon_url'] = rv['results'][0]['artworkUrl512']


class DSymAppManager(BaseManager):
    def create_or_update_app(
        self, sync_id, app_id, project, data=None, platform=DSymPlatform.GENERIC,
        no_fetch=False
    ):
        if data is None:
            data = {}
        if not no_fetch:
            _auto_enrich_data(data, app_id, platform)
        existing_app = DSymApp.objects.filter(app_id=app_id, project=project).first()
        if existing_app is not None:
            now = timezone.now()
            existing_app.update(
                sync_id=sync_id,
                data=data,
                last_synced=now,
            )
            return existing_app

        return BaseManager.create(
            self, sync_id=sync_id, app_id=app_id, data=data, project=project, platform=platform
        )


class DSymApp(Model):
    __core__ = False

    objects = DSymAppManager()
    project = FlexibleForeignKey('sentry.Project')
    app_id = models.CharField(max_length=64)
    sync_id = models.CharField(max_length=64, null=True)
    data = JSONField()
    platform = BoundedPositiveIntegerField(
        default=0,
        choices=(
            (DSymPlatform.GENERIC, _('Generic')), (DSymPlatform.APPLE, _('Apple')),
            (DSymPlatform.ANDROID, _('Android')),
        )
    )
    last_synced = models.DateTimeField(default=timezone.now)
    date_added = models.DateTimeField(default=timezone.now)

    class Meta:
        app_label = 'sentry'
        db_table = 'sentry_dsymapp'
        unique_together = (('project', 'platform', 'app_id'), )


class ProjectDSymFileManager(BaseManager):
    def find_missing(self, checksums, project):
        if not checksums:
            return []

        checksums = [x.lower() for x in checksums]
        missing = set(checksums)

        found = ProjectDSymFile.objects.filter(
            file__checksum__in=checksums, project=project
        ).values('file__checksum')

        for values in found:
            missing.discard(values.values()[0])

        return sorted(missing)

    def find_by_checksums(self, checksums, project):
        if not checksums:
            return []
        checksums = [x.lower() for x in checksums]
        return ProjectDSymFile.objects.filter(file__checksum__in=checksums, project=project)


class ProjectDSymFile(Model):
    __core__ = False

    file = FlexibleForeignKey('sentry.File')
    object_name = models.TextField()
    cpu_name = models.CharField(max_length=40)
    project = FlexibleForeignKey('sentry.Project', null=True)
    debug_id = models.CharField(max_length=64, db_column='uuid')
    objects = ProjectDSymFileManager()

    class Meta:
        unique_together = (('project', 'debug_id'), )
        db_table = 'sentry_projectdsymfile'
        app_label = 'sentry'

    __repr__ = sane_repr('object_name', 'cpu_name', 'debug_id')

    @property
    def dsym_type(self):
        ct = self.file.headers.get('Content-Type', 'unknown').lower()
        return KNOWN_DSYM_TYPES.get(ct, 'unknown')

    @property
    def supports_symcache(self):
        return self.dsym_type in ('breakpad', 'macho', 'elf')

    def delete(self, *args, **kwargs):
        super(ProjectDSymFile, self).delete(*args, **kwargs)
        self.file.delete()


class ProjectSymCacheFile(Model):
    __core__ = False

    project = FlexibleForeignKey('sentry.Project', null=True)
    cache_file = FlexibleForeignKey('sentry.File')
    dsym_file = FlexibleForeignKey('sentry.ProjectDSymFile')
    checksum = models.CharField(max_length=40)
    version = BoundedPositiveIntegerField()

    class Meta:
        unique_together = (('project', 'dsym_file'),)
        db_table = 'sentry_projectsymcachefile'
        app_label = 'sentry'

    __repr__ = sane_repr('debug_id')

    def delete(self, *args, **kwargs):
        super(ProjectSymCacheFile, self).delete(*args, **kwargs)
        self.cache_file.delete()


def create_dsym_from_id(project, dsym_type, cpu_name, debug_id,
                        basename, fileobj=None, file=None):
    """This creates a mach dsym file or proguard mapping from the given
    debug id and open file object to a dsym file.  This will not verify the
    debug id (intentionally so).  Use `create_files_from_dsym_zip` for doing
    everything.
    """
    if dsym_type == 'proguard':
        object_name = 'proguard-mapping'
    elif dsym_type in ('macho', 'elf'):
        object_name = basename
    elif dsym_type == 'breakpad':
        object_name = basename[:-4] if basename.endswith('.sym') else basename
    else:
        raise TypeError('unknown dsym type %r' % (dsym_type, ))

    if file is None:
        assert fileobj is not None, 'missing file object'
        h = hashlib.sha1()
        while 1:
            chunk = fileobj.read(16384)
            if not chunk:
                break
            h.update(chunk)
        checksum = h.hexdigest()
        fileobj.seek(0, 0)

        try:
            rv = ProjectDSymFile.objects.get(debug_id=debug_id, project=project)
            if rv.file.checksum == checksum:
                return rv, False
        except ProjectDSymFile.DoesNotExist:
            pass
        else:
            # The checksum mismatches.  In this case we delete the old object
            # and perform a re-upload.
            rv.delete()

        file = File.objects.create(
            name=debug_id,
            type='project.dsym',
            headers={'Content-Type': DSYM_MIMETYPES[dsym_type]},
        )
        file.putfile(fileobj)
        try:
            with transaction.atomic():
                rv = ProjectDSymFile.objects.create(
                    file=file,
                    debug_id=debug_id,
                    cpu_name=cpu_name,
                    object_name=object_name,
                    project=project,
                )
        except IntegrityError:
            file.delete()
            rv = ProjectDSymFile.objects.get(debug_id=debug_id, project=project)
    else:
        try:
            rv = ProjectDSymFile.objects.get(debug_id=debug_id, project=project)
        except ProjectDSymFile.DoesNotExist:
            try:
                with transaction.atomic():
                    rv = ProjectDSymFile.objects.create(
                        file=file,
                        debug_id=debug_id,
                        cpu_name=cpu_name,
                        object_name=object_name,
                        project=project,
                    )
            except IntegrityError:
                rv = ProjectDSymFile.objects.get(debug_id=debug_id, project=project)
                rv.file.delete()
                rv.file = file
                rv.save()
        else:
            rv.file.delete()
            rv.file = file
            rv.save()
        rv.file.headers['Content-Type'] = DSYM_MIMETYPES[dsym_type]
        rv.file.save()

    resolve_processing_issue(
        project=project,
        scope='native',
        object='dsym:%s' % debug_id,
    )

    return rv, True


def _analyze_progard_filename(filename):
    match = _proguard_file_re.search(filename)
    if match is None:
        return None

    ident = match.group(1)

    try:
        return six.text_type(uuid.UUID(ident))
    except Exception:
        pass


def detect_dif_from_path(path):
    """This detects which kind of dif (Debug Information File) the path
    provided is. It returns an array since a FatObject can contain more than
    on dif.
    """
    # proguard files (proguard/UUID.txt) or
    # (proguard/mapping-UUID.txt).
    proguard_id = _analyze_progard_filename(path)
    if proguard_id is not None:
        return [('proguard', 'any', proguard_id, path)]

    # macho style debug symbols
    try:
        fo = FatObject.from_path(path)
    except ObjectErrorUnsupportedObject as e:
        raise BadDif("Unsupported debug information file: %s" % e)
    except SymbolicError as e:
        logger.warning('dsymfile.bad-fat-object', exc_info=True)
        raise BadDif("Invalid debug information file: %s" % e)
    else:
        objs = []
        for obj in fo.iter_objects():
            objs.append((obj.kind, obj.arch, obj.id, path))
        return objs


def create_dsym_from_dif(to_create, project, overwrite_filename=None):
    """Create a ProjectDSymFile from a dif (Debug Information File) and
    return an array of created objects.
    """
    rv = []
    for dsym_type, cpu, file_id, filename in to_create:
        with open(filename, 'rb') as f:
            result_filename = os.path.basename(filename)
            if overwrite_filename is not None:
                result_filename = overwrite_filename
            dsym, created = create_dsym_from_id(
                project, dsym_type, cpu, file_id, result_filename,
                fileobj=f
            )
            if created:
                rv.append(dsym)
    return rv


def create_files_from_dsym_zip(fileobj, project,
                               update_symcaches=True):
    """Creates all missing dsym files from the given zip file.  This
    returns a list of all files created.
    """
    scratchpad = tempfile.mkdtemp()
    try:
        safe_extract_zip(fileobj, scratchpad, strip_toplevel=False)
        to_create = []

        for dirpath, dirnames, filenames in os.walk(scratchpad):
            for fn in filenames:
                fn = os.path.join(dirpath, fn)
                try:
                    difs = detect_dif_from_path(fn)
                except BadDif:
                    difs = None

                if difs is None:
                    difs = []
                to_create = to_create + difs

        rv = create_dsym_from_dif(to_create, project)

        # By default we trigger the symcache generation on upload to avoid
        # some obvious dogpiling.
        if update_symcaches:
            from sentry.tasks.symcache_update import symcache_update
            ids_to_update = [six.text_type(dif.debug_id) for dif in rv
                             if dif.supports_symcache]
            if ids_to_update:
                symcache_update.delay(project_id=project.id,
                                      debug_ids=ids_to_update)

        # Uploading new dsysm changes the reprocessing revision
        bump_reprocessing_revision(project)

        return rv
    finally:
        shutil.rmtree(scratchpad)


def find_dsym_file(project, debug_id):
    """Finds a dsym file for the given debug id."""
    try:
        return ProjectDSymFile.objects \
            .filter(debug_id=debug_id.lower(), project=project) \
            .select_related('file') \
            .get()
    except ProjectDSymFile.DoesNotExist:
        pass


class DSymCache(object):
    @property
    def cache_path(self):
        return options.get('dsym.cache-path')

    def get_project_path(self, project):
        return os.path.join(self.cache_path, six.text_type(project.id))

    def update_symcaches(self, project, debug_ids):
        """Given some debug ids of dsyms this will update the symcaches for
        all of these if a symcache is supported for that symbol.
        """
        self._get_symcaches_impl(project, debug_ids)

    def get_symcaches(self, project, debug_ids, on_dsym_file_referenced=None,
                      with_conversion_errors=False):
        """Given some debug ids returns the symcaches loaded for these debug ids."""
        cachefiles, conversion_errors = self._get_symcaches_impl(
            project, debug_ids, on_dsym_file_referenced)
        symcaches = self._load_cachefiles_via_fs(project, cachefiles)
        if with_conversion_errors:
            return symcaches, dict((k, v) for k, v in conversion_errors.items())
        return symcaches

    def generate_symcache(self, project, debug_file, tf=None):
        """Generate a single symcache for a debug id based on the passed file
        contents.  If the tempfile is not passed then its opened again.
        """
        if not debug_file.supports_symcache:
            raise RuntimeError('This file type does not support symcaches')
        close_tf = False
        if tf is None:
            tf = debug_file.file.getfile(as_tempfile=True)
            close_tf = True
        else:
            tf.seek(0)
        try:
            return self._update_cachefile(debug_file, tf)
        finally:
            if close_tf:
                tf.close()

    def fetch_dsyms(self, project, debug_ids):
        """Given some ids returns an id to path mapping for where the
        debug symbol files are on the FS.
        """
        rv = {}
        for debug_id in debug_ids:
            debug_id = six.text_type(debug_id).lower()
            dsym_path = os.path.join(self.get_project_path(project), debug_id)

            try:
                os.stat(dsym_path)
            except OSError as e:
                if e.errno != errno.ENOENT:
                    raise
                debug_file = find_dsym_file(project, debug_id)
                if debug_file is None:
                    continue
                debug_file.file.save_to(dsym_path)
            rv[debug_id] = dsym_path

        return rv

    def _get_symcaches_impl(self, project, debug_ids, on_dsym_file_referenced=None):
        # Fetch dsym files first and invoke the callback if we need
        debug_ids = list(map(six.text_type, debug_ids))
        debug_files = [x for x in ProjectDSymFile.objects.filter(
            project=project,
            debug_id__in=debug_ids,
        ).select_related('file') if x.supports_symcache]
        if not debug_files:
            return {}, {}

        debug_files_by_id = {}
        for debug_file in debug_files:
            if on_dsym_file_referenced is not None:
                on_dsym_file_referenced(debug_file)
            debug_files_by_id[debug_file.debug_id] = debug_file

        # Now find all the cache files we already have.
        q = ProjectSymCacheFile.objects.filter(
            project=project,
            dsym_file_id__in=[x.id for x in debug_files],
        ).select_related('cache_file', 'dsym_file__debug_id')

        conversion_errors = {}
        cachefiles = []
        cachefiles_to_update = dict.fromkeys(x.debug_id for x in debug_files)
        for cache_file in q:
            debug_id = cache_file.dsym_file.debug_id
            debug_file = debug_files_by_id[debug_id]
            if cache_file.version == SYMCACHE_LATEST_VERSION and \
               cache_file.checksum == debug_file.file.checksum:
                cachefiles_to_update.pop(debug_id, None)
                cachefiles.append((debug_id, cache_file))
            else:
                cachefiles_to_update[debug_id] = \
                    (cache_file, debug_file)

        # if any cache files need to be updated, do that now.
        if cachefiles_to_update:
            to_update = []
            for debug_id, it in six.iteritems(cachefiles_to_update):
                if it is None:
                    debug_file = debug_files_by_id[debug_id]
                else:
                    cache_file, debug_file = it
                    cache_file.delete()
                to_update.append(debug_file)
            updated_cachefiles, conversion_errors = self._update_cachefiles(
                project, to_update)
            cachefiles.extend(updated_cachefiles)

        return cachefiles, conversion_errors

    def _update_cachefiles(self, project, debug_files):
        rv = []

        # Find all the known bad files we could not convert last time
        # around
        conversion_errors = {}
        for debug_file in debug_files:
            cache_key = 'scbe:%s:%s' % (debug_file.debug_id, debug_file.file.checksum)
            err = default_cache.get(cache_key)
            if err is not None:
                conversion_errors[debug_file.debug_id] = err

        for debug_file in debug_files:
            dsym_id = debug_file.debug_id
            if dsym_id in conversion_errors:
                continue

            with debug_file.file.getfile(as_tempfile=True) as tf:
                symcache_file, conversion_error = self._update_cachefile(
                    debug_file, tf)
            if symcache_file is not None:
                rv.append((dsym_id, symcache_file))
            elif conversion_error is not None:
                conversion_errors[dsym_id] = conversion_error

        return rv, conversion_errors

    def _update_cachefile(self, debug_file, tf):
        try:
            fo = FatObject.from_path(tf.name)
            o = fo.get_object(id=debug_file.debug_id)
            if o is None:
                return None, None
            symcache = o.make_symcache()
        except SymbolicError as e:
            default_cache.set('scbe:%s:%s' % (
                debug_file.debug_id, debug_file.file.checksum), e.message,
                CONVERSION_ERROR_TTL)

            if not isinstance(e, (SymCacheErrorMissingDebugSection, SymCacheErrorMissingDebugInfo)):
                logger.error('dsymfile.symcache-build-error',
                             exc_info=True, extra=dict(debug_id=debug_file.debug_id))

            return None, e.message

        # We seem to have this task running onconcurrently or some
        # other task might delete symcaches while this is running
        # which is why this requires a loop instead of just a retry
        # on get.
        for iteration in range(5):
            file = File.objects.create(
                name=debug_file.debug_id,
                type='project.symcache',
            )
            file.putfile(symcache.open_stream())
            try:
                with transaction.atomic():
                    return ProjectSymCacheFile.objects.get_or_create(
                        project=debug_file.project,
                        cache_file=file,
                        dsym_file=debug_file,
                        defaults=dict(
                            checksum=debug_file.file.checksum,
                            version=symcache.file_format_version,
                        )
                    )[0], None
            except IntegrityError:
                file.delete()
                try:
                    return ProjectSymCacheFile.objects.get(
                        project=debug_file.project,
                        dsym_file=debug_file,
                    ), None
                except ProjectSymCacheFile.DoesNotExist:
                    continue

        raise RuntimeError('Concurrency error on symcache update')

    def _load_cachefiles_via_fs(self, project, cachefiles):
        rv = {}
        base = self.get_project_path(project)
        for dsym_id, symcache_file in cachefiles:
            cachefile_path = os.path.join(base, dsym_id + '.symcache')
            try:
                stat = os.stat(cachefile_path)
            except OSError as e:
                if e.errno != errno.ENOENT:
                    raise
                symcache_file.cache_file.save_to(cachefile_path)
            else:
                self._try_bump_timestamp(cachefile_path, stat)
            rv[dsym_id] = SymCache.from_path(cachefile_path)
        return rv

    def _try_bump_timestamp(self, path, old_stat):
        now = int(time.time())
        if old_stat.st_ctime < now - ONE_DAY:
            os.utime(path, (now, now))

    def clear_old_entries(self):
        try:
            cache_folders = os.listdir(self.cache_path)
        except OSError:
            return

        cutoff = int(time.time()) - ONE_DAY_AND_A_HALF

        for cache_folder in cache_folders:
            cache_folder = os.path.join(self.cache_path, cache_folder)
            try:
                items = os.listdir(cache_folder)
            except OSError:
                continue
            for cached_file in items:
                cached_file = os.path.join(cache_folder, cached_file)
                try:
                    mtime = os.path.getmtime(cached_file)
                except OSError:
                    continue
                if mtime < cutoff:
                    try:
                        os.remove(cached_file)
                    except OSError:
                        pass


ProjectDSymFile.dsymcache = DSymCache()
