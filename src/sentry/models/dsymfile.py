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

from symbolic import FatObject, SymbolicError, UnsupportedObjectFile, \
    SymCache, SYMCACHE_LATEST_VERSION

from sentry import options
from sentry.utils.cache import cache
from sentry.db.models import FlexibleForeignKey, Model, \
    sane_repr, BaseManager, BoundedPositiveIntegerField
from sentry.models.file import File
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
    uuid = models.CharField(max_length=36)
    objects = ProjectDSymFileManager()

    class Meta:
        unique_together = (('project', 'uuid'), )
        db_table = 'sentry_projectdsymfile'
        app_label = 'sentry'

    __repr__ = sane_repr('object_name', 'cpu_name', 'uuid')

    @property
    def dsym_type(self):
        ct = self.file.headers.get('Content-Type').lower()
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

    __repr__ = sane_repr('uuid')

    def delete(self, *args, **kwargs):
        super(ProjectSymCacheFile, self).delete(*args, **kwargs)
        self.cache_file.delete()


def _create_dsym_from_uuid(project, dsym_type, cpu_name, uuid, fileobj, basename):
    """This creates a mach dsym file or proguard mapping from the given
    uuid and open file object to a dsym file.  This will not verify the
    uuid (intentionally so).  Use `create_files_from_dsym_zip` for doing
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

    h = hashlib.sha1()
    while 1:
        chunk = fileobj.read(16384)
        if not chunk:
            break
        h.update(chunk)
    checksum = h.hexdigest()
    fileobj.seek(0, 0)

    try:
        rv = ProjectDSymFile.objects.get(uuid=uuid, project=project)
        if rv.file.checksum == checksum:
            return rv, False
    except ProjectDSymFile.DoesNotExist:
        pass
    else:
        # The checksum mismatches.  In this case we delete the old object
        # and perform a re-upload.
        rv.delete()

    file = File.objects.create(
        name=uuid,
        type='project.dsym',
        headers={'Content-Type': DSYM_MIMETYPES[dsym_type]},
    )
    file.putfile(fileobj)
    try:
        with transaction.atomic():
            rv = ProjectDSymFile.objects.create(
                file=file,
                uuid=uuid,
                cpu_name=cpu_name,
                object_name=object_name,
                project=project,
            )
    except IntegrityError:
        file.delete()
        rv = ProjectDSymFile.objects.get(uuid=uuid, project=project)

    resolve_processing_issue(
        project=project,
        scope='native',
        object='dsym:%s' % uuid,
    )

    return rv, True


def _analyze_progard_filename(filename):
    match = _proguard_file_re.search(filename)
    if match is None:
        return None

    ident = match.group(1)

    try:
        return uuid.UUID(ident)
    except Exception:
        pass


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

                # proguard files (proguard/UUID.txt) or
                # (proguard/mapping-UUID.txt).
                proguard_uuid = _analyze_progard_filename(fn)
                if proguard_uuid is not None:
                    to_create.append(('proguard', 'any', six.text_type(proguard_uuid), fn, ))
                    continue

                # macho style debug symbols
                try:
                    fo = FatObject.from_path(fn)
                except UnsupportedObjectFile:
                    pass
                except SymbolicError:
                    # Whatever was contained there, was probably not a
                    # macho file.
                    # XXX: log?
                    logger.warning('dsymfile.bad-fat-object', exc_info=True)
                else:
                    for obj in fo.iter_objects():
                        to_create.append((obj.kind, obj.arch,
                                          six.text_type(obj.uuid), fn))
                    continue

        rv = []
        for dsym_type, cpu, file_uuid, filename in to_create:
            with open(filename, 'rb') as f:
                dsym, created = _create_dsym_from_uuid(
                    project, dsym_type, cpu, file_uuid, f, os.path.basename(filename)
                )
                if created:
                    rv.append(dsym)

        # By default we trigger the symcache generation on upload to avoid
        # some obvious dogpiling.
        if update_symcaches:
            from sentry.tasks.symcache_update import symcache_update
            uuids_to_update = [six.text_type(x.uuid) for x in rv
                               if x.supports_symcache]
            if uuids_to_update:
                symcache_update.delay(project_id=project.id,
                                      uuids=uuids_to_update)

        # Uploading new dsysm changes the reprocessing revision
        bump_reprocessing_revision(project)

        return rv
    finally:
        shutil.rmtree(scratchpad)


def find_dsym_file(project, image_uuid):
    """Finds a dsym file for the given uuid."""
    image_uuid = image_uuid.lower()
    try:
        return ProjectDSymFile.objects.filter(
            uuid=image_uuid, project=project
        ).select_related('file').get()
    except ProjectDSymFile.DoesNotExist:
        pass


class DSymCache(object):
    @property
    def cache_path(self):
        return options.get('dsym.cache-path')

    def get_project_path(self, project):
        return os.path.join(self.cache_path, six.text_type(project.id))

    def update_symcaches(self, project, uuids):
        """Given some uuids of dsyms this will update the symcaches for
        all of these if a symcache is supported for that symbol.
        """
        self._get_symcaches_impl(project, uuids)

    def get_symcaches(self, project, uuids, on_dsym_file_referenced=None,
                      with_conversion_errors=False):
        """Given some uuids returns the symcaches loaded for these uuids."""
        cachefiles, conversion_errors = self._get_symcaches_impl(
            project, uuids, on_dsym_file_referenced)
        symcaches = self._load_cachefiles_via_fs(project, cachefiles)
        if with_conversion_errors:
            return symcaches, dict((uuid.UUID(k), v)
                                   for k, v in conversion_errors.items())
        return symcaches

    def fetch_dsyms(self, project, uuids):
        """Given some uuids returns a uuid to path mapping for where the
        debug symbol files are on the FS.
        """
        rv = {}
        for image_uuid in uuids:
            image_uuid = six.text_type(image_uuid).lower()
            dsym_path = os.path.join(self.get_project_path(project), image_uuid)

            try:
                os.stat(dsym_path)
            except OSError as e:
                if e.errno != errno.ENOENT:
                    raise
                dsym_file = find_dsym_file(project, image_uuid)
                if dsym_file is None:
                    continue
                dsym_file.file.save_to(dsym_path)
            rv[uuid.UUID(image_uuid)] = dsym_path

        return rv

    def _get_symcaches_impl(self, project, uuids, on_dsym_file_referenced=None):
        # Fetch dsym files first and invoke the callback if we need
        uuid_strings = list(map(six.text_type, uuids))
        dsym_files = [x for x in ProjectDSymFile.objects.filter(
            project=project,
            uuid__in=uuid_strings,
        ).select_related('file') if x.supports_symcache]
        if not dsym_files:
            return {}, {}

        dsym_files_by_uuid = {}
        for dsym_file in dsym_files:
            if on_dsym_file_referenced is not None:
                on_dsym_file_referenced(dsym_file)
            dsym_files_by_uuid[dsym_file.uuid] = dsym_file

        # Now find all the cache files we already have.
        q = ProjectSymCacheFile.objects.filter(
            project=project,
            dsym_file_id__in=[x.id for x in dsym_files],
        ).select_related('cache_file', 'dsym_file__uuid')

        conversion_errors = {}
        cachefiles = []
        cachefiles_to_update = dict.fromkeys(x.uuid for x in dsym_files)
        for cache_file in q:
            dsym_uuid = cache_file.dsym_file.uuid
            dsym_file = dsym_files_by_uuid[dsym_uuid]
            if cache_file.version == SYMCACHE_LATEST_VERSION and \
               cache_file.checksum == dsym_file.file.checksum:
                cachefiles_to_update.pop(dsym_uuid, None)
                cachefiles.append((dsym_uuid, cache_file))
            else:
                cachefiles_to_update[dsym_uuid] = \
                    (cache_file, dsym_file)

        # if any cache files need to be updated, do that now.
        if cachefiles_to_update:
            to_update = []
            for dsym_uuid, it in six.iteritems(cachefiles_to_update):
                if it is None:
                    dsym_file = dsym_files_by_uuid[dsym_uuid]
                else:
                    cache_file, dsym_file = it
                    cache_file.delete()
                to_update.append(dsym_file)
            updated_cachefiles, conversion_errors = self._update_cachefiles(
                project, to_update)
            cachefiles.extend(updated_cachefiles)

        return cachefiles, conversion_errors

    def _update_cachefiles(self, project, dsym_files):
        rv = []

        # Find all the known bad files we could not convert last time
        # around
        conversion_errors = {}
        for dsym_file in dsym_files:
            cache_key = 'scbe:%s:%s' % (dsym_file.uuid, dsym_file.file.checksum)
            err = cache.get(cache_key)
            if err is not None:
                conversion_errors[dsym_file.uuid] = err

        for dsym_file in dsym_files:
            dsym_uuid = dsym_file.uuid
            if dsym_uuid in conversion_errors:
                continue

            try:
                with dsym_file.file.getfile(as_tempfile=True) as tf:
                    fo = FatObject.from_path(tf.name)
                    o = fo.get_object(uuid=dsym_file.uuid)
                    if o is None:
                        continue
                    symcache = o.make_symcache()
            except SymbolicError as e:
                cache.set('scbe:%s:%s' % (
                    dsym_uuid, dsym_file.file.checksum), e.message,
                    CONVERSION_ERROR_TTL)
                conversion_errors[dsym_uuid] = e.message
                logger.error('dsymfile.symcache-build-error',
                             exc_info=True, extra=dict(dsym_uuid=dsym_uuid))
                continue

            file = File.objects.create(
                name=dsym_file.uuid,
                type='project.symcache',
            )
            file.putfile(symcache.open_stream())
            try:
                with transaction.atomic():
                    rv.append((dsym_uuid, ProjectSymCacheFile.objects.get_or_create(
                        project=project,
                        cache_file=file,
                        dsym_file=dsym_file,
                        defaults=dict(
                            checksum=dsym_file.file.checksum,
                            version=symcache.file_format_version,
                        )
                    )[0]))
            except IntegrityError:
                file.delete()
                rv.append((dsym_uuid, ProjectSymCacheFile.objects.get(
                    project=project,
                    dsym_file=dsym_file,
                )))

        return rv, conversion_errors

    def _load_cachefiles_via_fs(self, project, cachefiles):
        rv = {}
        base = self.get_project_path(project)
        for dsym_uuid, symcache_file in cachefiles:
            cachefile_path = os.path.join(base, dsym_uuid + '.symcache')
            try:
                stat = os.stat(cachefile_path)
            except OSError as e:
                if e.errno != errno.ENOENT:
                    raise
                symcache_file.cache_file.save_to(cachefile_path)
            else:
                self._try_bump_timestamp(cachefile_path, stat)
            rv[uuid.UUID(dsym_uuid)] = SymCache.from_path(cachefile_path)
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
