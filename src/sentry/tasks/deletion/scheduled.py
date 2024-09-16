# Shim for getsentry
from sentry.deletions.tasks.scheduled import run_deletion

__all__ = ("run_deletion",)
