"""
Utilities related to proxying a request to a region silo
"""

from urllib.parse import urljoin

import requests as external_request
from requests import Response as external_response
from rest_framework.exceptions import NotFound
from rest_framework.request import Request
from rest_framework.response import Response

from sentry.api.utils import generate_region_url
from sentry.models.organization import Organization


def get_org_region(slug: str) -> str:
    from sentry.types.region import get_region_for_organization

    org = Organization.objects.get(slug=slug)
    region_info = get_region_for_organization(org)
    return region_info.address


def build_url(region: str, request: Request) -> str:
    """Might need some changes to handle other format region address."""
    region_url = generate_region_url(region)
    return urljoin(region_url, request.path)


def parse_response(response: external_response) -> Response:
    """
    Convert the Responses class from requests into the drf Response
    """
    return Response(data=response.json(), headers=response.headers, status=response.status_code)


def proxy_request(request: Request, org_slug: str) -> Response:
    """Take a django request opject and proxy it to a remote location given an org_slug"""

    try:
        region_location = get_org_region(org_slug)
    except Organization.DoesNotExist:
        raise NotFound(detail="Resource could not be found")
    target_url = build_url(region_location, request)

    query_params = getattr(request, request.method, None)
    request_args = {
        "headers": request.headers,
        "params": dict(query_params) if query_params is not None else None,
    }
    resp: external_response = external_request.request(request.method, target_url, **request_args)

    return parse_response(resp)
