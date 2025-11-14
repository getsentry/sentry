# Shim for backward compatibility with getsentry
# The eventstore module has been moved to sentry.services.eventstore

from typing import int
from sentry.services import eventstore  # noqa: F401, F403
from sentry.services.eventstore import backend  # noqa: F401
from sentry.services.eventstore.base import Filter  # noqa: F401

__all__ = ["backend", "Filter"]

globals().update({k: getattr(eventstore, k) for k in dir(eventstore) if not k.startswith("__")})
