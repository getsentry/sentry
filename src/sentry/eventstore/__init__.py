from __future__ import absolute_import

from django.conf import settings

from sentry.utils.services import LazyServiceWrapper

from .base import EventStorage, Filter  # NOQA

backend = LazyServiceWrapper(
    EventStorage,
    settings.SENTRY_EVENTSTORE,
    settings.SENTRY_EVENTSTORE_OPTIONS,
    metrics_path="eventstore",
)
backend.expose(locals())
