import os
import subprocess
import sys
import platform
from http.client import HTTPConnection

import sentry_sdk_alpha
from sentry_sdk_alpha.consts import OP, SPANDATA
from sentry_sdk_alpha.integrations import Integration
from sentry_sdk_alpha.scope import add_global_event_processor
from sentry_sdk_alpha.tracing_utils import EnvironHeaders, should_propagate_trace
from sentry_sdk_alpha.utils import (
    SENSITIVE_DATA_SUBSTITUTE,
    capture_internal_exceptions,
    ensure_integration_enabled,
    get_current_thread_meta,
    http_client_status_to_breadcrumb_level,
    is_sentry_url,
    logger,
    safe_repr,
    parse_url,
    set_thread_info_from_span,
)

from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from typing import Any
    from typing import Callable
    from typing import Dict
    from typing import Optional
    from typing import List

    from sentry_sdk_alpha._types import Event, Hint


_RUNTIME_CONTEXT = {
    "name": platform.python_implementation(),
    "version": "%s.%s.%s" % (sys.version_info[:3]),
    "build": sys.version,
}  # type: dict[str, object]


class StdlibIntegration(Integration):
    identifier = "stdlib"

    @staticmethod
    def setup_once():
        # type: () -> None
        _install_httplib()
        _install_subprocess()

        @add_global_event_processor
        def add_python_runtime_context(event, hint):
            # type: (Event, Hint) -> Optional[Event]
            if sentry_sdk_alpha.get_client().get_integration(StdlibIntegration) is not None:
                contexts = event.setdefault("contexts", {})
                if isinstance(contexts, dict) and "runtime" not in contexts:
                    contexts["runtime"] = _RUNTIME_CONTEXT

            return event


def _install_httplib():
    # type: () -> None
    real_putrequest = HTTPConnection.putrequest
    real_getresponse = HTTPConnection.getresponse

    def putrequest(self, method, url, *args, **kwargs):
        # type: (HTTPConnection, str, str, *Any, **Any) -> Any
        host = self.host
        port = self.port
        default_port = self.default_port

        client = sentry_sdk_alpha.get_client()
        if client.get_integration(StdlibIntegration) is None or is_sentry_url(
            client, f"{host}:{port}"  # noqa: E231
        ):
            return real_putrequest(self, method, url, *args, **kwargs)

        real_url = url
        if real_url is None or not real_url.startswith(("http://", "https://")):
            real_url = "%s://%s%s%s" % (
                default_port == 443 and "https" or "http",
                host,
                port != default_port and ":%s" % port or "",
                url,
            )

        parsed_url = None
        with capture_internal_exceptions():
            parsed_url = parse_url(real_url, sanitize=False)

        span = sentry_sdk_alpha.start_span(
            op=OP.HTTP_CLIENT,
            name="%s %s"
            % (method, parsed_url.url if parsed_url else SENSITIVE_DATA_SUBSTITUTE),
            origin="auto.http.stdlib.httplib",
            only_if_parent=True,
        )
        span.__enter__()

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

        rv = real_putrequest(self, method, url, *args, **kwargs)

        if should_propagate_trace(client, real_url):
            for (
                key,
                value,
            ) in sentry_sdk_alpha.get_current_scope().iter_trace_propagation_headers(
                span=span
            ):
                logger.debug(
                    "[Tracing] Adding `{key}` header {value} to outgoing request to {real_url}.".format(
                        key=key, value=value, real_url=real_url
                    )
                )
                self.putheader(key, value)

        self._sentrysdk_span = span  # type: ignore[attr-defined]
        self._sentrysdk_span_data = data  # type: ignore[attr-defined]

        return rv

    def getresponse(self, *args, **kwargs):
        # type: (HTTPConnection, *Any, **Any) -> Any
        span = getattr(self, "_sentrysdk_span", None)

        if span is None:
            return real_getresponse(self, *args, **kwargs)

        try:
            rv = real_getresponse(self, *args, **kwargs)

            span_data = getattr(self, "_sentrysdk_span_data", {})
            span_data[SPANDATA.HTTP_STATUS_CODE] = int(rv.status)
            span_data["reason"] = rv.reason

            status_code = int(rv.status)
            span.set_http_status(status_code)
            span.set_attribute("reason", rv.reason)

            sentry_sdk_alpha.add_breadcrumb(
                type="http",
                category="httplib",
                data=span_data,
                level=http_client_status_to_breadcrumb_level(status_code),
            )
        finally:
            span.__exit__(None, None, None)

        return rv

    HTTPConnection.putrequest = putrequest  # type: ignore[method-assign]
    HTTPConnection.getresponse = getresponse  # type: ignore[method-assign]


def _init_argument(args, kwargs, name, position, setdefault_callback=None):
    # type: (List[Any], Dict[Any, Any], str, int, Optional[Callable[[Any], Any]]) -> Any
    """
    given (*args, **kwargs) of a function call, retrieve (and optionally set a
    default for) an argument by either name or position.

    This is useful for wrapping functions with complex type signatures and
    extracting a few arguments without needing to redefine that function's
    entire type signature.
    """

    if name in kwargs:
        rv = kwargs[name]
        if setdefault_callback is not None:
            rv = setdefault_callback(rv)
        if rv is not None:
            kwargs[name] = rv
    elif position < len(args):
        rv = args[position]
        if setdefault_callback is not None:
            rv = setdefault_callback(rv)
        if rv is not None:
            args[position] = rv
    else:
        rv = setdefault_callback and setdefault_callback(None)
        if rv is not None:
            kwargs[name] = rv

    return rv


def _install_subprocess():
    # type: () -> None
    old_popen_init = subprocess.Popen.__init__

    @ensure_integration_enabled(StdlibIntegration, old_popen_init)
    def sentry_patched_popen_init(self, *a, **kw):
        # type: (subprocess.Popen[Any], *Any, **Any) -> None
        # Convert from tuple to list to be able to set values.
        a = list(a)

        args = _init_argument(a, kw, "args", 0) or []
        cwd = _init_argument(a, kw, "cwd", 9)

        # if args is not a list or tuple (and e.g. some iterator instead),
        # let's not use it at all. There are too many things that can go wrong
        # when trying to collect an iterator into a list and setting that list
        # into `a` again.
        #
        # Also invocations where `args` is not a sequence are not actually
        # legal. They just happen to work under CPython.
        description = None

        if isinstance(args, (list, tuple)) and len(args) < 100:
            with capture_internal_exceptions():
                description = " ".join(map(str, args))

        if description is None:
            description = safe_repr(args)

        env = None

        with sentry_sdk_alpha.start_span(
            op=OP.SUBPROCESS,
            name=description,
            origin="auto.subprocess.stdlib.subprocess",
            only_if_parent=True,
        ) as span:
            for k, v in sentry_sdk_alpha.get_current_scope().iter_trace_propagation_headers(
                span=span
            ):
                if env is None:
                    env = _init_argument(
                        a,
                        kw,
                        "env",
                        10,
                        lambda x: dict(x if x is not None else os.environ),
                    )
                env["SUBPROCESS_" + k.upper().replace("-", "_")] = v

            if cwd:
                span.set_attribute("subprocess.cwd", cwd)

            rv = old_popen_init(self, *a, **kw)

            span.set_tag("subprocess.pid", self.pid)

            with capture_internal_exceptions():
                thread_id, thread_name = get_current_thread_meta()
                breadcrumb_data = {
                    "subprocess.pid": self.pid,
                    SPANDATA.THREAD_ID: thread_id,
                    SPANDATA.THREAD_NAME: thread_name,
                }
                if cwd:
                    breadcrumb_data["subprocess.cwd"] = cwd

                sentry_sdk_alpha.add_breadcrumb(
                    type="subprocess",
                    category="subprocess",
                    message=description,
                    data=breadcrumb_data,
                )

            return rv

    subprocess.Popen.__init__ = sentry_patched_popen_init  # type: ignore

    old_popen_wait = subprocess.Popen.wait

    @ensure_integration_enabled(StdlibIntegration, old_popen_wait)
    def sentry_patched_popen_wait(self, *a, **kw):
        # type: (subprocess.Popen[Any], *Any, **Any) -> Any
        with sentry_sdk_alpha.start_span(
            op=OP.SUBPROCESS_WAIT,
            origin="auto.subprocess.stdlib.subprocess",
            only_if_parent=True,
        ) as span:
            span.set_tag("subprocess.pid", self.pid)
            return old_popen_wait(self, *a, **kw)

    subprocess.Popen.wait = sentry_patched_popen_wait  # type: ignore

    old_popen_communicate = subprocess.Popen.communicate

    @ensure_integration_enabled(StdlibIntegration, old_popen_communicate)
    def sentry_patched_popen_communicate(self, *a, **kw):
        # type: (subprocess.Popen[Any], *Any, **Any) -> Any
        with sentry_sdk_alpha.start_span(
            op=OP.SUBPROCESS_COMMUNICATE,
            origin="auto.subprocess.stdlib.subprocess",
            only_if_parent=True,
        ) as span:
            span.set_tag("subprocess.pid", self.pid)
            return old_popen_communicate(self, *a, **kw)

    subprocess.Popen.communicate = sentry_patched_popen_communicate  # type: ignore


def get_subprocess_traceparent_headers():
    # type: () -> EnvironHeaders
    return EnvironHeaders(os.environ, prefix="SUBPROCESS_")
