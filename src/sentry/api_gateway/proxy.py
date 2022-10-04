"""
Utilities related to proxying a request to a region silo
"""

import requests as external_request
from requests import Response as external_response
from rest_framework.request import Request
from rest_framework.response import Response

from sentry.models.organization import Organization


def get_org_region(slug: str) -> str:
    from sentry.types.region import get_region_for_organization

    org = Organization.objects.get(slug=slug)
    region_info = get_region_for_organization(org)
    return region_info.address


def build_url(region: str, request: Request) -> str:
    return region + request.path


def parse_response(response: external_response) -> Response:
    """
    Convert the Responses class from requests into the drf Response
    """
    return Response(data=response.json(), headers=response.headers, status=response.status_code)


def proxy_request(request: Request, org_slug: str) -> Response:

    region_location = get_org_region(org_slug)
    target_url = build_url(region_location, request)

    query_params = getattr(request, request.method, None)
    request_args = {
        "headers": request.headers,
        "params": dict(query_params) if query_params is not None else None,
    }
    resp: external_response = external_request.request(request.method, target_url, **request_args)

    return parse_response(resp)
