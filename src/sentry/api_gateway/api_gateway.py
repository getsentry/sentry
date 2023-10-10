from __future__ import annotations

from typing import Any, Callable

from django.conf import settings
from django.http.response import HttpResponseBase
from rest_framework.request import Request

from sentry.api_gateway.proxy import proxy_region_request, proxy_request
from sentry.silo import SiloMode
from sentry.silo.base import SiloLimit
from sentry.types.region import get_region_by_name

REGION_PINNED_URLS = (
    "/api/0/builtin-symbol-sources/",
    "/api/0/grouping-configs/",
)


def _get_view_silo_mode(view_func: Callable[..., HttpResponseBase]) -> frozenset[SiloMode] | None:
    view_class = getattr(view_func, "view_class", None)
    if not view_class:
        return None
    if not hasattr(view_class, "silo_limit"):
        return None
    endpoint_silo_limit: SiloLimit = view_class.silo_limit
    return endpoint_silo_limit.modes


def proxy_request_if_needed(
    request: Request, view_func: Callable[..., HttpResponseBase], view_kwargs: dict[str, Any]
) -> HttpResponseBase | None:
    """
    Main execution flow for the API Gateway.
    returns None if proxying is not required, or a response if the proxy was successful.
    """
    current_silo_mode = SiloMode.get_current_mode()
    if current_silo_mode != SiloMode.CONTROL:
        return None

    silo_modes = _get_view_silo_mode(view_func)
    if not silo_modes or current_silo_mode in silo_modes:
        return None

    if "organization_slug" in view_kwargs:
        org_slug = view_kwargs["organization_slug"]
        return proxy_request(request, org_slug)

    if request.path in REGION_PINNED_URLS:
        region = get_region_by_name(settings.SENTRY_MONOLITH_REGION)

        return proxy_region_request(request, region)

    return None
