import sys
import weakref
from functools import wraps

import sentry_sdk_alpha
from sentry_sdk_alpha.consts import (
    OP,
    SPANSTATUS,
    SPANDATA,
    BAGGAGE_HEADER_NAME,
    SOURCE_FOR_STYLE,
    TransactionSource,
)
from sentry_sdk_alpha.integrations import (
    _DEFAULT_FAILED_REQUEST_STATUS_CODES,
    _check_minimum_version,
    Integration,
    DidNotEnable,
)
from sentry_sdk_alpha.integrations.logging import ignore_logger
from sentry_sdk_alpha.sessions import track_session
from sentry_sdk_alpha.integrations._wsgi_common import (
    _filter_headers,
    _request_headers_to_span_attributes,
    request_body_within_bounds,
)
from sentry_sdk_alpha.tracing_utils import should_propagate_trace
from sentry_sdk_alpha.utils import (
    capture_internal_exceptions,
    ensure_integration_enabled,
    event_from_exception,
    http_client_status_to_breadcrumb_level,
    logger,
    parse_url,
    parse_version,
    reraise,
    set_thread_info_from_span,
    transaction_from_function,
    HAS_REAL_CONTEXTVARS,
    CONTEXTVARS_ERROR_MESSAGE,
    SENSITIVE_DATA_SUBSTITUTE,
    AnnotatedValue,
)

try:
    import asyncio

    from aiohttp import __version__ as AIOHTTP_VERSION
    from aiohttp import ClientSession, TraceConfig
    from aiohttp.web import Application, HTTPException, UrlDispatcher
except ImportError:
    raise DidNotEnable("AIOHTTP not installed")

from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from aiohttp.web_request import Request
    from aiohttp.web_urldispatcher import UrlMappingMatchInfo
    from aiohttp import TraceRequestStartParams, TraceRequestEndParams

    from collections.abc import Set
    from types import SimpleNamespace
    from typing import Any
    from typing import Optional
    from typing import Tuple
    from typing import Union

    from sentry_sdk_alpha.utils import ExcInfo
    from sentry_sdk_alpha._types import Event, EventProcessor


TRANSACTION_STYLE_VALUES = ("handler_name", "method_and_path_pattern")

REQUEST_PROPERTY_TO_ATTRIBUTE = {
    "query_string": "url.query",
    "method": "http.request.method",
    "scheme": "url.scheme",
    "path": "url.path",
}


class AioHttpIntegration(Integration):
    identifier = "aiohttp"
    origin = f"auto.http.{identifier}"

    def __init__(
        self,
        transaction_style="handler_name",  # type: str
        *,
        failed_request_status_codes=_DEFAULT_FAILED_REQUEST_STATUS_CODES,  # type: Set[int]
    ):
        # type: (...) -> None
        if transaction_style not in TRANSACTION_STYLE_VALUES:
            raise ValueError(
                "Invalid value for transaction_style: %s (must be in %s)"
                % (transaction_style, TRANSACTION_STYLE_VALUES)
            )
        self.transaction_style = transaction_style
        self._failed_request_status_codes = failed_request_status_codes

    @staticmethod
    def setup_once():
        # type: () -> None

        version = parse_version(AIOHTTP_VERSION)
        _check_minimum_version(AioHttpIntegration, version)

        if not HAS_REAL_CONTEXTVARS:
            # We better have contextvars or we're going to leak state between
            # requests.
            raise DidNotEnable(
                "The aiohttp integration for Sentry requires Python 3.7+ "
                " or aiocontextvars package." + CONTEXTVARS_ERROR_MESSAGE
            )

        ignore_logger("aiohttp.server")

        old_handle = Application._handle

        async def sentry_app_handle(self, request, *args, **kwargs):
            # type: (Any, Request, *Any, **Any) -> Any
            integration = sentry_sdk_alpha.get_client().get_integration(AioHttpIntegration)
            if integration is None:
                return await old_handle(self, request, *args, **kwargs)

            weak_request = weakref.ref(request)

            with sentry_sdk_alpha.isolation_scope() as scope:
                with track_session(scope, session_mode="request"):
                    # Scope data will not leak between requests because aiohttp
                    # create a task to wrap each request.
                    scope.generate_propagation_context()
                    scope.clear_breadcrumbs()
                    scope.add_event_processor(_make_request_processor(weak_request))

                    headers = dict(request.headers)
                    with sentry_sdk_alpha.continue_trace(headers):
                        with sentry_sdk_alpha.start_span(
                            op=OP.HTTP_SERVER,
                            # If this transaction name makes it to the UI, AIOHTTP's
                            # URL resolver did not find a route or died trying.
                            name="generic AIOHTTP request",
                            source=TransactionSource.ROUTE,
                            origin=AioHttpIntegration.origin,
                            attributes=_prepopulate_attributes(request),
                        ) as span:
                            try:
                                response = await old_handle(self, request)
                            except HTTPException as e:
                                span.set_http_status(e.status_code)

                                if (
                                    e.status_code
                                    in integration._failed_request_status_codes
                                ):
                                    _capture_exception()

                                raise
                            except (asyncio.CancelledError, ConnectionResetError):
                                span.set_status(SPANSTATUS.CANCELLED)
                                raise
                            except Exception:
                                # This will probably map to a 500 but seems like we
                                # have no way to tell. Do not set span status.
                                reraise(*_capture_exception())

                            span.set_http_status(response.status)
                            return response

        Application._handle = sentry_app_handle

        old_urldispatcher_resolve = UrlDispatcher.resolve

        @wraps(old_urldispatcher_resolve)
        async def sentry_urldispatcher_resolve(self, request):
            # type: (UrlDispatcher, Request) -> UrlMappingMatchInfo
            rv = await old_urldispatcher_resolve(self, request)

            integration = sentry_sdk_alpha.get_client().get_integration(AioHttpIntegration)
            if integration is None:
                return rv

            name = None

            try:
                if integration.transaction_style == "handler_name":
                    name = transaction_from_function(rv.handler)
                elif integration.transaction_style == "method_and_path_pattern":
                    route_info = rv.get_info()
                    pattern = route_info.get("path") or route_info.get("formatter")
                    name = "{} {}".format(request.method, pattern)
            except Exception:
                pass

            if name is not None:
                sentry_sdk_alpha.get_current_scope().set_transaction_name(
                    name,
                    source=SOURCE_FOR_STYLE[integration.transaction_style],
                )

            return rv

        UrlDispatcher.resolve = sentry_urldispatcher_resolve

        old_client_session_init = ClientSession.__init__

        @ensure_integration_enabled(AioHttpIntegration, old_client_session_init)
        def init(*args, **kwargs):
            # type: (Any, Any) -> None
            client_trace_configs = list(kwargs.get("trace_configs") or ())
            trace_config = create_trace_config()
            client_trace_configs.append(trace_config)

            kwargs["trace_configs"] = client_trace_configs
            return old_client_session_init(*args, **kwargs)

        ClientSession.__init__ = init


def create_trace_config():
    # type: () -> TraceConfig

    async def on_request_start(session, trace_config_ctx, params):
        # type: (ClientSession, SimpleNamespace, TraceRequestStartParams) -> None
        if sentry_sdk_alpha.get_client().get_integration(AioHttpIntegration) is None:
            return

        method = params.method.upper()

        parsed_url = None
        with capture_internal_exceptions():
            parsed_url = parse_url(str(params.url), sanitize=False)

        span = sentry_sdk_alpha.start_span(
            op=OP.HTTP_CLIENT,
            name="%s %s"
            % (method, parsed_url.url if parsed_url else SENSITIVE_DATA_SUBSTITUTE),
            origin=AioHttpIntegration.origin,
            only_if_parent=True,
        )

        data = {
            SPANDATA.HTTP_METHOD: method,
        }
        set_thread_info_from_span(data, span)

        if parsed_url is not None:
            data["url"] = parsed_url.url
            data[SPANDATA.HTTP_QUERY] = parsed_url.query
            data[SPANDATA.HTTP_FRAGMENT] = parsed_url.fragment

        for key, value in data.items():
            span.set_attribute(key, value)

        client = sentry_sdk_alpha.get_client()

        if should_propagate_trace(client, str(params.url)):
            for (
                key,
                value,
            ) in sentry_sdk_alpha.get_current_scope().iter_trace_propagation_headers(
                span=span
            ):
                logger.debug(
                    "[Tracing] Adding `{key}` header {value} to outgoing request to {url}.".format(
                        key=key, value=value, url=params.url
                    )
                )
                if key == BAGGAGE_HEADER_NAME and params.headers.get(
                    BAGGAGE_HEADER_NAME
                ):
                    # do not overwrite any existing baggage, just append to it
                    params.headers[key] += "," + value
                else:
                    params.headers[key] = value

        trace_config_ctx.span = span
        trace_config_ctx.span_data = data

    async def on_request_end(session, trace_config_ctx, params):
        # type: (ClientSession, SimpleNamespace, TraceRequestEndParams) -> None
        if trace_config_ctx.span is None:
            return

        span_data = trace_config_ctx.span_data or {}
        status_code = int(params.response.status)
        span_data[SPANDATA.HTTP_STATUS_CODE] = status_code
        span_data["reason"] = params.response.reason

        sentry_sdk_alpha.add_breadcrumb(
            type="http",
            category="httplib",
            data=span_data,
            level=http_client_status_to_breadcrumb_level(status_code),
        )

        span = trace_config_ctx.span
        span.set_http_status(int(params.response.status))
        span.set_attribute("reason", params.response.reason)
        span.finish()

    trace_config = TraceConfig()

    trace_config.on_request_start.append(on_request_start)
    trace_config.on_request_end.append(on_request_end)

    return trace_config


def _make_request_processor(weak_request):
    # type: (weakref.ReferenceType[Request]) -> EventProcessor
    def aiohttp_processor(
        event,  # type: Event
        hint,  # type: dict[str, Tuple[type, BaseException, Any]]
    ):
        # type: (...) -> Event
        request = weak_request()
        if request is None:
            return event

        with capture_internal_exceptions():
            request_info = event.setdefault("request", {})

            request_info["url"] = "%s://%s%s" % (
                request.scheme,
                request.host,
                request.path,
            )

            request_info["query_string"] = request.query_string
            request_info["method"] = request.method
            request_info["env"] = {"REMOTE_ADDR": request.remote}
            request_info["headers"] = _filter_headers(dict(request.headers))

            # Just attach raw data here if it is within bounds, if available.
            # Unfortunately there's no way to get structured data from aiohttp
            # without awaiting on some coroutine.
            request_info["data"] = get_aiohttp_request_data(request)

        return event

    return aiohttp_processor


def _capture_exception():
    # type: () -> ExcInfo
    exc_info = sys.exc_info()
    event, hint = event_from_exception(
        exc_info,
        client_options=sentry_sdk_alpha.get_client().options,
        mechanism={"type": "aiohttp", "handled": False},
    )
    sentry_sdk_alpha.capture_event(event, hint=hint)
    return exc_info


BODY_NOT_READ_MESSAGE = "[Can't show request body due to implementation details.]"


def get_aiohttp_request_data(request):
    # type: (Request) -> Union[Optional[str], AnnotatedValue]
    bytes_body = request._read_bytes

    if bytes_body is not None:
        # we have body to show
        if not request_body_within_bounds(sentry_sdk_alpha.get_client(), len(bytes_body)):
            return AnnotatedValue.removed_because_over_size_limit()

        encoding = request.charset or "utf-8"
        return bytes_body.decode(encoding, "replace")

    if request.can_read_body:
        # body exists but we can't show it
        return BODY_NOT_READ_MESSAGE

    # request has no body
    return None


def _prepopulate_attributes(request):
    # type: (Request) -> dict[str, Any]
    """Construct initial span attributes that can be used in traces sampler."""
    attributes = {}

    for prop, attr in REQUEST_PROPERTY_TO_ATTRIBUTE.items():
        if getattr(request, prop, None) is not None:
            attributes[attr] = getattr(request, prop)

    if getattr(request, "host", None) is not None:
        try:
            host, port = request.host.split(":")
            attributes["server.address"] = host
            attributes["server.port"] = port
        except ValueError:
            attributes["server.address"] = request.host

    with capture_internal_exceptions():
        url = f"{request.scheme}://{request.host}{request.path}"  # noqa: E231
        if request.query_string:
            attributes["url.full"] = f"{url}?{request.query_string}"

    attributes.update(_request_headers_to_span_attributes(dict(request.headers)))

    return attributes
