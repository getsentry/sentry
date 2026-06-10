import asyncio
import time
from collections import defaultdict
from typing import Any, AsyncIterator
from urllib.parse import urljoin

import httpx
import prometheus_client
from emmett55 import Pipe, current, response

from . import app
from .circuitbreaker import (
    CircuitBreakerManager,
    CircuitBreakerOverflow,
    CircuitBreakerWindowOverflow,
)
from .dsl import Cell
from .utils import abort_with_json

CHUNK_SIZE = 1024 * 256
REQUEST_HEADERS_FILTERED = {"host", "connection"}
RESPONSE_HEADERS_FILTERED = {
    "connection",
    "server",
    "x-sentry-subnet-organization-integration",
    "x-sentry-subnet-base-url",
    "x-sentry-subnet-signature",
    "x-sentry-subnet-path",
}
TIMEOUT_OVERRIDES = [
    (["/chunk-upload/"], 90.0),
    (["/releases/", "/files/"], 90.0),
    (["/files/dsyms/"], 90.0),
    (["/installablepreprodartifact/"], 90.0),
    (["/objectstore/"], 90.0),
    (["/preprodartifacts/snapshots/", "/download/"], 90.0),
]


class RequestyBodyHttpxGlue(httpx._types.AsyncByteStream):
    __slots__ = ["_body"]

    def __init__(self, body: Any):
        self._body = body

    async def __aiter__(self) -> AsyncIterator[bytes]:
        async for chunk in self._body:
            yield chunk


class ResponseCookieGlue:
    __slots__ = ["_raw"]

    def __init__(self, raw: str):
        self._raw = raw

    def __str__(self) -> str:
        return f"set-cookie: {self._raw}"


proxy_client = httpx.AsyncClient(
    limits=httpx.Limits(
        keepalive_expiry=app.config.proxy.client_keepalive_timeout,
        max_connections=app.config.proxy.client_max_connections,
        max_keepalive_connections=app.config.proxy.client_keepalive_max_connections,
    ),
    timeout=httpx.Timeout(5.0, read=60.0),
)
circuitbreakers = CircuitBreakerManager()

metric_abort = prometheus_client.Counter(
    "apigw_proxy_request_aborted", "Requests aborted", labelnames=["route", "target"]
)
metric_failed = prometheus_client.Counter(
    "apigw_proxy_request_failed", "Requests failed", labelnames=["route", "target"]
)
metric_timeout = prometheus_client.Counter(
    "apigw_proxy_request_timeout", "Requests timeout", labelnames=["route", "target"]
)
metric_cb_overflow = prometheus_client.Counter(
    "apigw_proxy_circuitbreaker_overflow", "Circuitbreaker overflow", labelnames=["target"]
)
metric_cb_reject = prometheus_client.Counter(
    "apigw_proxy_circuitbreaker_rejected", "Circuitbreaker rejected", labelnames=["target"]
)
metric_latency = prometheus_client.Histogram(
    "apigw_proxy_latency",
    "Latency histogram (ms)",
    labelnames=["target"],
    buckets=app.config.proxy.latency_buckets,
)


class ProxyLatencyPipe(Pipe):
    @staticmethod
    def track(target: str) -> None:
        current._proxy_latency_data = (target, time.perf_counter_ns())

    async def open_request(self) -> None:
        current._proxy_latency_data = None

    async def close_request(self) -> None:
        if not current._proxy_latency_data:
            return
        target, ts = current._proxy_latency_data
        metric_latency.labels(target=target).observe((time.perf_counter_ns() - ts) / 1_000_000)


def build_proxied_headers(
    request: Any, target: str, pass_host: bool = False
) -> list[tuple[str, str]]:
    rv = []
    forwarded_added = False
    client_host = request._scope.client.rsplit(":", 1)[0]
    server_host = httpx.URL(target)._uri_reference.netloc
    if pass_host:
        server_host = request.host or server_host
    rv.append(("host", server_host))
    for key in request.headers.keys():
        if key in REQUEST_HEADERS_FILTERED:
            continue
        if key == "x-forwarded-for":
            val = request.headers.get_all(key)
            val.append(client_host)
            rv.append((key, ", ".join(val)))
            forwarded_added = True
            continue
        for val in request.headers.get_all(key):
            rv.append((key, val))
    if not forwarded_added:
        rv.append(("x-forwarded-for", client_host))
    return rv


def build_proxied_cell_headers(request: Any, target: str) -> list[tuple[str, str]]:
    rv = build_proxied_headers(request, target)
    rv.append(("x-apigateway", "true"))
    return rv


def build_proxied_request(
    client: httpx.AsyncClient,
    url: str,
    method: str,
    headers: list[tuple[str, str]],
    params: dict[str, Any],
    content: Any,
    timeout: Any,
) -> httpx.Request:
    #: manually construct the request to avoid `httpx` headers/content encoding
    return httpx.Request(
        method,
        url,
        params=params,
        headers=headers,
        stream=RequestyBodyHttpxGlue(content),
        extensions={"timeout": (httpx.Timeout(timeout) if timeout else client.timeout).as_dict()},
    )


def get_cell_address(cell: Cell) -> str:
    if app.config.endpoints.use_cell_gw and cell.api_gateway_address:
        return cell.api_gateway_address
    return cell.address


def get_timeout(path: str) -> float | None:
    for segments, timeout in TIMEOUT_OVERRIDES:
        if all(segment in path for segment in segments):
            return timeout
    return app.config.proxy.timeout


def adapt_response(presp: httpx.Response) -> Any:
    response.status = presp.status_code
    headers: dict[str, list[str]] = defaultdict(list)
    cookies: list[str] = []
    for key, val in presp.headers.multi_items():
        if key in RESPONSE_HEADERS_FILTERED:
            continue
        if key == "set-cookie":
            cookies.append(val)
            continue
        headers[key].append(val)
    for key, vals in headers.items():
        response.headers[key] = ",".join(vals)
    response.cookies = {
        f"_proxied{idx}": ResponseCookieGlue(val) for idx, val in enumerate(cookies)
    }
    return response.stream(presp.aiter_raw(CHUNK_SIZE))


async def proxy_cell_request(cell: Cell, request: Any) -> Any:
    target_url = urljoin(get_cell_address(cell), request.path)
    headers = build_proxied_cell_headers(request, cell.address)
    timeout = get_timeout(request.path)

    try:
        async with circuitbreakers.get(cell.name) as circuitbreaker:
            try:
                req = build_proxied_request(
                    proxy_client,
                    target_url,
                    method=request.method,
                    headers=headers,
                    params=dict(request.query_params),
                    content=request.body,
                    timeout=timeout,
                )
                ProxyLatencyPipe.track(cell.name)
                resp = await proxy_client.send(req, stream=True, follow_redirects=False)
                if resp.status_code >= 502:
                    circuitbreaker.incr_failures()
                return await adapt_response(resp)
            except asyncio.CancelledError:
                metric_abort.labels(route=request.name, target=cell.name).inc()
                raise
            except httpx.ConnectError:
                metric_failed.labels(route=request.name, target=cell.name).inc()
                circuitbreaker.incr_failures()
                abort_with_json(
                    503, {"error": "apigateway", "detail": "Downstream service unavailable"}
                )
            except httpx.TimeoutException:
                metric_timeout.labels(route=request.name, target=cell.name).inc()
                circuitbreaker.incr_failures()
                abort_with_json(504, {"error": "apigateway", "detail": "Downstream timeout"})
            except httpx.RequestError:
                app.log.exception("APIGateway(cell) httpx request error")
                metric_failed.labels(route=request.name, target=cell.name).inc()
                circuitbreaker.incr_failures()
                abort_with_json(502, {"error": "apigateway", "detail": "Downstream error"})
    except CircuitBreakerOverflow:
        metric_cb_overflow.labels(target=cell.name).inc()
        abort_with_json(429, {"error": "apigateway", "detail": "Too many requests"})
    except CircuitBreakerWindowOverflow:
        metric_cb_reject.labels(target=cell.name).inc()
        abort_with_json(503, {"error": "apigateway", "detail": "Downstream service unavailable"})


async def proxy_control_request(request: Any) -> Any:
    target_url = urljoin(app.config.endpoints.control, request.path)
    headers = build_proxied_headers(request, app.config.endpoints.control, pass_host=True)

    try:
        req = build_proxied_request(
            proxy_client,
            target_url,
            method=request.method,
            headers=headers,
            params=dict(request.query_params),
            content=request.body,
            timeout=app.config.proxy.timeout,
        )
        ProxyLatencyPipe.track("control")
        resp = await proxy_client.send(req, stream=True, follow_redirects=False)
        return await adapt_response(resp)
    except asyncio.CancelledError:
        metric_abort.labels(route=request.name, target="control").inc()
        raise
    except httpx.ConnectError:
        metric_failed.labels(route=request.name, target="control").inc()
        abort_with_json(503, {"error": "apigateway", "detail": "Downstream service unavailable"})
    except httpx.TimeoutException:
        metric_timeout.labels(route=request.name, target="control").inc()
        abort_with_json(504, {"error": "apigateway", "detail": "Downstream timeout"})
    except httpx.RequestError:
        app.log.exception("APIGateway(control) httpx request error")
        metric_failed.labels(route=request.name, target="control").inc()
        abort_with_json(502, {"error": "apigateway", "detail": "Downstream error"})
