"""
sentry.models.debugfile
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
from django.db.models.fields.related import OneToOneRel
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
from sentry.constants import KNOWN_DIF_TYPES
from sentry.reprocessing import resolve_processing_issue, \
    bump_reprocessing_revision


logger = logging.getLogger(__name__)

ONE_DAY = 60 * 60 * 24
ONE_DAY_AND_A_HALF = int(ONE_DAY * 1.5)

# How long we cache a conversion failure by checksum in cache.  Currently
# 10 minutes is assumed to be a reasonable value here.
CONVERSION_ERROR_TTL = 60 * 10

DIF_MIMETYPES = dict((v, k) for k, v in KNOWN_DIF_TYPES.items())

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
    dsym_file = FlexibleForeignKey('sentry.ProjectDebugFile', null=True)
    dsym_app = FlexibleForeignKey('sentry.DSymApp')
    version = models.CharField(max_length=32)
    build = models.CharField(max_length=32, null=True)
    date_added = models.DateTimeField(default=timezone.now)

    class Meta:
        app_label = 'sentry'
        db_table = 'sentry_versiondsymfile'
        unique_together = (('dsym_file', 'version', 'build'), )


# TODO(dcramer): pull in enum library
class DifPlatform(object):
    GENERIC = 0
    APPLE = 1
    ANDROID = 2


DIF_PLATFORMS = {
    'generic': DifPlatform.GENERIC,
    'apple': DifPlatform.APPLE,
    'android': DifPlatform.ANDROID,
}
DIF_PLATFORMS_REVERSE = dict((v, k) for (k, v) in six.iteritems(DIF_PLATFORMS))


def _auto_enrich_data(data, app_id, platform):
    # If we don't have an icon URL we can try to fetch one from iTunes
    if 'icon_url' not in data and platform == DifPlatform.APPLE:
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
        self, sync_id, app_id, project, data=None, platform=DifPlatform.GENERIC,
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
            (DifPlatform.GENERIC, _('Generic')),
            (DifPlatform.APPLE, _('Apple')),
            (DifPlatform.ANDROID, _('Android')),
        )
    )
    last_synced = models.DateTimeField(default=timezone.now)
    date_added = models.DateTimeField(default=timezone.now)

    class Meta:
        app_label = 'sentry'
        db_table = 'sentry_dsymapp'
        unique_together = (('project', 'platform', 'app_id'), )


class ProjectDebugFileManager(BaseManager):
    def find_missing(self, checksums, project):
        if not checksums:
            return []

        checksums = [x.lower() for x in checksums]
        missing = set(checksums)

        found = ProjectDebugFile.objects.filter(
            file__checksum__in=checksums, project=project
        ).values('file__checksum')

        for values in found:
            missing.discard(values.values()[0])

        return sorted(missing)

    def find_by_checksums(self, checksums, project):
        if not checksums:
            return []
        checksums = [x.lower() for x in checksums]
        return ProjectDebugFile.objects.filter(file__checksum__in=checksums, project=project)

    def find_by_debug_ids(self, project, debug_ids, features=None):
        """Finds debug information files matching the given debug identifiers.

        If a set of features is specified, only files that satisfy all features
        will be returned. This does not apply to legacy debug files that were
        not tagged with features.

        Returns a dict of debug files keyed by their debug identifier.
        """
        features = frozenset(features) if features is not None else frozenset()

        difs = ProjectDebugFile.objects \
            .filter(project=project, debug_id__in=debug_ids) \
            .select_related('file') \
            .order_by('-id')

        difs_by_id = {}
        for dif in difs:
            difs_by_id.setdefault(dif.debug_id, []).append(dif)

        rv = {}
        for debug_id, group in six.iteritems(difs_by_id):
            with_features = [dif for dif in group if 'features' in (dif.data or ())]

            # In case we've never computed features for any of these files, we
            # just take the first one and assume that it matches.
            if not with_features:
                rv[debug_id] = group[0]
                continue

            # There's at least one file with computed features. Older files are
            # considered redundant and will be deleted. We search for the first
            # file matching the given feature set. This might not resolve if no
            # DIF matches the given feature set.
            for dif in with_features:
                if dif.features >= features:
                    rv[debug_id] = dif
                    break

        return rv


class ProjectDebugFile(Model):
    __core__ = False

    file = FlexibleForeignKey('sentry.File')
    object_name = models.TextField()
    cpu_name = models.CharField(max_length=40)
    project = FlexibleForeignKey('sentry.Project', null=True)
    debug_id = models.CharField(max_length=64, db_column='uuid')
    data = JSONField(null=True)
    objects = ProjectDebugFileManager()

    class Meta:
        index_together = (('project', 'debug_id'), )
        db_table = 'sentry_projectdsymfile'
        app_label = 'sentry'

    __repr__ = sane_repr('object_name', 'cpu_name', 'debug_id')

    @property
    def dif_type(self):
        ct = self.file.headers.get('Content-Type', 'unknown').lower()
        return KNOWN_DIF_TYPES.get(ct, 'unknown')

    @property
    def file_extension(self):
        if self.dif_type == 'breakpad':
            return '.sym'
        if self.dif_type == 'macho':
            return '.dSYM'
        if self.dif_type == 'proguard':
            return '.txt'
        if self.dif_type == 'elf':
            return '.debug'

        return ''

    @property
    def features(self):
        return frozenset((self.data or {}).get('features', []))

    @property
    def supports_symcache(self):
        if self.data is None:
            return self.dif_type in ('breakpad', 'macho', 'elf')
        else:
            return 'debug' in self.features

    def delete(self, *args, **kwargs):
        symcache = self.projectsymcachefile.select_related('cache_file').first()
        if symcache is not None:
            symcache.delete()

        super(ProjectDebugFile, self).delete(*args, **kwargs)
        self.file.delete()


class ProjectSymCacheFile(Model):
    __core__ = False

    project = FlexibleForeignKey('sentry.Project', null=True)
    cache_file = FlexibleForeignKey('sentry.File')
    dsym_file = FlexibleForeignKey('sentry.ProjectDebugFile', rel_class=OneToOneRel)
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


def clean_redundant_difs(project, debug_id):
    """Deletes redundant debug files from the database and file storage. A debug
    file is considered redundant if there is a newer file with the same debug
    identifier and the same or a superset of its features.
    """
    difs = ProjectDebugFile.objects \
        .filter(project=project, debug_id=debug_id) \
        .select_related('file') \
        .order_by('-id')

    all_features = set()
    for i, dif in enumerate(difs):
        # We always keep the latest file. If it has no features, likely the
        # previous files did not have features either and will be removed, or we
        # keep both. Subsequent uploads will remove this file later.
        if i > 0 and dif.features <= all_features:
            dif.delete()
        else:
            all_features.update(dif.features)


def create_dif_from_id(project, dif_type, cpu_name, debug_id, data,
                       basename, fileobj=None, file=None):
    """This creates a mach dsym file or proguard mapping from the given
    debug id and open file object to a debug file.  This will not verify the
    debug id (intentionally so).  Use `create_files_from_dif_zip` for doing
    everything.
    """
    if dif_type == 'proguard':
        object_name = 'proguard-mapping'
    elif dif_type in ('macho', 'elf'):
        object_name = basename
    elif dif_type == 'breakpad':
        object_name = basename[:-4] if basename.endswith('.sym') else basename
    else:
        raise TypeError('unknown dif type %r' % (dif_type, ))

    if file is not None:
        checksum = file.checksum
    elif fileobj is not None:
        h = hashlib.sha1()
        while 1:
            chunk = fileobj.read(16384)
            if not chunk:
                break
            h.update(chunk)
        checksum = h.hexdigest()
        fileobj.seek(0, 0)
    else:
        raise RuntimeError('missing file object')

    dif = ProjectDebugFile.objects \
        .select_related('file') \
        .filter(project=project, debug_id=debug_id, file__checksum=checksum, data__isnull=False) \
        .order_by('-id') \
        .first()

    if dif is not None:
        return dif, False

    if file is None:
        file = File.objects.create(
            name=debug_id,
            type='project.dif',
            headers={'Content-Type': DIF_MIMETYPES[dif_type]},
        )
        file.putfile(fileobj)
    else:
        file.type = 'project.dif'
        file.headers['Content-Type'] = DIF_MIMETYPES[dif_type]
        file.save()

    dif = ProjectDebugFile.objects.create(
        file=file,
        debug_id=debug_id,
        cpu_name=cpu_name,
        object_name=object_name,
        project=project,
        data=data,
    )

    # The DIF we've just created might actually be removed here again. But since
    # this can happen at any time in near or distant future, we don't care and
    # assume a successful upload. The DIF will be reported to the uploader and
    # reprocessing can start.
    clean_redundant_difs(project, debug_id)

    resolve_processing_issue(
        project=project,
        scope='native',
        object='dsym:%s' % debug_id,
    )

    return dif, True


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
        data = {'features': ['mapping']}
        return [(
            'proguard',   # dif type
            'any',        # architecture
            proguard_id,  # debug_id
            path,         # basepath
            data,         # extra data
        )]

    # native debug information files (MachO, ELF or Breakpad)
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
            data = {
                'type': obj.type,
                'features': list(obj.features),
            }
            objs.append((obj.kind, obj.arch, obj.id, path, data))
        return objs


def create_debug_file_from_dif(to_create, project, overwrite_filename=None):
    """Create a ProjectDebugFile from a dif (Debug Information File) and
    return an array of created objects.
    """
    rv = []
    for dif_type, cpu, debug_id, filename, data in to_create:
        with open(filename, 'rb') as f:
            result_filename = os.path.basename(filename)
            if overwrite_filename is not None:
                result_filename = overwrite_filename
            dif, created = create_dif_from_id(
                project, dif_type, cpu, debug_id, data,
                result_filename, fileobj=f
            )
            if created:
                rv.append(dif)
    return rv


def create_files_from_dif_zip(fileobj, project, update_symcaches=True):
    """Creates all missing debug files from the given zip file.  This
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

        rv = create_debug_file_from_dif(to_create, project)

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


class DIFCache(object):
    @property
    def cache_path(self):
        return options.get('dsym.cache-path')

    def get_project_path(self, project):
        return os.path.join(self.cache_path, six.text_type(project.id))

    def update_symcaches(self, project, debug_ids):
        """Given some debug ids of DIFs this will update the symcaches for
        all of these if a symcache is supported for that symbol.
        """
        self._get_symcaches_impl(project, debug_ids)

    def get_symcaches(self, project, debug_ids, on_dif_referenced=None,
                      with_conversion_errors=False):
        """Given some debug ids returns the symcaches loaded for these debug ids.
        """
        cachefiles, conversion_errors = self._get_symcaches_impl(
            project, debug_ids, on_dif_referenced)
        symcaches = self._load_cachefiles_via_fs(project, cachefiles)
        if with_conversion_errors:
            return symcaches, dict((k, v) for k, v in conversion_errors.items())
        return symcaches

    def generate_symcache(self, project, debug_file, fileobj=None):
        """Generate a single symcache for a debug id based on the passed file
        contents.  If the tempfile is not passed then its opened again.
        """
        if not debug_file.supports_symcache:
            raise RuntimeError('This file type does not support symcaches')

        if fileobj is None:
            fileobj = debug_file.file.getfile(as_tempfile=True)
            close_fileobj = True
        else:
            fileobj.seek(0)
            close_fileobj = False

        try:
            return self._update_cachefile(debug_file, fileobj)
        finally:
            if close_fileobj:
                fileobj.close()

    def fetch_difs(self, project, debug_ids, features=None):
        """Given some ids returns an id to path mapping for where the
        debug symbol files are on the FS.
        """
        debug_ids = [six.text_type(debug_id).lower() for debug_id in debug_ids]
        difs = ProjectDebugFile.objects.find_by_debug_ids(project, debug_ids, features)

        rv = {}
        for debug_id, dif in six.iteritems(difs):
            dif_path = os.path.join(self.get_project_path(project), debug_id)
            try:
                os.stat(dif_path)
            except OSError as e:
                if e.errno != errno.ENOENT:
                    raise
                dif.file.save_to(dif_path)
            rv[debug_id] = dif_path

        return rv

    def _get_symcaches_impl(self, project, debug_ids, on_dif_referenced=None):
        # Fetch debug files first and invoke the callback if we need
        debug_ids = [six.text_type(debug_id).lower() for debug_id in debug_ids]
        debug_files = ProjectDebugFile.objects.find_by_debug_ids(
            project, debug_ids, features=['debug'])

        # Notify the caller that we have used a symbol file
        if on_dif_referenced is not None:
            for debug_file in six.itervalues(debug_files):
                on_dif_referenced(debug_file)

        # Now find all the cache files we already have
        found_ids = [d.id for d in six.itervalues(debug_files)]
        existing_caches = ProjectSymCacheFile.objects \
            .filter(project=project, dsym_file_id__in=found_ids) \
            .select_related('cache_file', 'dsym_file__debug_id')

        # Check for missing and out-of-date cache files. Outdated files are
        # removed to be re-created immediately.
        caches = []
        to_update = debug_files.copy()
        for cache_file in existing_caches:
            if cache_file.version == SYMCACHE_LATEST_VERSION:
                debug_id = cache_file.dsym_file.debug_id
                to_update.pop(debug_id, None)
                caches.append((debug_id, cache_file, None))
            else:
                cache_file.delete()

        # If any cache files need to be updated, do that now
        if to_update:
            updated_cachefiles, conversion_errors = self._update_cachefiles(
                project, to_update.values())
            caches.extend(updated_cachefiles)
        else:
            conversion_errors = {}

        return caches, conversion_errors

    def _update_cachefiles(self, project, debug_files):
        rv = []
        conversion_errors = {}

        for debug_file in debug_files:
            debug_id = debug_file.debug_id

            # Find all the known bad files we could not convert last time. We
            # use the debug identifier and file checksum to identify the source
            # DIF for historic reasons (debug_file.id would do, too).
            cache_key = 'scbe:%s:%s' % (debug_id, debug_file.file.checksum)
            err = default_cache.get(cache_key)
            if err is not None:
                conversion_errors[debug_id] = err
                continue

            # Download the original debug symbol and convert the object file to
            # a symcache. This can either yield a symcache, an error or none of
            # the above. THE FILE DOWNLOAD CAN TAKE SIGNIFICANT TIME.
            with debug_file.file.getfile(as_tempfile=True) as tf:
                file, cache, err = self._update_cachefile(debug_file, tf)

            # Store this conversion error so that we can skip subsequent
            # conversions. There might be concurrent conversions running for the
            # same debug file, however.
            if err is not None:
                default_cache.set(cache_key, err, CONVERSION_ERROR_TTL)
                conversion_errors[debug_id] = err
                continue

            if file is not None or cache is not None:
                rv.append((debug_id, file, cache))

        return rv, conversion_errors

    def _update_cachefile(self, debug_file, fileobj):
        debug_id = debug_file.debug_id

        # Locate the object inside the FatObject. Since we have keyed debug
        # files by debug_id, we expect a corresponding object. Otherwise, we
        # fail silently, just like with missing symbols.
        try:
            fo = FatObject.from_path(fileobj.name)
            o = fo.get_object(id=debug_id)
            if o is None:
                return None, None, None
            symcache = o.make_symcache()
        except SymbolicError as e:
            if not isinstance(e, (SymCacheErrorMissingDebugSection, SymCacheErrorMissingDebugInfo)):
                logger.error('dsymfile.symcache-build-error',
                             exc_info=True, extra=dict(debug_id=debug_id))

            return None, None, e.message

        file = File.objects.create(name=debug_id, type='project.symcache')
        file.putfile(symcache.open_stream())

        # Try to insert the new SymCache into the database. This only fail if
        # (1) another process has concurrently added the same sym cache, or if
        # (2) the debug symbol was deleted, either due to a newer upload or via
        # the API.
        try:
            with transaction.atomic():
                return ProjectSymCacheFile.objects.create(
                    project=debug_file.project,
                    cache_file=file,
                    dsym_file=debug_file,
                    checksum=debug_file.file.checksum,
                    version=symcache.file_format_version,
                ), symcache, None
        except IntegrityError:
            file.delete()

        # Check for a concurrently inserted symcache and use that instead. This
        # could have happened (1) due to a concurrent insert, or (2) a new
        # upload that has already succeeded to compute a symcache. The latter
        # case is extremely unlikely.
        cache_file = ProjectSymCacheFile.objects \
            .filter(project=debug_file.project, dsym_file__debug_id=debug_id) \
            .select_related('cache_file') \
            .order_by('-id') \
            .first()

        if cache_file is not None:
            return cache_file, None, None

        # There was no new symcache, indicating that the debug file has been
        # replaced with a newer version. Another job will create the
        # corresponding symcache eventually. To prevent querying the database
        # another time, simply use the in-memory symcache for now:
        return None, symcache, None

    def _load_cachefiles_via_fs(self, project, cachefiles):
        rv = {}
        base = self.get_project_path(project)
        for debug_id, model, cache in cachefiles:
            # If we're given a cache instance, use that over accessing the file
            # system or potentially even blob storage.
            if cache is not None:
                rv[debug_id] = cache
                continue
            elif model is None:
                raise RuntimeError('missing symcache file to load from fs')

            # Try to locate a cached instance from the file system and bump the
            # timestamp to indicate it is still being used. Otherwise, download
            # from the blob store and place it in the cache folder.
            cachefile_name = '%s_%s.symcache' % (model.id, model.version)
            cachefile_path = os.path.join(base, cachefile_name)
            try:
                stat = os.stat(cachefile_path)
            except OSError as e:
                if e.errno != errno.ENOENT:
                    raise
                model.cache_file.save_to(cachefile_path)
            else:
                now = int(time.time())
                if stat.st_ctime < now - ONE_DAY:
                    os.utime(cachefile_path, (now, now))

            rv[debug_id] = SymCache.from_path(cachefile_path)
        return rv

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


ProjectDebugFile.difcache = DIFCache()
