from __future__ import absolute_import

import os
import uuid
import time
import errno
import six
import shutil

from sentry import options
from sentry.models import find_dsym_file


ONE_DAY = 60 * 60 * 24
ONE_DAY_AND_A_HALF = int(ONE_DAY * 1.5)


class DSymCache(object):

    @property
    def dsym_cache_path(self):
        return options.get('dsym.cache-path')

    def get_project_path(self, project):
        return os.path.join(self.dsym_cache_path, six.text_type(project.id))

    def get_global_path(self):
        return os.path.join(self.dsym_cache_path, 'global')

    def fetch_dsyms(self, project, uuids, on_dsym_file_referenced=None):
        bases = set()
        loaded = set()
        for image_uuid in uuids:
            base = self.fetch_dsym(project, image_uuid,
                on_dsym_file_referenced=on_dsym_file_referenced)
            if base is not None:
                loaded.add(image_uuid)
                bases.add(base)
        return list(bases), loaded

    def try_bump_timestamp(self, path, old_stat):
        now = int(time.time())
        if old_stat.st_ctime < now - ONE_DAY:
            os.utime(path, (now, now))
        return path

    def fetch_dsym(self, project, image_uuid, on_dsym_file_referenced=None):
        image_uuid = image_uuid.lower()
        for path in self.get_project_path(project), self.get_global_path():
            base = self.get_project_path(project)
            dsym = os.path.join(base, image_uuid)
            try:
                os.stat(dsym)
            except OSError as e:
                if e.errno != errno.ENOENT:
                    raise
            else:
                return base

        dsf = find_dsym_file(project, image_uuid)
        if dsf is None:
            return None

        if dsf.is_global:
            base = self.get_global_path()
        else:
            if on_dsym_file_referenced is not None:
                on_dsym_file_referenced(dsf)
            base = self.get_project_path(project)
        dsym = os.path.join(base, image_uuid)

        try:
            os.makedirs(base)
        except OSError:
            pass

        with dsf.file.getfile() as sf:
            suffix = '_%s' % uuid.uuid4()
            done = False
            try:
                with open(dsym + suffix, 'w') as df:
                    shutil.copyfileobj(sf, df)
                os.rename(dsym + suffix, dsym)
                done = True
            finally:
                # Use finally here because it does not lie about the
                # error on exit
                if not done:
                    try:
                        os.remove(dsym + suffix)
                    except Exception:
                        pass

        return base

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


dsymcache = DSymCache()
