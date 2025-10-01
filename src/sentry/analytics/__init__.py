from sentry import options
from sentry.utils.services import LazyServiceWrapper

from .base import Analytics
from .event import Event, eventclass
from .event_manager import default_manager

__all__ = (
    "Analytics",
    "eventclass",
    "Event",
    "record",
    "record_event",
    "setup",
)

_SENTRY_ANALYTICS_ALIASES = {
    "noop": "sentry.analytics.Analytics",
    "pubsub": "sentry.analytics.pubsub.PubSubAnalytics",
}


def _get_backend_path(path: str) -> str:
    return _SENTRY_ANALYTICS_ALIASES.get(path, path)


backend = LazyServiceWrapper(
    backend_base=Analytics,
    backend_path=_get_backend_path(options.get("analytics.backend")),
    options=options.get("analytics.options"),
)

record = backend.record
record_event_envelope = backend.record_event_envelope
register = default_manager.register
setup = backend.setup
validate = backend.validate
