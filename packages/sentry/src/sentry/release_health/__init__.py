from django.conf import settings

from sentry.utils.services import LazyServiceWrapper

from .base import ReleaseHealthBackend

backend = LazyServiceWrapper(
    ReleaseHealthBackend,
    settings.SENTRY_RELEASE_HEALTH,
    settings.SENTRY_RELEASE_HEALTH_OPTIONS,
)
backend.expose(locals())
