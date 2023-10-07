from sentry.bgtasks.api import bgtask
from sentry.models.releasefile import ReleaseFile


@bgtask()
def clean_releasefilecache():
    ReleaseFile.cache.clear_old_entries()
