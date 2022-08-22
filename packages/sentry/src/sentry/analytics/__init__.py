from sentry import options
from sentry.utils.services import LazyServiceWrapper

from .attribute import Attribute
from .base import Analytics
from .event import Event
from .event_manager import default_manager
from .map import Map
from .utils import get_backend_path

__all__ = (
    "Analytics",
    "Attribute",
    "Event",
    "Map",
    "record",
    "record_event",
    "setup",
)

backend = LazyServiceWrapper(
    backend_base=Analytics,
    backend_path=get_backend_path(options.get("analytics.backend")),
    options=options.get("analytics.options"),
)

record = backend.record
record_event = backend.record_event
register = default_manager.register
setup = backend.setup
validate = backend.validate
