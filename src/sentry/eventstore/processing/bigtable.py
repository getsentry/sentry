# Shim for backward compatibility with getsentry
# The eventstore module has been moved to sentry.services.eventstore

from sentry.services.eventstore.processing.bigtable import *  # noqa: F401, F403
