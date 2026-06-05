from __future__ import annotations

import logging
from collections.abc import Callable
from typing import Any

from django.conf import settings
from django.http.response import HttpResponseBase
from rest_framework.request import Request

from sentry.api.base import CellSiloEndpoint
from sentry.hybridcloud.apigateway.cell_request_resolvers import CellRequestResolver
from sentry.hybridcloud.apigateway.proxy import (
    proxy_cell_request,
    proxy_request,
)
from sentry.silo.base import SiloLimit, SiloMode
from sentry.types.cell import get_cell_by_name
from sentry.utils import metrics
from sentry.web.frontend.base import CellSiloView

logger = logging.getLogger(__name__)


def _get_view_silo_mode(view_func: Callable[..., HttpResponseBase]) -> frozenset[SiloMode] | None:
    view_class = getattr(view_func, "view_class", None)
    if not view_class:
        return None
    if not hasattr(view_class, "silo_limit"):
        return None
    endpoint_silo_limit: SiloLimit = view_class.silo_limit
    return endpoint_silo_limit.modes


def _get_view_cell_resolver(
    view_func: Callable[..., HttpResponseBase],
) -> CellRequestResolver | None:
    view_class = getattr(view_func, "view_class", None)
    silo_limit = getattr(view_class, "silo_limit", None)
    if isinstance(silo_limit, (CellSiloView, CellSiloEndpoint)):
        return silo_limit.cell_resolver

    return None


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

    shared_metric_tags = {
        "url_name": url_name,
        "request_method": request.method,
    }
    if "organization_slug" in view_kwargs or "organization_id_or_slug" in view_kwargs:
        org_id_or_slug = str(
            view_kwargs.get("organization_slug") or view_kwargs.get("organization_id_or_slug", "")
        )
        return proxy_request(request, org_id_or_slug, url_name)

    resolver = _get_view_cell_resolver(view_func)
    if resolver is not None:
        cell = resolver.resolve(request, view_func, view_kwargs)

        if cell:
            metrics.incr(
                "apigateway.proxy_request", tags={**shared_metric_tags, "kind": "cell_resolver"}
            )
            return proxy_cell_request(request, cell, url_name)
        # If no cell resolved, we drop through to the default resolution method

    if (
        request.resolver_match
        and request.resolver_match.url_name in settings.REGION_PINNED_URL_NAMES
    ):
        cell = get_cell_by_name(settings.SENTRY_MONOLITH_REGION)
        metrics.incr(
            "apigateway.proxy_request",
            tags={
                **shared_metric_tags,
                "kind": "regionpin",
            },
        )

        return proxy_cell_request(request, cell, url_name)

    if url_name != "unknown":
        # If we know the URL but didn't proxy it record we could be missing
        # URL handling and that needs to be fixed.
        metrics.incr(
            "apigateway.proxy_request",
            tags={
                "kind": "noop",
                **shared_metric_tags,
            },
        )
        logger.info("apigateway.unknown_url", extra={"url": request.path})

    return None
