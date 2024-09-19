"""
Utilities related to proxying a request to a region silo
"""

from __future__ import annotations

import logging
from collections.abc import Generator, Iterator
from urllib.parse import urljoin, urlparse
from wsgiref.util import is_hop_by_hop

from django.conf import settings
from django.http import HttpRequest, HttpResponse, StreamingHttpResponse
from django.http.response import HttpResponseBase
from requests import Response as ExternalResponse
from requests import request as external_request
from requests.exceptions import Timeout

from sentry import options
from sentry.api.exceptions import RequestTimeout
from sentry.models.organizationmapping import OrganizationMapping
from sentry.sentry_apps.models.sentry_app import SentryApp
from sentry.sentry_apps.models.sentry_app_installation import SentryAppInstallation
from sentry.silo.util import (
    PROXY_DIRECT_LOCATION_HEADER,
    clean_outbound_headers,
    clean_proxy_headers,
)
from sentry.types.region import (
    Region,
    RegionResolutionError,
    get_region_by_name,
    get_region_for_organization,
)
from sentry.utils import metrics

logger = logging.getLogger(__name__)

# Endpoints that handle uploaded files have higher timeouts configured
# and we need to honor those timeouts when proxying.
# See frontend/templates/sites-enabled/sentry.io in getsentry/ops
ENDPOINT_TIMEOUT_OVERRIDE = {
    "sentry-api-0-chunk-upload": 90.0,
    "sentry-api-0-organization-release-files": 90.0,
    "sentry-api-0-project-release-files": 90.0,
    "sentry-api-0-dsym-files": 90.0,
}

# stream 0.5 MB at a time
PROXY_CHUNK_SIZE = 512 * 1024


def _parse_response(response: ExternalResponse, remote_url: str) -> StreamingHttpResponse:
    """
    Convert the Responses class from requests into the drf Response
    """

    def stream_response() -> Generator[bytes]:
        yield from response.iter_content(PROXY_CHUNK_SIZE)

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


class _body_with_length:
    """Wraps an HttpRequest with a __len__ so that the request library does not assume length=0 in all cases"""

    def __init__(self, request: HttpRequest):
        self.request = request

    def __iter__(self) -> Iterator[bytes]:
        return iter(self.request)

    def __len__(self) -> int:
        return int(self.request.headers.get("Content-Length", "0"))

    def read(self, size: int | None = None) -> bytes:
        return self.request.read(size)


def proxy_request(request: HttpRequest, org_id_or_slug: str, url_name: str) -> HttpResponseBase:
    """Take a django request object and proxy it to a remote location given an org_id_or_slug"""

    try:
        region = get_region_for_organization(org_id_or_slug)
    except RegionResolutionError as e:
        logger.info("region_resolution_error", extra={"org_slug": org_id_or_slug, "error": str(e)})
        return HttpResponse(status=404)

    return proxy_region_request(request, region, url_name)


def proxy_sentryappinstallation_request(
    request: HttpRequest, installation_uuid: str, url_name: str
) -> HttpResponseBase:
    """Take a django request object and proxy it to a remote location given a sentryapp installation uuid"""
    try:
        installation = SentryAppInstallation.objects.get(uuid=installation_uuid)
    except SentryAppInstallation.DoesNotExist as e:
        logger.info(
            "region_resolution_error",
            extra={"installation_uuid": installation_uuid, "error": str(e)},
        )
        return HttpResponse(status=404)

    try:
        organization_mapping = OrganizationMapping.objects.get(
            organization_id=installation.organization_id
        )
        region = get_region_by_name(organization_mapping.region_name)
    except (RegionResolutionError, OrganizationMapping.DoesNotExist) as e:
        logger.info(
            "region_resolution_error", extra={"installation_id": installation_uuid, "error": str(e)}
        )
        return HttpResponse(status=404)

    return proxy_region_request(request, region, url_name)


def proxy_sentryapp_request(
    request: HttpRequest, app_id_or_slug: str, url_name: str
) -> HttpResponseBase:
    """Take a django request object and proxy it to the region of the organization that owns a sentryapp"""
    try:
        if app_id_or_slug.isdecimal():
            sentry_app = SentryApp.objects.get(id=app_id_or_slug)
        else:
            sentry_app = SentryApp.objects.get(slug=app_id_or_slug)
    except SentryApp.DoesNotExist as e:
        logger.info("region_resolution_error", extra={"app_slug": app_id_or_slug, "error": str(e)})
        return HttpResponse(status=404)

    try:
        organization_mapping = OrganizationMapping.objects.get(organization_id=sentry_app.owner_id)
        region = get_region_by_name(organization_mapping.region_name)
    except (RegionResolutionError, OrganizationMapping.DoesNotExist) as e:
        logger.info("region_resolution_error", extra={"app_slug": app_id_or_slug, "error": str(e)})
        return HttpResponse(status=404)

    return proxy_region_request(request, region, url_name)


def proxy_error_embed_request(
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
        # If we don't have a o123.ingest.{region}.{app_host} style domain
        # we forward to the monolith region
        region = get_region_by_name(settings.SENTRY_MONOLITH_REGION)
        return proxy_region_request(request, region, url_name)
    try:
        region_offset = len(app_segments) + 1
        region_segment = host_segments[region_offset * -1]
        region = get_region_by_name(region_segment)
    except Exception:
        return None

    return proxy_region_request(request, region, url_name)


def proxy_region_request(
    request: HttpRequest, region: Region, url_name: str
) -> StreamingHttpResponse:
    """Take a django request object and proxy it to a region silo"""
    target_url = urljoin(region.address, request.path)
    header_dict = clean_proxy_headers(request.headers)

    # TODO: use requests session for connection pooling capabilities
    assert request.method is not None
    query_params = request.GET

    timeout = ENDPOINT_TIMEOUT_OVERRIDE.get(url_name, settings.GATEWAY_PROXY_TIMEOUT)
    metric_tags = {"region": region.name, "url_name": url_name}

    # XXX: See sentry.testutils.pytest.sentry for more information
    if settings.APIGATEWAY_PROXY_SKIP_RELAY and request.path.startswith("/api/0/relays/"):
        return StreamingHttpResponse(streaming_content="relay proxy skipped", status=404)

    try:
        with metrics.timer("apigateway.proxy_request.duration", tags=metric_tags):
            resp = external_request(
                request.method,
                url=target_url,
                headers=header_dict,
                params=dict(query_params) if query_params is not None else None,
                data=_body_with_length(request),
                stream=True,
                timeout=timeout,
                # By default, external_request will resolve any redirects for any verb except for HEAD.
                # We explicitly disable this behavior to avoid misrepresenting the original sentry.io request with the
                # body response of the redirect.
                allow_redirects=False,
            )
    except Timeout:
        # remote silo timeout. Use DRF timeout instead
        raise RequestTimeout()

    new_headers = clean_outbound_headers(resp.headers)
    resp.headers.clear()
    resp.headers.update(new_headers)
    return _parse_response(resp, target_url)
