"""
Utilities related to proxying a request to a cell
"""

from __future__ import annotations

import logging
from collections.abc import Callable, Generator
from http.cookiejar import Cookie
from threading import local
from typing import Any
from urllib.parse import urljoin
from wsgiref.util import is_hop_by_hop

from django.conf import settings
from django.http import HttpRequest, HttpResponse, JsonResponse, StreamingHttpResponse
from django.http.response import HttpResponseBase
from requests import Response as ExternalResponse
from requests import Session
from requests import request as external_request
from requests.cookies import RequestsCookieJar
from requests.exceptions import ConnectionError, Timeout

from sentry import options
from sentry.objectstore.endpoints.organization import ChunkedEncodingDecoder, get_raw_body
from sentry.options.rollout import in_random_rollout
from sentry.silo.util import (
    PRESERVE_CONTENT_ENCODING_URL_NAMES,
    PROXY_APIGATEWAY_HEADER,
    PROXY_DIRECT_LOCATION_HEADER,
    clean_outbound_headers,
    clean_proxy_headers,
)
from sentry.types.cell import (
    Cell,
    CellResolutionError,
    get_cell_for_organization,
)
from sentry.utils import metrics
from sentry.utils.circuit_breaker2 import CircuitBreaker, CountBasedTripStrategy
from sentry.utils.http import BodyWithLength

logger = logging.getLogger(__name__)

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
    "sentry-api-0-organization-preprod-snapshots-archive": 90.0,
}

# stream 0.5 MB at a time
PROXY_CHUNK_SIZE = 512 * 1024

_connection = local()


class _StatelessCookieJar(RequestsCookieJar):
    def set_cookie(self, cookie: Cookie, *args: Any, **kwargs: Any) -> None:
        return None

    def extract_cookies(self, response: Any, request: Any) -> None:
        return None


def _get_connection() -> Session:
    if not hasattr(_connection, "session"):
        session = Session()
        session.cookies = _StatelessCookieJar()
        _connection.session = session
    return _connection.session


def _parse_response(response: ExternalResponse, remote_url: str) -> StreamingHttpResponse:
    """
    Convert the Responses class from requests into the drf Response
    """

    def stream_response() -> Generator[bytes]:
        try:
            yield from response.iter_content(PROXY_CHUNK_SIZE)
        finally:
            response.close()

    streamed_response = StreamingHttpResponse(
        streaming_content=stream_response(),
        status=response.status_code,
        content_type=response.headers.pop("Content-Type", None),
    )
    # Add Headers to response
    for header, value in response.headers.items():
        if not is_hop_by_hop(header):
            streamed_response[header] = value

    streamed_response[PROXY_DIRECT_LOCATION_HEADER] = remote_url
    return streamed_response


def proxy_request(request: HttpRequest, org_id_or_slug: str, url_name: str) -> HttpResponseBase:
    """Take a django request object and proxy it to a remote location given an org_id_or_slug"""

    try:
        cell = get_cell_for_organization(org_id_or_slug)
    except CellResolutionError as e:
        logger.info("region_resolution_error", extra={"org_slug": org_id_or_slug, "error": str(e)})
        return HttpResponse(status=404)

    metrics.incr(
        "apigateway.proxy_request",
        tags={
            "url_name": url_name,
            "kind": "orgslug",
            "target": cell.name,
            "request_method": request.method,
        },
    )
    return proxy_cell_request(request, cell, url_name)


def proxy_cell_request(request: HttpRequest, cell: Cell, url_name: str) -> HttpResponseBase:
    """Take a django request object and proxy it to a cell silo"""

    host = cell.address
    if cell.api_gateway_address:
        host = cell.api_gateway_address

    metric_tags = {
        "destination_cell": cell.name,
        "url_name": url_name,
        "destination_host": host,
        "request_method": request.method,
    }
    circuit_breaker: CircuitBreaker | None = None
    use_pooling = in_random_rollout("hybridcloud.apigateway.use_pooling.rate")

    # TODO(mark) remove rollout options
    if options.get("apigateway.proxy.circuit-breaker.enabled"):
        try:
            circuit_breaker = CircuitBreaker(
                key=f"apigateway.proxy.{cell.name}",
                config=options.get("apigateway.proxy.circuit-breaker.config"),
                trip_strategy=CountBasedTripStrategy.from_config(
                    options.get("apigateway.proxy.circuit-breaker.config")
                ),
            )
        except Exception as e:
            logger.warning("apigateway.invalid-breaker-config", extra={"error": str(e)})

    if circuit_breaker is not None:
        if not circuit_breaker.should_allow_request():
            metrics.incr("apigateway.proxy.circuit_breaker.rejected", tags=metric_tags)
            if options.get("apigateway.proxy.circuit-breaker.enforce"):
                body = {
                    "error": "apigateway",
                    "detail": "Downstream service temporarily unavailable",
                }
                return JsonResponse(body, status=503)

    target_url = urljoin(host, request.path)

    if settings.APIGW_WARN_REQS:
        logger.warning("apigateway.legacy-sync-request", extra={"endpoint": target_url})

    content_encoding = request.headers.get("Content-Encoding")
    header_dict = clean_proxy_headers(request.headers)
    header_dict[PROXY_APIGATEWAY_HEADER] = "true"

    assert request.method is not None
    query_string = request.META.get("QUERY_STRING")
    request_url = f"{target_url}?{query_string}" if query_string else target_url

    # This option has a default of None, which is cast to 0
    timeout = options.get("apigateway.proxy.timeout")
    if not timeout:
        timeout = settings.GATEWAY_PROXY_TIMEOUT
    timeout = ENDPOINT_TIMEOUT_OVERRIDE.get(url_name, timeout)

    # XXX: See sentry.testutils.pytest.sentry for more information
    if settings.APIGATEWAY_PROXY_SKIP_RELAY and request.path.startswith("/api/0/relays/"):
        return StreamingHttpResponse(streaming_content="relay proxy skipped", status=404)

    if content_encoding and url_name in PRESERVE_CONTENT_ENCODING_URL_NAMES:
        header_dict["Content-Encoding"] = content_encoding

    data: bytes | Generator[bytes] | ChunkedEncodingDecoder | BodyWithLength | None = None
    if url_name == "sentry-api-0-organization-objectstore":
        data = get_raw_body(request)
    else:
        data = BodyWithLength(request)

    # When pooling is enabled, reuse the thread-local session to keep connections
    # alive across requests; otherwise issue a one-off request.
    requester: Callable[..., ExternalResponse] = (
        _get_connection().request if use_pooling else external_request
    )

    try:
        with metrics.timer("apigateway.proxy_request.duration", tags=metric_tags):
            resp = requester(
                request.method,
                url=request_url,
                headers=header_dict,
                data=data,
                stream=True,
                timeout=timeout,
                # By default, requests resolves redirects for every verb except HEAD.
                # Disable that to avoid misrepresenting the original sentry.io request.
                allow_redirects=False,
            )
    except Timeout:
        metrics.incr("apigateway.proxy.request_timeout", tags=metric_tags)
        if circuit_breaker is not None:
            circuit_breaker.record_error()

        return JsonResponse(
            {"error": "apigateway", "detail": "Proxied request timed out"},
            status=500,
        )
    except ConnectionError:
        metrics.incr("apigateway.proxy.connection_error", tags=metric_tags)
        if circuit_breaker is not None:
            circuit_breaker.record_error()

        return JsonResponse(
            {"error": "apigateway", "detail": "Downstream service unavailable"},
            status=500,
        )

    if resp.status_code >= 502:
        metrics.incr("apigateway.proxy.request_failed", tags=metric_tags)
        if circuit_breaker is not None:
            circuit_breaker.record_error()

    new_headers = clean_outbound_headers(resp.headers)
    resp.headers.clear()
    resp.headers.update(new_headers)
    return _parse_response(resp, target_url)
