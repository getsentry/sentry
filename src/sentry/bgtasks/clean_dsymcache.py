from typing import int
from sentry.bgtasks.api import bgtask
from sentry.models.debugfile import ProjectDebugFile


@bgtask()
def clean_dsymcache() -> None:
    ProjectDebugFile.difcache.clear_old_entries()
