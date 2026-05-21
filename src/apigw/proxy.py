import asyncio
from typing import Any, AsyncIterator
from urllib.parse import urljoin

import httpx
import prometheus_client
from emmett55 import response

from . import app, json
from .circuitbreaker import (
    CircuitBreakerManager,
    CircuitBreakerOverflow,
    CircuitBreakerWindowOverflow,
)
from .dsl import Cell

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
]


class RequestyBodyHttpxGlue(httpx._types.AsyncByteStream):
    __slots__ = ["_body"]

    def __init__(self, body: Any):
        self._body = body

    async def __aiter__(self) -> AsyncIterator[bytes]:
        async for chunk in self._body:
            yield chunk


proxy_client = httpx.AsyncClient(timeout=httpx.Timeout(5.0, read=60.0))
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


def build_proxied_headers(request: Any, target: str) -> list[tuple[str, str]]:
    rv = []
    forwarded_added = False
    client_host = request._scope.client.rsplit(":", 1)[0]
    server_host = httpx.URL(target)._uri_reference.netloc
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
    rv.append(("host", server_host))
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


def get_timeout(path: str) -> float | None:
    for segments, timeout in TIMEOUT_OVERRIDES:
        if all(segment in path for segment in segments):
            return timeout
    return app.config.proxy.timeout


def adapt_response(presp: httpx.Response) -> Any:
    response.status = presp.status_code
    for key, val in presp.headers.items():
        if key in RESPONSE_HEADERS_FILTERED:
            continue
        response.headers[key] = val
    return response.stream(presp.aiter_raw(CHUNK_SIZE))


async def proxy_cell_request(cell: Cell, request: Any) -> Any:
    target_url = urljoin(cell.address, request.path)
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
                response.status = 503
                response.content_type = "application/json"
                return json({"error": "apigateway", "detail": "Downstream service unavailable"})
            except httpx.TimeoutException:
                metric_timeout.labels(route=request.name, target=cell.name).inc()
                circuitbreaker.incr_failures()
                response.status = 504
                response.content_type = "application/json"
                return json({"error": "apigateway", "detail": "Downstream timeout"})
            except httpx.RequestError:
                app.log.exception("APIGateway(cell) httpx request error")
                metric_failed.labels(route=request.name, target=cell.name).inc()
                circuitbreaker.incr_failures()
                response.status = 502
                response.content_type = "application/json"
                return json({"error": "apigateway", "detail": "Downstream error"})
    except CircuitBreakerOverflow:
        metric_cb_overflow.labels(target=cell.name).inc()
        response.status = 429
        response.content_type = "application/json"
        return json({"error": "apigateway", "detail": "Too many requests"})
    except CircuitBreakerWindowOverflow:
        metric_cb_reject.labels(target=cell.name).inc()
        response.status = 503
        response.content_type = "application/json"
        return json({"error": "apigateway", "detail": "Downstream service unavailable"})


async def proxy_control_request(request: Any) -> Any:
    target_url = urljoin(app.config.endpoints.control, request.path)
    headers = build_proxied_headers(request, app.config.endpoints.control)

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
        resp = await proxy_client.send(req, stream=True, follow_redirects=False)
        return await adapt_response(resp)
    except asyncio.CancelledError:
        metric_abort.labels(route=request.name, target="control").inc()
        raise
    except httpx.ConnectError:
        metric_failed.labels(route=request.name, target="control").inc()
        response.status = 503
        response.content_type = "application/json"
        return json({"error": "apigateway", "detail": "Downstream service unavailable"})
    except httpx.TimeoutException:
        metric_timeout.labels(route=request.name, target="control").inc()
        response.status = 504
        response.content_type = "application/json"
        return json({"error": "apigateway", "detail": "Downstream timeout"})
    except httpx.RequestError:
        app.log.exception("APIGateway(control) httpx request error")
        metric_failed.labels(route=request.name, target="control").inc()
        response.status = 502
        response.content_type = "application/json"
        return json({"error": "apigateway", "detail": "Downstream error"})
