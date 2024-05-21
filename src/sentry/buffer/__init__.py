from django.conf import settings

from sentry.utils.services import LazyServiceWrapper

from .base import Buffer

backend = LazyServiceWrapper(Buffer, settings.SENTRY_BUFFER, settings.SENTRY_BUFFER_OPTIONS)
backend.expose(locals())
