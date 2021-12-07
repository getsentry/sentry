from django.conf import settings

from sentry import options
from sentry.utils.services import LazyServiceWrapper

from .base import Analytics  # NOQA
from .event import *  # NOQA
from .event_manager import default_manager


def get_backend_path(backend_: str) -> str:
    try:
        backend_ = settings.SENTRY_ANALYTICS_ALIASES[backend_]
    except KeyError:
        pass
    return backend_


backend = LazyServiceWrapper(
    backend_base=Analytics,
    backend_path=get_backend_path(options.get("analytics.backend")),
    options=options.get("analytics.options"),
)
backend.expose(locals())

register = default_manager.register
