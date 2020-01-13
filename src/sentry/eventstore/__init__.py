from __future__ import absolute_import

from sentry.utils.services import LazyServiceWrapper

from .base import EventStorage, Filter  # NOQA

backend = LazyServiceWrapper(
    EventStorage, "sentry.eventstore.snuba.SnubaEventStorage", {}, metrics_path="eventstore"
)
backend.expose(locals())
