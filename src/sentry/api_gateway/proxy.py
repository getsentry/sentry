"""
Utilities related to proxying a request to a region silo
"""
import logging
from wsgiref.util import is_hop_by_hop

from django.conf import settings
from django.http import HttpRequest, StreamingHttpResponse
from requests import Response as ExternalResponse
from requests import request as external_request
from requests.exceptions import Timeout
from rest_framework.exceptions import NotFound

from sentry.api.exceptions import RequestTimeout
from sentry.silo.util import (
    PROXY_DIRECT_LOCATION_HEADER,
    clean_outbound_headers,
    clean_proxy_headers,
)
from sentry.types.region import RegionResolutionError

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


def proxy_request(request: HttpRequest, org_slug: str) -> StreamingHttpResponse:
    """Take a django request object and proxy it to a remote location given an org_slug"""
    from sentry.types.region import get_region_for_organization

    try:
        region = get_region_for_organization(org_slug)
    except RegionResolutionError as e:
        logger.info("region_resolution_error", extra={"org_slug": org_slug})
        raise NotFound from e

    target_url = region.to_url(request.path)
    header_dict = clean_proxy_headers(request.headers)
    # TODO: use requests session for connection pooling capabilities
    assert request.method is not None
    query_params = getattr(request, request.method, None)
    try:
        resp = external_request(
            request.method,
            url=target_url,
            headers=header_dict,
            params=dict(query_params) if query_params is not None else None,
            files=getattr(request, "FILES", None),
            data=getattr(request, "body", None) if not getattr(request, "FILES", None) else None,
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
