# TODO-neel scope switch
# TODO-neel avoid duplication between api and __init__
from sentry_sdk_alpha.opentelemetry.scope import PotelScope as Scope
from sentry_sdk_alpha.transport import Transport, HttpTransport
from sentry_sdk_alpha.client import Client

from sentry_sdk_alpha.api import *  # noqa

from sentry_sdk_alpha.consts import VERSION  # noqa

__all__ = [  # noqa
    "Scope",
    "Client",
    "Transport",
    "HttpTransport",
    "integrations",
    # From sentry_sdk.api
    "init",
    "add_attachment",
    "add_breadcrumb",
    "capture_event",
    "capture_exception",
    "capture_message",
    "continue_trace",
    "flush",
    "get_baggage",
    "get_client",
    "get_global_scope",
    "get_isolation_scope",
    "get_current_scope",
    "get_current_span",
    "get_traceparent",
    "is_initialized",
    "isolation_scope",
    "last_event_id",
    "new_scope",
    "set_context",
    "set_extra",
    "set_level",
    "set_tag",
    "set_tags",
    "set_user",
    "start_span",
    "start_transaction",
    "trace",
    "monitor",
    "logger",
]

# Initialize the debug support after everything is loaded
from sentry_sdk_alpha.debug import init_debug_support

init_debug_support()
del init_debug_support
