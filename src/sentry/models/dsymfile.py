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
import tempfile
from requests.exceptions import RequestException

from jsonfield import JSONField
from django.db import models, transaction, IntegrityError
from django.utils import timezone
from django.utils.translation import ugettext_lazy as _

from symsynd import DebugInfo, DebugInfoError

from sentry import options
from sentry.db.models import FlexibleForeignKey, Model, \
    sane_repr, BaseManager, BoundedPositiveIntegerField
from sentry.models.file import File
from sentry.utils.zip import safe_extract_zip
from sentry.constants import KNOWN_DSYM_TYPES
from sentry.reprocessing import resolve_processing_issue

ONE_DAY = 60 * 60 * 24
ONE_DAY_AND_A_HALF = int(ONE_DAY * 1.5)
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
        self, sync_id, app_id, project, data=None, platform=DSymPlatform.GENERIC
    ):
        if data is None:
            data = {}
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

    def delete(self, *args, **kwargs):
        super(ProjectDSymFile, self).delete(*args, **kwargs)
        self.file.delete()


def _create_dsym_from_uuid(project, dsym_type, cpu_name, uuid, fileobj, basename):
    """This creates a mach dsym file or proguard mapping from the given
    uuid and open file object to a dsym file.  This will not verify the
    uuid (intentionally so).  Use `create_files_from_dsym_zip` for doing
    everything.
    """
    if dsym_type == 'proguard':
        object_name = 'proguard-mapping'
    elif dsym_type == 'macho':
        object_name = basename
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


def create_files_from_dsym_zip(fileobj, project=None):
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

                # macho style debug symbols
                try:
                    di = DebugInfo.open_path(fn)
                except DebugInfoError:
                    # Whatever was contained there, was probably not a
                    # macho file.
                    pass
                else:
                    for variant in di.get_variants():
                        to_create.append(
                            ('macho', variant.cpu_name, six.text_type(variant.uuid), fn, )
                        )
                    continue

        rv = []
        for dsym_type, cpu, file_uuid, filename in to_create:
            with open(filename, 'rb') as f:
                dsym, created = _create_dsym_from_uuid(
                    project, dsym_type, cpu, file_uuid, f, os.path.basename(filename)
                )
                if created:
                    rv.append(dsym)
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
    def dsym_cache_path(self):
        return options.get('dsym.cache-path')

    def get_project_path(self, project):
        return os.path.join(self.dsym_cache_path, six.text_type(project.id))

    def fetch_dsyms(self, project, uuids, on_dsym_file_referenced=None):
        rv = {}
        for image_uuid in uuids:
            path = self.fetch_dsym(
                project, image_uuid, on_dsym_file_referenced=on_dsym_file_referenced
            )
            if path is not None:
                rv[image_uuid] = path
        return rv

    def try_bump_timestamp(self, path, old_stat):
        now = int(time.time())
        if old_stat.st_ctime < now - ONE_DAY:
            os.utime(path, (now, now))
        return path

    def fetch_dsym(self, project, image_uuid, on_dsym_file_referenced=None):
        image_uuid = image_uuid.lower()
        dsym_path = os.path.join(self.get_project_path(project), image_uuid)
        try:
            os.stat(dsym_path)
        except OSError as e:
            if e.errno != errno.ENOENT:
                raise
        else:
            return dsym_path

        dsf = find_dsym_file(project, image_uuid)
        if dsf is None:
            return None

        if on_dsym_file_referenced is not None:
            on_dsym_file_referenced(dsf)

        try:
            os.makedirs(os.path.dirname(dsym_path))
        except OSError:
            pass

        with dsf.file.getfile() as sf:
            suffix = '_%s' % uuid.uuid4()
            done = False
            try:
                with open(dsym_path + suffix, 'w') as df:
                    shutil.copyfileobj(sf, df)
                os.rename(dsym_path + suffix, dsym_path)
                done = True
            finally:
                # Use finally here because it does not lie about the
                # error on exit
                if not done:
                    try:
                        os.remove(dsym_path + suffix)
                    except Exception:
                        pass

        return dsym_path

    def clear_old_entries(self):
        try:
            cache_folders = os.listdir(self.dsym_cache_path)
        except OSError:
            return

        cutoff = int(time.time()) - ONE_DAY_AND_A_HALF

        for cache_folder in cache_folders:
            cache_folder = os.path.join(self.dsym_cache_path, cache_folder)
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
