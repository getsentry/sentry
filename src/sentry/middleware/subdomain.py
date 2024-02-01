from __future__ import annotations

import logging
from typing import Callable

from django.core.exceptions import DisallowedHost
from django.http import HttpResponseRedirect
from django.http.request import HttpRequest
from django.http.response import HttpResponseBase

from sentry import options

logger = logging.getLogger(__name__)


class SubdomainMiddleware:
    """
    Extracts any subdomain from request.get_host() relative to the `system.base-hostname` option, and attaches it to
    the request object under request.subdomain.

    If no subdomain is extracted, then request.subdomain is None.
    """

    def __init__(self, get_response: Callable[[HttpRequest], HttpResponseBase]):
        self.base_hostname = options.get("system.base-hostname")

        if self.base_hostname:
            self.base_hostname = self.base_hostname.rstrip("/")

        self.get_response = get_response

    def __call__(self, request: HttpRequest) -> HttpResponseBase:
        request.subdomain = None

        if not self.base_hostname:
            return self.get_response(request)

        try:
            host = request.get_host().lower()
        except DisallowedHost:
            url_prefix = options.get("system.url-prefix")
            logger.info(
                "subdomain.disallowed_host",
                extra={
                    "location": url_prefix,
                    "host": request.META.get("HTTP_HOST", "<unknown>"),
                    "path": request.path,
                },
            )
            return HttpResponseRedirect(url_prefix)

        if not host.endswith(f".{self.base_hostname}"):
            return self.get_response(request)

        subdomain = host[: -len(self.base_hostname)].rstrip(".")

        if len(subdomain) == 0:
            subdomain = None

        request.subdomain = subdomain
        return self.get_response(request)
