from __future__ import annotations

from typing import Callable

from django.core.exceptions import DisallowedHost
from django.http import HttpResponseRedirect
from rest_framework.request import Request
from rest_framework.response import Response

from sentry import options


class SubdomainMiddleware:
    """
    Extracts any subdomain from request.get_host() relative to the `system.base-hostname` option, and attaches it to
    the request object under request.subdomain.

    If no subdomain is extracted, then request.subdomain is None.
    """

    def __init__(self, get_response: Callable[[Request], Response]):
        self.base_hostname = options.get("system.base-hostname")

        if self.base_hostname:
            self.base_hostname = self.base_hostname.rstrip("/")

        self.get_response = get_response

    def __call__(self, request: Request) -> Response:
        request.subdomain = None

        if not self.base_hostname:
            return self.get_response(request)

        try:
            host = request.get_host().lower()
        except DisallowedHost:
            url_prefix = options.get("system.url-prefix")
            return HttpResponseRedirect(url_prefix)

        if not host.endswith(f".{self.base_hostname}"):
            return self.get_response(request)

        subdomain = host[: -len(self.base_hostname)].rstrip(".")

        if len(subdomain) == 0:
            subdomain = None

        request.subdomain = subdomain
        return self.get_response(request)
