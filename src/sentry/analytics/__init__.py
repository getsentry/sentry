from __future__ import absolute_import

from django.conf import settings

from sentry import options
from sentry.utils.services import LazyServiceWrapper

from .base import Analytics  # NOQA
from .event_manager import default_manager
from .event import *  # NOQA


def get_backend_path(backend):
    try:
        backend = settings.SENTRY_ANALYTICS_ALIASES[backend]
    except KeyError:
        pass
    return backend


backend = LazyServiceWrapper(
    Analytics, get_backend_path(options.get("analytics.backend")), options.get("analytics.options")
)
backend.expose(locals())

register = default_manager.register
