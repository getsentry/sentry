import weakref
import contextlib
from inspect import iscoroutinefunction

import sentry_sdk_alpha
from sentry_sdk_alpha.consts import OP
from sentry_sdk_alpha.scope import should_send_default_pii
from sentry_sdk_alpha.tracing import TransactionSource
from sentry_sdk_alpha.utils import (
    HAS_REAL_CONTEXTVARS,
    CONTEXTVARS_ERROR_MESSAGE,
    ensure_integration_enabled,
    event_from_exception,
    capture_internal_exceptions,
    transaction_from_function,
)
from sentry_sdk_alpha.integrations import _check_minimum_version, Integration, DidNotEnable
from sentry_sdk_alpha.integrations._wsgi_common import (
    RequestExtractor,
    _filter_headers,
    _is_json_content_type,
    _request_headers_to_span_attributes,
)
from sentry_sdk_alpha.integrations.logging import ignore_logger

try:
    from tornado import version_info as TORNADO_VERSION
    from tornado.gen import coroutine
    from tornado.httputil import HTTPServerRequest
    from tornado.web import RequestHandler, HTTPError
except ImportError:
    raise DidNotEnable("Tornado not installed")

from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from typing import Any
    from typing import Optional
    from typing import Dict
    from typing import Callable
    from typing import Generator

    from sentry_sdk_alpha._types import Event, EventProcessor


REQUEST_PROPERTY_TO_ATTRIBUTE = {
    "method": "http.request.method",
    "path": "url.path",
    "query": "url.query",
    "protocol": "url.scheme",
}


class TornadoIntegration(Integration):
    identifier = "tornado"
    origin = f"auto.http.{identifier}"

    @staticmethod
    def setup_once():
        # type: () -> None
        _check_minimum_version(TornadoIntegration, TORNADO_VERSION)

        if not HAS_REAL_CONTEXTVARS:
            # Tornado is async. We better have contextvars or we're going to leak
            # state between requests.
            raise DidNotEnable(
                "The tornado integration for Sentry requires Python 3.7+ or the aiocontextvars package"
                + CONTEXTVARS_ERROR_MESSAGE
            )

        ignore_logger("tornado.access")

        old_execute = RequestHandler._execute

        awaitable = iscoroutinefunction(old_execute)

        if awaitable:
            # Starting Tornado 6 RequestHandler._execute method is a standard Python coroutine (async/await)
            # In that case our method should be a coroutine function too
            async def sentry_execute_request_handler(self, *args, **kwargs):
                # type: (RequestHandler, *Any, **Any) -> Any
                with _handle_request_impl(self):
                    return await old_execute(self, *args, **kwargs)

        else:

            @coroutine  # type: ignore
            def sentry_execute_request_handler(self, *args, **kwargs):  # type: ignore
                # type: (RequestHandler, *Any, **Any) -> Any
                with _handle_request_impl(self):
                    result = yield from old_execute(self, *args, **kwargs)
                    return result

        RequestHandler._execute = sentry_execute_request_handler

        old_log_exception = RequestHandler.log_exception

        def sentry_log_exception(self, ty, value, tb, *args, **kwargs):
            # type: (Any, type, BaseException, Any, *Any, **Any) -> Optional[Any]
            _capture_exception(ty, value, tb)
            return old_log_exception(self, ty, value, tb, *args, **kwargs)

        RequestHandler.log_exception = sentry_log_exception


@contextlib.contextmanager
def _handle_request_impl(self):
    # type: (RequestHandler) -> Generator[None, None, None]
    integration = sentry_sdk_alpha.get_client().get_integration(TornadoIntegration)

    if integration is None:
        yield

    weak_handler = weakref.ref(self)

    with sentry_sdk_alpha.isolation_scope() as scope:
        headers = self.request.headers

        scope.clear_breadcrumbs()
        processor = _make_event_processor(weak_handler)
        scope.add_event_processor(processor)

        with sentry_sdk_alpha.continue_trace(headers):
            with sentry_sdk_alpha.start_span(
                op=OP.HTTP_SERVER,
                # Like with all other integrations, this is our
                # fallback transaction in case there is no route.
                # sentry_urldispatcher_resolve is responsible for
                # setting a transaction name later.
                name="generic Tornado request",
                source=TransactionSource.ROUTE,
                origin=TornadoIntegration.origin,
                attributes=_prepopulate_attributes(self.request),
            ):
                yield


@ensure_integration_enabled(TornadoIntegration)
def _capture_exception(ty, value, tb):
    # type: (type, BaseException, Any) -> None
    if isinstance(value, HTTPError):
        return

    event, hint = event_from_exception(
        (ty, value, tb),
        client_options=sentry_sdk_alpha.get_client().options,
        mechanism={"type": "tornado", "handled": False},
    )

    sentry_sdk_alpha.capture_event(event, hint=hint)


def _make_event_processor(weak_handler):
    # type: (Callable[[], RequestHandler]) -> EventProcessor
    def tornado_processor(event, hint):
        # type: (Event, dict[str, Any]) -> Event
        handler = weak_handler()
        if handler is None:
            return event

        request = handler.request

        with capture_internal_exceptions():
            method = getattr(handler, handler.request.method.lower())
            event["transaction"] = transaction_from_function(method) or ""
            event["transaction_info"] = {"source": TransactionSource.COMPONENT}

        with capture_internal_exceptions():
            extractor = TornadoRequestExtractor(request)
            extractor.extract_into_event(event)

            request_info = event["request"]

            request_info["url"] = "%s://%s%s" % (
                request.protocol,
                request.host,
                request.path,
            )

            request_info["query_string"] = request.query
            request_info["method"] = request.method
            request_info["env"] = {"REMOTE_ADDR": request.remote_ip}
            request_info["headers"] = _filter_headers(dict(request.headers))

        with capture_internal_exceptions():
            if handler.current_user and should_send_default_pii():
                event.setdefault("user", {}).setdefault("is_authenticated", True)

        return event

    return tornado_processor


class TornadoRequestExtractor(RequestExtractor):
    def content_length(self):
        # type: () -> int
        if self.request.body is None:
            return 0
        return len(self.request.body)

    def cookies(self):
        # type: () -> Dict[str, str]
        return {k: v.value for k, v in self.request.cookies.items()}

    def raw_data(self):
        # type: () -> bytes
        return self.request.body

    def form(self):
        # type: () -> Dict[str, Any]
        return {
            k: [v.decode("latin1", "replace") for v in vs]
            for k, vs in self.request.body_arguments.items()
        }

    def is_json(self):
        # type: () -> bool
        return _is_json_content_type(self.request.headers.get("content-type"))

    def files(self):
        # type: () -> Dict[str, Any]
        return {k: v[0] for k, v in self.request.files.items() if v}

    def size_of_file(self, file):
        # type: (Any) -> int
        return len(file.body or ())


def _prepopulate_attributes(request):
    # type: (HTTPServerRequest) -> dict[str, Any]
    # https://www.tornadoweb.org/en/stable/httputil.html#tornado.httputil.HTTPServerRequest
    attributes = {}

    for prop, attr in REQUEST_PROPERTY_TO_ATTRIBUTE.items():
        if getattr(request, prop, None) is not None:
            attributes[attr] = getattr(request, prop)

    if getattr(request, "version", None):
        try:
            proto, version = request.version.split("/")
            attributes["network.protocol.name"] = proto
            attributes["network.protocol.version"] = version
        except ValueError:
            attributes["network.protocol.name"] = request.version

    if getattr(request, "host", None):
        try:
            address, port = request.host.split(":")
            attributes["server.address"] = address
            attributes["server.port"] = port
        except ValueError:
            attributes["server.address"] = request.host

    with capture_internal_exceptions():
        attributes["url.full"] = request.full_url()

    attributes.update(_request_headers_to_span_attributes(request.headers))

    return attributes
