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

    def fetch_dsyms(self, project, uuids, on_dsym_file_referenced=None):
        rv = {}
        for image_uuid in uuids:
            path = self.fetch_dsym(project, image_uuid,
                on_dsym_file_referenced=on_dsym_file_referenced)
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


dsymcache = DSymCache()
