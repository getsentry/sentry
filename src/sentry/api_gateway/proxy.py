"""
Utilities related to proxying a request to a region silo
"""

from django.conf import settings
from django.http import StreamingHttpResponse
from requests import Response as ExternalResponse
from requests import request as external_request
from requests.exceptions import Timeout
from rest_framework.request import Request

from sentry.api.exceptions import RequestTimeout

# stream 0.5 MB at a time
PROXY_CHUNK_SIZE = 512 * 1024


def _parse_response(response: ExternalResponse, remote_url: str) -> StreamingHttpResponse:
    """
    Convert the Responses class from requests into the drf Response
    """

    def stream_response():  # type: ignore
        yield from response.iter_content(PROXY_CHUNK_SIZE)

    streamed_response = StreamingHttpResponse(
        streaming_content=stream_response(),
        status=response.status_code,
        content_type=response.headers.pop("Content-Type"),
    )
    # Add Headers to response
    for header, value in response.headers.items():
        streamed_response[header] = value
    streamed_response["X-Sentry-Proxy-URL"] = remote_url
    return streamed_response


def proxy_request(request: Request, org_slug: str) -> StreamingHttpResponse:
    """Take a django request object and proxy it to a remote location given an org_slug"""
    from sentry.types.region import get_region_for_organization

    target_url = get_region_for_organization(None).to_url(request.path)

    # TODO: use requests session for connection pooling capabilities
    query_params = getattr(request, request.method, None)
    request_args = {
        "headers": request.headers,
        "params": dict(query_params) if query_params is not None else None,
        "files": getattr(request, "FILES", None),
        "data": getattr(request, "body", None) if not getattr(request, "FILES", None) else None,
        "stream": True,
        "timeout": settings.GATEWAY_PROXY_TIMEOUT,
    }
    try:
        resp: ExternalResponse = external_request(request.method, url=target_url, **request_args)
    except Timeout:
        # remote silo timeout. Use DRF timeout instead
        raise RequestTimeout()

    return _parse_response(resp, target_url)
