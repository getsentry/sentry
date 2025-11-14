# Shim for backward compatibility with getsentry
# The eventstore module has been moved to sentry.services.eventstore

from typing import int
from sentry.services.eventstore.snuba import *  # noqa: F401, F403
