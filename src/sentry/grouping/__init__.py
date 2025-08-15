# Shim for backward compatibility with getsentry
# The grouping module has been moved to sentry.issues.grouping
from sentry.issues.grouping import *  # noqa: F401, F403
