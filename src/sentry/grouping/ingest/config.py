# Shim for backward compatibility with getsentry
# The grouping module has been moved to sentry.issues.grouping
from sentry.issues.grouping.ingest.config import *  # noqa: F401, F403
