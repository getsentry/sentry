from __future__ import annotations

from typing import Any, Callable

from django.conf import settings
from django.http.response import HttpResponseBase
from rest_framework.request import Request

from sentry.hybridcloud.apigateway.proxy import (
    proxy_region_request,
    proxy_request,
    proxy_sentryapp_request,
    proxy_sentryappinstallation_request,
)
from sentry.silo import SiloMode
from sentry.silo.base import SiloLimit
from sentry.types.region import get_region_by_name
from sentry.utils import metrics

SENTRY_APP_REGION_URL_NAMES = (
    "sentry-api-0-sentry-app-installation-external-requests",
    "sentry-api-0-sentry-app-installation-external-issue-actions",
    "sentry-api-0-sentry-app-installation-external-issues",
    "sentry-api-0-sentry-app-installation-external-issue-details",
    "sentry-api-0-sentry-app-requests",
    "sentry-api-0-sentry-app-interaction",
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
        url_name = request.resolver_match.url_name if request.resolver_match else "unknown"

        metrics.incr(
            "apigateway.proxy_request",
            tags={
                "url_name": url_name,
                "kind": "orgslug",
            },
        )
        return proxy_request(request, org_slug)

    if (
        "uuid" in view_kwargs
        and request.resolver_match
        and request.resolver_match.url_name in SENTRY_APP_REGION_URL_NAMES
    ):
        install_uuid = view_kwargs["uuid"]
        metrics.incr(
            "apigateway.proxy_request",
            tags={
                "url_name": request.resolver_match.url_name,
                "kind": "sentryapp-installation",
            },
        )
        return proxy_sentryappinstallation_request(request, install_uuid)

    if (
        "sentry_app_slug" in view_kwargs
        and request.resolver_match
        and request.resolver_match.url_name in SENTRY_APP_REGION_URL_NAMES
    ):
        app_slug = view_kwargs["sentry_app_slug"]
        metrics.incr(
            "apigateway.proxy_request",
            tags={
                "url_name": request.resolver_match.url_name,
                "kind": "sentryapp",
            },
        )
        return proxy_sentryapp_request(request, app_slug)

    if (
        request.resolver_match
        and request.resolver_match.url_name in settings.REGION_PINNED_URL_NAMES
    ):
        region = get_region_by_name(settings.SENTRY_MONOLITH_REGION)
        metrics.incr(
            "apigateway.proxy_request",
            tags={
                "url_name": request.resolver_match.url_name,
                "kind": "regionpin",
            },
        )

        return proxy_region_request(request, region)
    return None
