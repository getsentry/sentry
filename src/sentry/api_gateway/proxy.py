"""
Utilities related to proxying a request to a region silo
"""


from django.http import StreamingHttpResponse
from requests import Response as ExternalResponse
from requests import request as external_request
from rest_framework.exceptions import NotFound
from rest_framework.request import Request

from sentry.models.organization import Organization

# stream 0.5 MB at a time
PROXY_CHUNK_SIZE = 512 * 1024


def _parse_response(response: ExternalResponse) -> StreamingHttpResponse:
    """
    Convert the Responses class from requests into the drf Response
    """
    streamed_response = StreamingHttpResponse(
        streaming_content=(chunk for chunk in response.iter_content(PROXY_CHUNK_SIZE)),
        status=response.status_code,
        content_type=response.headers.pop("Content-Type"),
    )
    # Add Headers to response
    for header, value in response.headers.items():
        streamed_response[header] = value
    return streamed_response


def proxy_request(request: Request, org_slug: str) -> StreamingHttpResponse:
    """Take a django request opject and proxy it to a remote location given an org_slug"""
    from sentry.types.region import get_region_for_organization

    try:
        org = Organization.objects.get(slug=org_slug)
    except Organization.DoesNotExist:
        raise NotFound(detail="Resource could not be found")
    target_url = get_region_for_organization(org).to_url(request.path)

    query_params = getattr(request, request.method, None)
    request_args = {
        "headers": request.headers,
        "params": dict(query_params) if query_params is not None else None,
        "stream": True,
    }
    resp: ExternalResponse = external_request(request.method, target_url, **request_args)

    return _parse_response(resp)
