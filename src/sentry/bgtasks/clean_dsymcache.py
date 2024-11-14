from sentry.bgtasks.api import bgtask
from sentry.models.debugfile import ProjectDebugFile


@bgtask()
def clean_dsymcache():
    ProjectDebugFile.difcache.clear_old_entries()
