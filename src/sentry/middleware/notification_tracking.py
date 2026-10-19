from __future__ import annotations

import logging
from collections.abc import Callable
from typing import Any

from django.core.cache import cache
from django.http import HttpRequest
from django.http.response import HttpResponseBase

from sentry.notifications.platform.tracking import (
    NotificationEngagementMechanism,
    NotificationTrackingContext,
    classify_link,
    is_tracking_enabled,
    parse_referrer,
    record_engagement,
)
from sentry.organizations.services.organization import organization_service
from sentry.types.cell import subdomain_is_locality
from sentry.utils.hashlib import md5_text
from sentry.utils.http import is_using_customer_domain

logger = logging.getLogger(__name__)

# Pageloads with the same UUID/link/user are only recorded once every 10 minutes.
PAGE_LOAD_DEDUPE_SECONDS = 10 * 60

# Set on the request by `process_view`, so it's only present when the view ran in this silo. Its
# value is the URL's organization slug, or None for URLs without one.
_ORGANIZATION_SLUG_ATTR = "_notification_tracking_organization_slug"


class NotificationTrackingMiddleware:
    """
    Records an engagement when an authenticated user successfully loads a Sentry page from a tracked
    notification link.

    Must come after `ApiGatewayMiddleware`: a request it proxies to another silo never reaches this
    `process_view`, so each page load is recorded only by the silo that serves it.
    """

    def __init__(self, get_response: Callable[[HttpRequest], HttpResponseBase]):
        self.get_response = get_response

    def __call__(self, request: HttpRequest) -> HttpResponseBase:
        response = self.get_response(request)
        try:
            if (
                hasattr(request, _ORGANIZATION_SLUG_ATTR)
                and request.method == "GET"
                and "notification_uuid" in request.GET
            ):
                _record_page_load(request, response)
        except Exception:
            logger.exception("notifications.tracking.page_load.failed")
        return response

    def process_view(
        self,
        request: HttpRequest,
        view_func: Callable[..., HttpResponseBase],
        view_args: tuple[Any, ...],
        view_kwargs: dict[str, Any],
    ) -> None:
        setattr(request, _ORGANIZATION_SLUG_ATTR, view_kwargs.get("organization_slug"))


def _record_page_load(request: HttpRequest, response: HttpResponseBase) -> None:
    user = getattr(request, "user", None)
    if (
        response.status_code != 200
        or request.path_info.startswith("/api/")
        or user is None
        or not user.is_authenticated
    ):
        return

    organization_slug = getattr(request, _ORGANIZATION_SLUG_ATTR)
    if (
        organization_slug is None
        and is_using_customer_domain(request)
        and not subdomain_is_locality(request)
    ):
        organization_slug = request.subdomain
    if organization_slug is None:
        return

    referrer = parse_referrer(request.GET.get("referrer", ""))
    if referrer is None or not is_tracking_enabled(referrer.source, referrer.provider):
        return

    notification_uuid = request.GET["notification_uuid"]
    link = classify_link(request.get_full_path())
    dedupe_key = (
        f"notifications.tracking.page_load:{md5_text(notification_uuid, link, user.id).hexdigest()}"
    )
    if not cache.add(dedupe_key, True, PAGE_LOAD_DEDUPE_SECONDS):
        return

    # Some pages with an organization slug, such as join requests, load for non-members.
    organization = organization_service.get_org_by_slug(slug=organization_slug, user_id=user.id)
    if organization is None:
        return

    record_engagement(
        NotificationTrackingContext(
            source=referrer.source,
            provider=referrer.provider,
            category=referrer.category,
            notification_uuid=notification_uuid,
            organization_id=organization.id,
        ),
        mechanism=NotificationEngagementMechanism.PAGE_LOAD,
        link=link,
        user_id=user.id,
    )
