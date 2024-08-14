from __future__ import annotations

import logging
from collections.abc import Callable
from typing import Any

from django.conf import settings
from django.http.response import HttpResponseBase
from rest_framework.request import Request

from sentry.hybridcloud.apigateway.proxy import (
    proxy_error_embed_request,
    proxy_region_request,
    proxy_request,
    proxy_sentryapp_request,
    proxy_sentryappinstallation_request,
)
from sentry.silo.base import SiloLimit, SiloMode
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

logger = logging.getLogger(__name__)


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

    url_name = "unknown"
    if request.resolver_match:
        url_name = request.resolver_match.url_name or url_name

    if "organization_slug" in view_kwargs or "organization_id_or_slug" in view_kwargs:
        org_id_or_slug = str(
            view_kwargs.get("organization_slug") or view_kwargs.get("organization_id_or_slug", "")
        )

        metrics.incr(
            "apigateway.proxy_request",
            tags={
                "url_name": url_name,
                "kind": "orgslug",
            },
        )
        return proxy_request(request, org_id_or_slug, url_name)

    if (
        "uuid" in view_kwargs
        and request.resolver_match
        and request.resolver_match.url_name in SENTRY_APP_REGION_URL_NAMES
    ):
        install_uuid = view_kwargs["uuid"]
        metrics.incr(
            "apigateway.proxy_request",
            tags={
                "url_name": url_name,
                "kind": "sentryapp-installation",
            },
        )
        return proxy_sentryappinstallation_request(request, install_uuid, url_name)

    if (
        ("sentry_app_slug" in view_kwargs or "sentry_app_id_or_slug" in view_kwargs)
        and request.resolver_match
        and request.resolver_match.url_name in SENTRY_APP_REGION_URL_NAMES
    ):
        app_id_or_slug = str(
            view_kwargs.get("sentry_app_slug") or view_kwargs.get("sentry_app_id_or_slug", "")
        )
        metrics.incr(
            "apigateway.proxy_request",
            tags={
                "url_name": url_name,
                "kind": "sentryapp",
            },
        )
        return proxy_sentryapp_request(request, app_id_or_slug, url_name)

    if url_name == "sentry-error-page-embed" and "dsn" in request.GET:
        # Error embed modal is special as customers can't easily use region URLs.
        dsn = request.GET["dsn"]
        metrics.incr(
            "apigateway.proxy_request",
            tags={
                "url_name": url_name,
                "kind": "error-embed",
            },
        )
        return proxy_error_embed_request(request, dsn, url_name)

    if (
        request.resolver_match
        and request.resolver_match.url_name in settings.REGION_PINNED_URL_NAMES
    ):
        region = get_region_by_name(settings.SENTRY_MONOLITH_REGION)
        metrics.incr(
            "apigateway.proxy_request",
            tags={
                "url_name": url_name,
                "kind": "regionpin",
            },
        )

        return proxy_region_request(request, region, url_name)

    if url_name != "unknown":
        # If we know the URL but didn't proxy it record we could be missing
        # URL handling and that needs to be fixed.
        metrics.incr(
            "apigateway.proxy_request",
            tags={
                "kind": "noop",
                "url_name": url_name,
            },
        )
        logger.info("apigateway.unknown_url", extra={"url": request.path})

    return None
