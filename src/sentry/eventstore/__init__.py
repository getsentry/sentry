from __future__ import absolute_import

from sentry.utils.services import LazyServiceWrapper

from .base import EventStorage  # NOQA

backend = LazyServiceWrapper(
    EventStorage, 'sentry.eventstore.snuba.SnubaEventStorage', {},
    metrics_path='eventstore',
)
backend.expose(locals())
