from __future__ import absolute_import

from sentry.bgtasks.api import bgtask
from sentry.models import ProjectDSymFile


@bgtask()
def clean_dsymcache():
    ProjectDSymFile.dsymcache.clear_old_entries()
