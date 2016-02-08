import os
import shutil

from django.conf import settings
from sentry.models import DSymFile


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
        base = self.get_project_path(project)
        dsym = os.path.join(base, image_uuid.lower())
        if os.path.isfile(dsym):
            return dsym

        try:
            dsf = DSymFile.objects.filter(
                project=project,
                uuid=image_uuid,
            ).select_related('file', 'file__blob').get()
        except DSymFile.DoesNotExist:
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
