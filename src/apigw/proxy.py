import asyncio
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

CHUNK_SIZE = 1024 * 256
REQUEST_HEADERS_FILTERED = {"host"}
RESPONSE_HEADERS_FILTERED = {
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


def build_proxied_headers(request):
    rv = []
    forwarded_added = False
    client_host = request._scope.client.split(":", 1)[0]
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


def build_proxied_cell_headers(request):
    rv = build_proxied_headers(request)
    rv.append(("x-apigateway", "true"))
    return rv


def get_timeout(path):
    for segments, timeout in TIMEOUT_OVERRIDES:
        if all(segment in path for segment in segments):
            return timeout
    return app.config.proxy.timeout


def adapt_cell_response(presp, remote_url):
    response.status = presp.status_code
    for key, val in presp.headers.items():
        if key in RESPONSE_HEADERS_FILTERED:
            continue
        response.headers[key] = val
    response.headers["x-sentry-proxy-url"] = remote_url
    return response.stream(presp.aiter_raw(CHUNK_SIZE))


def adapt_control_response(presp):
    response.status = presp.status_code
    for key, val in presp.headers.items():
        response.headers[key] = val
    return response.stream(presp.aiter_raw(CHUNK_SIZE))


async def proxy_cell_request(cell, request):
    target_url = urljoin(cell.address, request.path)
    headers = build_proxied_cell_headers(request)
    timeout = get_timeout(request.path)

    try:
        async with circuitbreakers.get(cell.name) as circuitbreaker:
            try:
                req = proxy_client.build_request(
                    request.method,
                    target_url,
                    headers=headers,
                    params=dict(request.query_params),
                    content=request.body,
                    timeout=timeout or httpx.USE_CLIENT_DEFAULT,
                )
                resp = await proxy_client.send(req, stream=True, follow_redirects=False)
                if resp.status_code >= 502:
                    circuitbreaker.incr_failures()
                return await adapt_cell_response(resp, target_url)
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


async def proxy_control_request(request):
    target_url = urljoin(app.config.endpoints.control, request.path)
    headers = build_proxied_headers(request)

    try:
        req = proxy_client.build_request(
            request.method,
            target_url,
            headers=headers,
            params=dict(request.query_params),
            content=request.body,
            timeout=app.config.proxy.timeout or httpx.USE_CLIENT_DEFAULT,
        )
        resp = await proxy_client.send(req, stream=True, follow_redirects=False)
        return await adapt_control_response(resp)
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
        metric_failed.labels(route=request.name, target="control").inc()
        response.status = 502
        response.content_type = "application/json"
        return json({"error": "apigateway", "detail": "Downstream error"})
