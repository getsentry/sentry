from __future__ import annotations

from django.http.response import HttpResponseBase
from rest_framework.request import Request

from sentry.api_gateway.proxy import proxy_request
from sentry.silo import SiloMode


def _request_should_be_proxied(request: Request, view_kwargs) -> bool:
    return SiloMode.get_current_mode() != SiloMode.MONOLITH and "organization_slug" in view_kwargs


def proxy_request_if_needed(request: Request, view_kwargs) -> HttpResponseBase | None:
    """
    Main execution flow for the API Gateway
    returns None if proxying is not required
    """
    if not _request_should_be_proxied(request, view_kwargs):
        return None

    # Request should be proxied at this point
    org_slug = view_kwargs.get("organization_slug")
    return proxy_request(request, org_slug)
