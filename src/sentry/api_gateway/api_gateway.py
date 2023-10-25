from __future__ import annotations

from typing import Any, Callable

from django.conf import settings
from django.http.response import HttpResponseBase
from rest_framework.request import Request

from sentry.api_gateway.proxy import proxy_region_request, proxy_request
from sentry.silo import SiloMode
from sentry.silo.base import SiloLimit
from sentry.types.region import get_region_by_name

# Backwards compatibility for URLs that don't
# have enough context to route via organization.
# New usage of these endpoints uses region domains,
# but existing customers have been using these routes
# on the main domain for a long time.
REGION_PINNED_URL_NAMES = (
    "sentry-api-0-builtin-symbol-sources",
    "sentry-api-0-grouping-configs",
    "sentry-api-0-relays-index",
    "sentry-api-0-relay-register-challenge",
    "sentry-api-0-relay-register-response",
    "sentry-api-0-relay-projectconfigs",
    "sentry-api-0-relay-projectids",
    "sentry-api-0-relay-publickeys",
    "sentry-api-0-relays-healthcheck",
    "sentry-api-0-relays-details",
    "sentry-error-page-embed",
    "sentry-release-hook",
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

    if request.resolver_match and request.resolver_match.url_name in REGION_PINNED_URL_NAMES:
        region = get_region_by_name(settings.SENTRY_MONOLITH_REGION)

        return proxy_region_request(request, region)
    return None
