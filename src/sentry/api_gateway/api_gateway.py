from __future__ import annotations

from django.http.response import HttpResponseBase
from rest_framework.request import Request

from sentry.api_gateway.proxy import proxy_request
from sentry.silo import SiloMode


def _request_should_be_proxied(request: Request, view_func, view_kwargs) -> bool:
    view_class = getattr(view_func, "view_class", None)
    current_silo_mode = SiloMode.get_current_mode()
    if view_class is not None:
        endpoint_silo_limit = getattr(view_class, "silo_limit", None)
        if endpoint_silo_limit is not None:
            endpoint_silo_set = endpoint_silo_limit.modes
            return current_silo_mode not in endpoint_silo_set and "organization_slug" in view_kwargs
    return False


def proxy_request_if_needed(request: Request, view_func, view_kwargs) -> HttpResponseBase | None:
    """
    Main execution flow for the API Gateway
    returns None if proxying is not required
    """
    if not _request_should_be_proxied(request, view_func, view_kwargs):
        return None

    # Request should be proxied at this point
    org_slug = view_kwargs.get("organization_slug")
    return proxy_request(request, org_slug)
