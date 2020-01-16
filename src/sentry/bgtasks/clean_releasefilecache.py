from __future__ import absolute_import

from sentry.bgtasks.api import bgtask
from sentry.models import ReleaseFile


@bgtask()
def clean_releasefilecache():
    ReleaseFile.cache.clear_old_entries()
