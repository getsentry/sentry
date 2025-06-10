from __future__ import annotations

import logging
from collections.abc import Callable

from django.http.request import HttpRequest
from django.http.response import HttpResponseBase

from sentry import options
from sentry.demo_mode.utils import is_demo_mode_enabled, is_demo_org
from sentry.organizations.services.organization import organization_service

logger = logging.getLogger(__name__)


def _get_org(slug):
    if not slug:
        return None
    if (
        user_org_context := organization_service.get_organization_by_slug(
            slug=slug, only_visible=True
        )
    ) is None:
        return None
    return user_org_context.organization


class DemoModeGuardMiddleware:
    def __init__(self, get_response: Callable[[HttpRequest], HttpResponseBase]) -> None:
        self.get_response = get_response

    def __call__(self, request: HttpRequest) -> HttpResponseBase:
        if not request.subdomain and request.path in ("", "/"):
            if is_demo_mode_enabled() and options.get("demo-mode.disable-sandbox-redirect"):
                logger.debug(
                    "Maybe blocking redirect on subdomain: %s path: %s",
                    request.subdomain,
                    request.path,
                )
                # only in "sentry.io/"
                session = getattr(request, "session", None)
                if session:
                    logger.debug(
                        "Maybe blocking redirect for org: %s", session and session.get("activeorg")
                    )
                    if is_demo_org(_get_org(session.get("activeorg"))):
                        logger.debug(
                            "Found org, deleting activeog session variable for %s",
                            session.get("activeorg"),
                        )
                        del session["activeorg"]

        return self.get_response(request)
