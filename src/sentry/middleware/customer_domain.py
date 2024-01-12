from __future__ import annotations

import logging
from typing import Callable

from django.conf import settings
from django.contrib.auth import logout
from django.http import HttpResponseRedirect
from django.http.request import HttpRequest
from django.http.response import HttpResponseBase
from django.urls import resolve, reverse

from sentry.api.utils import generate_organization_url
from sentry.services.hybrid_cloud.organization import organization_service
from sentry.types.region import subdomain_is_region
from sentry.utils import auth
from sentry.utils.http import absolute_uri

logger = logging.getLogger(__name__)


def _org_exists(slug):
    if not slug:
        return False
    return (
        organization_service.check_organization_by_slug(slug=slug, only_visible=False) is not None
    )


def _query_string(request):
    qs = request.META.get("QUERY_STRING") or ""
    if qs:
        qs = f"?{qs}"
    return qs


def _resolve_activeorg(request):
    subdomain = request.subdomain
    session = getattr(request, "session", None)
    if _org_exists(subdomain):
        # Assume subdomain is an org slug being accessed
        return subdomain
    elif session and "activeorg" in session and _org_exists(session["activeorg"]):
        return session["activeorg"]
    return None


def _resolve_redirect_url(request, activeorg):
    subdomain = request.subdomain
    redirect_subdomain = subdomain != activeorg
    redirect_url = ""
    if redirect_subdomain:
        redirect_url = generate_organization_url(activeorg)
    result = resolve(request.path)
    org_slug_path_mismatch = (
        result.kwargs
        and "organization_slug" in result.kwargs
        and result.kwargs["organization_slug"] != activeorg
    )
    if not redirect_subdomain and not org_slug_path_mismatch:
        return None
    kwargs = {**result.kwargs}
    if org_slug_path_mismatch:
        kwargs["organization_slug"] = activeorg
    path = reverse(result.url_name or result.func, kwargs=kwargs)
    qs = _query_string(request)
    redirect_url = f"{redirect_url}{path}{qs}"
    return redirect_url


class CustomerDomainMiddleware:
    """
    Set active organization from request.domain.
    """

    def __init__(self, get_response: Callable[[HttpRequest], HttpResponseBase]) -> None:
        self.get_response = get_response

    def __call__(self, request: HttpRequest) -> HttpResponseBase:
        if (
            request.method != "GET"
            or not getattr(settings, "SENTRY_USE_CUSTOMER_DOMAINS", False)
            or not hasattr(request, "subdomain")
        ):
            return self.get_response(request)
        subdomain = request.subdomain
        if subdomain is None or subdomain_is_region(request):
            return self.get_response(request)

        if (
            settings.DISALLOWED_CUSTOMER_DOMAINS
            and request.subdomain in settings.DISALLOWED_CUSTOMER_DOMAINS
        ):
            # DISALLOWED_CUSTOMER_DOMAINS is a list of org slugs that are explicitly not allowed to use customer domains.
            # We kick any request to the logout view.
            logout(request)
            redirect_url = absolute_uri(reverse("sentry-logout"))
            logger.info("customer_domain.redirect.logout", extra={"location": redirect_url})
            return HttpResponseRedirect(redirect_url)

        activeorg = _resolve_activeorg(request)
        if not activeorg:
            session = getattr(request, "session", None)
            if session and "activeorg" in session:
                del session["activeorg"]
            return self.get_response(request)
        auth.set_active_org(request, activeorg)
        redirect_url = _resolve_redirect_url(request, activeorg)
        if redirect_url is not None and len(redirect_url) > 0:
            logger.info("customer_domain.redirect", extra={"location": redirect_url})
            return HttpResponseRedirect(redirect_url)
        return self.get_response(request)
