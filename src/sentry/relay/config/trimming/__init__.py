from django.conf import settings

from sentry.utils.services import LazyServiceWrapper

from .base import Trimming

backend = LazyServiceWrapper(
    Trimming, settings.SENTRY_RELAY_TRIMMING, settings.SENTRY_RELAY_TRIMMING_OPTIONS
)
backend.expose(locals())
