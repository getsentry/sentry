from __future__ import annotations

import logging
from collections.abc import Callable

from django.contrib.auth import logout
from django.http.request import HttpRequest
from django.http.response import HttpResponseBase, HttpResponseRedirect

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
                if session and (activeorg := session.get("activeorg")):
                    logger.debug("Maybe blocking org redirect for org: %s", activeorg)
                    if is_demo_org(_get_org(activeorg)):
                        logger.debug("Org %s is demo org, redirecting to welcome page", activeorg)

                        if options.get("demo-mode.sandbox-redirect-logout"):
                            logout(request)

                        return HttpResponseRedirect("https://sentry.io/welcome")

        return self.get_response(request)
