from django.conf import settings

from sentry.utils.services import LazyServiceWrapper

from .backend import ErrorsEventStreamAPI

errors_backend = LazyServiceWrapper(
    ErrorsEventStreamAPI,
    settings.SENTRY_ERRORS_EVENTSTREAM,
    settings.SENTRY_ERRORS_EVENTSTREAM_OPTIONS,
)
errors_backend.expose(locals())
