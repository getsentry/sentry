import os
import shutil

from django.conf import settings
from sentry.models import find_dsym_file


class DSymCache(object):

    def __init__(self):
        pass

    def get_project_path(self, project):
        return os.path.join(settings.DSYM_CACHE_PATH, str(project.id))

    def fetch_dsyms(self, project, uuids):
        base = self.get_project_path(project)
        loaded = []
        for image_uuid in uuids:
            dsym = self.fetch_dsym(project, image_uuid)
            if dsym is not None:
                loaded.append(dsym)
        return base, loaded

    def fetch_dsym(self, project, image_uuid):
        image_uuid = image_uuid.lower()
        base = self.get_project_path(project)
        dsym = os.path.join(base, image_uuid)
        if os.path.isfile(dsym):
            return dsym

        dsf = find_dsym_file(project, image_uuid)
        if dsf is None:
            return None

        try:
            os.makedirs(base)
        except OSError:
            pass

        with dsf.file.getfile() as sf:
            with open(dsym + '_tmp', 'w') as df:
                shutil.copyfileobj(sf, df)
            os.rename(dsym + '_tmp', dsym)

        return dsym


dsymcache = DSymCache()
