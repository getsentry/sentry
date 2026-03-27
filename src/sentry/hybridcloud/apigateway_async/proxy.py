"""
Utilities related to proxying a request to a cell
"""

from __future__ import annotations

import asyncio
import logging
from collections.abc import AsyncGenerator, AsyncIterator
from urllib.parse import urljoin, urlparse
from wsgiref.util import is_hop_by_hop

import httpx
from asgiref.sync import sync_to_async
from django.conf import settings
from django.http import HttpRequest, HttpResponse, JsonResponse, StreamingHttpResponse
from django.http.response import HttpResponseBase

from sentry import options
from sentry.api.exceptions import RequestTimeout
from sentry.objectstore.endpoints.organization import get_raw_body_async
from sentry.silo.util import (
    PROXY_APIGATEWAY_HEADER,
    PROXY_DIRECT_LOCATION_HEADER,
    clean_outbound_headers,
    clean_proxy_headers,
)
from sentry.types.cell import (
    Cell,
    CellResolutionError,
    get_cell_by_name,
    get_cell_for_organization,
)
from sentry.utils import metrics
from sentry.utils.http import BodyAsyncWrapper

from .circuitbreaker import (
    CircuitBreakerManager,
    CircuitBreakerOverflow,
    CircuitBreakerWindowOverflow,
)

logger = logging.getLogger(__name__)

proxy_client = httpx.AsyncClient()
circuitbreakers = CircuitBreakerManager()

# Endpoints that handle uploaded files have higher timeouts configured
# and we need to honor those timeouts when proxying.
# See frontend/templates/sites-enabled/sentry.io in getsentry/ops
ENDPOINT_TIMEOUT_OVERRIDE = {
    "sentry-api-0-chunk-upload": 90.0,
    "sentry-api-0-organization-release-files": 90.0,
    "sentry-api-0-project-release-files": 90.0,
    "sentry-api-0-dsym-files": 90.0,
    "sentry-api-0-installable-preprod-artifact-download": 90.0,
    "sentry-api-0-project-preprod-artifact-download": 90.0,
    "sentry-api-0-organization-preprod-artifact-size-analysis-download": 90.0,
    "sentry-api-0-organization-objectstore": 90.0,
}

# stream 0.5 MB at a time
PROXY_CHUNK_SIZE = 512 * 1024


async def _stream_response_and_close(response: httpx.Response) -> AsyncGenerator[bytes]:
    """Yield chunks from an httpx response and close the connection when done."""
    try:
        async for chunk in response.aiter_bytes(PROXY_CHUNK_SIZE):
            yield chunk
    finally:
        await response.aclose()


def _adapt_response(response: httpx.Response, remote_url: str) -> StreamingHttpResponse:
    """Convert an httpx Response into a Django response."""

    new_headers = clean_outbound_headers(response.headers)
    content_type = new_headers.pop("Content-Type", None)

    streamed_response = StreamingHttpResponse(
        streaming_content=_stream_response_and_close(response),
        status=response.status_code,
        content_type=content_type,
    )

    for header, value in new_headers.items():
        if not is_hop_by_hop(header):
            streamed_response[header] = value

    streamed_response[PROXY_DIRECT_LOCATION_HEADER] = remote_url
    return streamed_response


async def _stream_request(body: AsyncIterator[bytes]) -> AsyncGenerator[bytes]:
    async for chunk in body:
        yield chunk


async def proxy_request(
    request: HttpRequest,
    org_id_or_slug: str,
    url_name: str,
) -> HttpResponseBase:
    """Take a django request object and proxy it to a remote location given an org_id_or_slug"""

    try:
        cell = await sync_to_async(get_cell_for_organization)(org_id_or_slug)
    except CellResolutionError as e:
        logger.info("region_resolution_error", extra={"org_slug": org_id_or_slug, "error": str(e)})
        return HttpResponse(status=404)

    return await proxy_cell_request(request, cell, url_name)


async def proxy_error_embed_request(
    request: HttpRequest, dsn: str, url_name: str
) -> HttpResponseBase | None:
    try:
        parsed = urlparse(dsn)
    except Exception as err:
        logger.info("apigateway.error_embed.invalid_dsn", extra={"dsn": dsn, "error": err})
        return None
    host = parsed.netloc
    app_host = urlparse(options.get("system.url-prefix")).netloc
    if not host.endswith(app_host):
        # Don't further parse URLs that aren't for us.
        return None

    app_segments = app_host.split(".")
    host_segments = host.split(".")
    if len(host_segments) - len(app_segments) < 3:
        # If we don't have a o123.ingest.{cell}.{app_host} style domain
        # we forward to the monolith cell
        cell = get_cell_by_name(settings.SENTRY_MONOLITH_REGION)
        return await proxy_cell_request(request, cell, url_name)
    try:
        cell_offset = len(app_segments) + 1
        cell_segment = host_segments[cell_offset * -1]
        cell = get_cell_by_name(cell_segment)
    except Exception:
        return None

    return await proxy_cell_request(request, cell, url_name)


async def proxy_cell_request(
    request: HttpRequest,
    cell: Cell,
    url_name: str,
) -> HttpResponseBase:
    """Take a django request object and proxy it to a cell silo"""
    metric_tags = {"region": cell.name, "url_name": url_name}
    target_url = urljoin(cell.address, request.path)

    content_encoding = request.headers.get("Content-Encoding")
    content_length = request.headers.get("Content-Length")
    header_dict = clean_proxy_headers(request.headers)
    header_dict[PROXY_APIGATEWAY_HEADER] = "true"

    assert request.method is not None
    query_params = request.GET

    timeout = ENDPOINT_TIMEOUT_OVERRIDE.get(url_name, settings.GATEWAY_PROXY_TIMEOUT)

    # XXX: See sentry.testutils.pytest.sentry for more information
    if settings.APIGATEWAY_PROXY_SKIP_RELAY and request.path.startswith("/api/0/relays/"):
        return StreamingHttpResponse(streaming_content="relay proxy skipped", status=404)

    try:
        async with circuitbreakers.get(cell.name) as circuitbreaker:
            if url_name == "sentry-api-0-organization-objectstore":
                if content_encoding:
                    header_dict["Content-Encoding"] = content_encoding
                data = get_raw_body_async(request)
            else:
                data = BodyAsyncWrapper(request.body)
                # With request streaming, and without `Content-Length` header,
                # `httpx` will set chunked transfer encoding.
                # Upstream doesn't necessarily support this,
                # thus we re-add the header if it was present in the original request.
                if content_length:
                    header_dict["Content-Length"] = content_length

            try:
                with metrics.timer("apigateway.proxy_request.duration", tags=metric_tags):
                    req = proxy_client.build_request(
                        request.method,
                        target_url,
                        headers=header_dict,
                        params=dict(query_params) if query_params is not None else None,
                        content=_stream_request(data) if data else None,  # type: ignore[arg-type]
                        timeout=timeout,
                    )
                    resp = await proxy_client.send(req, stream=True, follow_redirects=False)
                    if resp.status_code >= 502:
                        metrics.incr("apigateway.proxy.request_failed", tags=metric_tags)
                        circuitbreaker.incr_failures()
                    return _adapt_response(resp, target_url)
            except (httpx.TimeoutException, asyncio.CancelledError):
                metrics.incr("apigateway.proxy.request_timeout", tags=metric_tags)
                circuitbreaker.incr_failures()
                # remote silo timeout. Use DRF timeout instead
                raise RequestTimeout()
            except httpx.RequestError:
                metrics.incr("apigateway.proxy.request_failed", tags=metric_tags)
                circuitbreaker.incr_failures()
                raise
    except CircuitBreakerOverflow:
        metrics.incr("apigateway.proxy.circuit_breaker.overflow", tags=metric_tags)
        return JsonResponse(
            {"error": "apigateway", "detail": "Too many requests"},
            status=429,
        )
    except CircuitBreakerWindowOverflow:
        metrics.incr("apigateway.proxy.circuit_breaker.rejected", tags=metric_tags)
        return JsonResponse(
            {"error": "apigateway", "detail": "Downstream service temporarily unavailable"},
            status=503,
        )
