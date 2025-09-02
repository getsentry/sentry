from __future__ import annotations

import logging
from collections.abc import Callable

from django.contrib.auth import logout
from django.http.request import HttpRequest
from django.http.response import HttpResponseBase, HttpResponseRedirect

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
        if (
            not request.subdomain
            and request.path in ("", "/")
            and is_demo_mode_enabled()
            and (session := getattr(request, "session", None))
            and (activeorg := session.get("activeorg"))
            and is_demo_org(_get_org(activeorg))
        ):
            logout(request)
            return HttpResponseRedirect("https://sentry.io/welcome")

        return self.get_response(request)
