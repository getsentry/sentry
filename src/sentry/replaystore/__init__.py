from django.conf import settings

from sentry.utils.services import LazyServiceWrapper

from .base import ReplayStore  # NOQA

backend = LazyServiceWrapper(
    ReplayStore,
    settings.SENTRY_REPLAYSTORE,
    settings.SENTRY_REPLAYSTORE_OPTIONS,
    metrics_path="replaystore",
)
backend.expose(locals())
