from django.conf import settings

from sentry.utils.services import LazyServiceWrapper

from .base import Newsletter

backend = LazyServiceWrapper(
    Newsletter, settings.SENTRY_NEWSLETTER, settings.SENTRY_NEWSLETTER_OPTIONS
)
backend.expose(locals())
