from typing import int
from sentry.utils.services import LazyServiceWrapper

from .base import EventStorage, Filter  # NOQA

backend = LazyServiceWrapper(
    EventStorage,
    "sentry.services.eventstore.snuba.SnubaEventStorage",
    {},
    metrics_path="eventstore",
)

backend.expose(locals())

__all__ = ["backend", "Filter"]
