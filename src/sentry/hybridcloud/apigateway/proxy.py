"""
Utilities related to proxying a request to a region silo
"""
from __future__ import annotations

import logging
from typing import Iterator
from urllib.parse import urljoin
from wsgiref.util import is_hop_by_hop

from django.conf import settings
from django.http import HttpRequest, HttpResponse, StreamingHttpResponse
from django.http.response import HttpResponseBase
from requests import Response as ExternalResponse
from requests import request as external_request
from requests.exceptions import Timeout

from sentry.api.exceptions import RequestTimeout
from sentry.models.integrations.sentry_app import SentryApp
from sentry.models.integrations.sentry_app_installation import SentryAppInstallation
from sentry.models.organizationmapping import OrganizationMapping
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

logger = logging.getLogger(__name__)

# stream 0.5 MB at a time
PROXY_CHUNK_SIZE = 512 * 1024


def _parse_response(response: ExternalResponse, remote_url: str) -> StreamingHttpResponse:
    """
    Convert the Responses class from requests into the drf Response
    """

    def stream_response():
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

    request: HttpRequest

    def __init__(self, request: HttpRequest):
        self.request = request

    def __iter__(self) -> Iterator[bytes]:
        return iter(self.request)

    def __len__(self) -> int:
        return int(self.request.headers.get("Content-Length", "0"))

    def read(self, size: int | None = None) -> bytes:
        return self.request.read(size)


def proxy_request(request: HttpRequest, org_slug: str) -> HttpResponseBase:
    """Take a django request object and proxy it to a remote location given an org_slug"""

    try:
        region = get_region_for_organization(org_slug)
    except RegionResolutionError as e:
        logger.info("region_resolution_error", extra={"org_slug": org_slug, "error": str(e)})
        return HttpResponse(status=404)

    return proxy_region_request(request, region)


def proxy_sentryappinstallation_request(
    request: HttpRequest, installation_uuid: str
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

    return proxy_region_request(request, region)


def proxy_sentryapp_request(request: HttpRequest, app_slug: str) -> HttpResponseBase:
    """Take a django request object and proxy it to the region of the organization that owns a sentryapp"""
    try:
        sentry_app = SentryApp.objects.get(slug=app_slug)
    except SentryApp.DoesNotExist as e:
        logger.info("region_resolution_error", extra={"app_slug": app_slug, "error": str(e)})
        return HttpResponse(status=404)

    try:
        organization_mapping = OrganizationMapping.objects.get(organization_id=sentry_app.owner_id)
        region = get_region_by_name(organization_mapping.region_name)
    except (RegionResolutionError, OrganizationMapping.DoesNotExist) as e:
        logger.info("region_resolution_error", extra={"app_slug": app_slug, "error": str(e)})
        return HttpResponse(status=404)

    return proxy_region_request(request, region)


def proxy_region_request(request: HttpRequest, region: Region) -> StreamingHttpResponse:
    """Take a django request object and proxy it to a region silo"""
    target_url = urljoin(region.address, request.path)
    header_dict = clean_proxy_headers(request.headers)
    # TODO: use requests session for connection pooling capabilities
    assert request.method is not None
    query_params = request.GET
    try:
        assert not request._read_started  # type: ignore
        resp = external_request(
            request.method,
            url=target_url,
            headers=header_dict,
            params=dict(query_params) if query_params is not None else None,
            data=_body_with_length(request),  # type: ignore
            stream=True,
            timeout=settings.GATEWAY_PROXY_TIMEOUT,
        )
    except Timeout:
        # remote silo timeout. Use DRF timeout instead
        raise RequestTimeout()

    new_headers = clean_outbound_headers(resp.headers)
    resp.headers.clear()
    resp.headers.update(new_headers)
    return _parse_response(resp, target_url)
