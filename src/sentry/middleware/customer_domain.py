from __future__ import annotations

from typing import Callable

from django.http import HttpResponseRedirect
from django.urls import resolve, reverse
from rest_framework.request import Request
from rest_framework.response import Response

from sentry.api.base import resolve_region
from sentry.models import Organization
from sentry.utils import auth


class CustomerDomainMiddleware:
    """
    Set active organization from request.domain.
    """

    def __init__(self, get_response: Callable[[Request], Response]):
        self.get_response = get_response

    def __call__(self, request: Request) -> Response:
        if not hasattr(request, "subdomain"):
            return self.get_response(request)
        subdomain = request.subdomain
        if subdomain is None or resolve_region(request) is not None:
            return self.get_response(request)
        try:
            # Assume subdomain is an org slug being accessed
            Organization.objects.get_from_cache(slug=subdomain)
        except Organization.DoesNotExist:
            session = getattr(request, "session", None)
            if session and "activeorg" in session:
                del session["activeorg"]
            return self.get_response(request)
        auth.set_active_org(request, subdomain)
        result = resolve(request.path)
        if (
            result.kwargs
            and "organization_slug" in result.kwargs
            and result.kwargs["organization_slug"] != subdomain
        ):
            return HttpResponseRedirect(
                reverse(result.url_name, kwargs={**result.kwargs, "organization_slug": subdomain})
            )
        return self.get_response(request)
