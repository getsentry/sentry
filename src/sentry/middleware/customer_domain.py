from __future__ import annotations

from typing import Callable

from django.conf import settings
from django.contrib.auth import logout
from django.http import HttpResponseRedirect
from django.urls import resolve, reverse
from rest_framework.request import Request
from rest_framework.response import Response

from sentry import options
from sentry.api.base import resolve_region
from sentry.api.utils import generate_organization_url
from sentry.models import Organization
from sentry.utils import auth


def _org_exists(slug):
    if not slug:
        return False
    try:
        Organization.objects.get_from_cache(slug=slug)
        return True
    except Organization.DoesNotExist:
        return False


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

    def __init__(self, get_response: Callable[[Request], Response]):
        self.get_response = get_response

    def __call__(self, request: Request) -> Response:
        if not getattr(settings, "SENTRY_USE_CUSTOMER_DOMAINS", False):
            return self.get_response(request)
        if not hasattr(request, "subdomain"):
            return self.get_response(request)
        subdomain = request.subdomain
        if subdomain is None or resolve_region(request) is not None:
            return self.get_response(request)

        if (
            settings.DISALLOWED_CUSTOMER_DOMAINS
            and request.subdomain in settings.DISALLOWED_CUSTOMER_DOMAINS
        ):
            # DISALLOWED_CUSTOMER_DOMAINS is a list of org slugs that are explicitly not allowed to use customer domains.
            # We kick any request to the logout view.
            logout(request)
            url_prefix = options.get("system.url-prefix")
            logout_view = reverse("sentry-logout")
            redirect_url = f"{url_prefix}{logout_view}"
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
            return HttpResponseRedirect(redirect_url)
        return self.get_response(request)
