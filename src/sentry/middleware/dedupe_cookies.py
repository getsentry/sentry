from __future__ import annotations

from collections import defaultdict
from typing import Callable

import sentry_sdk
from django.conf import settings
from django.core.exceptions import DisallowedHost
from django.http import HttpResponseRedirect
from django.http.request import split_domain_port
from rest_framework.request import Request
from rest_framework.response import Response

from sentry.auth import superuser
from sudo.settings import COOKIE_NAME as SUDO_COOKIE_NAME


def _query_string(request):
    qs = request.META.get("QUERY_STRING") or ""
    if qs:
        qs = f"?{qs}"
    return qs


# List of cookie names to check for duplicates in a raw Cookie header from a Request object.
COOKIE_NAMES = [
    settings.SESSION_COOKIE_NAME,
    settings.CSRF_COOKIE_NAME,
    superuser.COOKIE_NAME,
    SUDO_COOKIE_NAME,
]


def count_cookies(raw_cookie):
    # Adapted from https://github.com/django/django/blob/ce6230aa976e8d963226a3956b45a8919215dbd8/django/http/cookie.py
    cookie_counter = defaultdict(lambda: 0)
    for chunk in raw_cookie.split(";"):
        if "=" in chunk:
            key, val = chunk.split("=", 1)
        else:
            # Assume an empty name per
            # https://bugzilla.mozilla.org/show_bug.cgi?id=169091
            key, val = "", chunk
        key, val = key.strip(), val.strip()
        if key or val:
            cookie_counter[key] += 1
    return cookie_counter


def check_duplicate_cookies(request: Request):
    cookie_counts = count_cookies(request.META.get("HTTP_COOKIE", ""))
    cookies_to_delete = set()
    for cookie_name in COOKIE_NAMES:
        count = cookie_counts.get(cookie_name, 0)
        if count <= 1:
            continue
        cookies_to_delete.add(cookie_name)
    if len(cookies_to_delete) > 0:
        return cookies_to_delete
    return None


class DedupeCookiesMiddleware:
    """
    De-duplicate some cookies.
    """

    def __init__(self, get_response: Callable[[Request], Response]):
        self.get_response = get_response

    def __call__(self, request: Request) -> Response:
        if request.method != "GET":
            return self.get_response(request)
        duplicate_cookies = check_duplicate_cookies(request)
        if duplicate_cookies is None:
            return self.get_response(request)

        # Browsers will send two or more cookies with the same name without letting us know the domain in which they
        # were actually set. In this case, we redirect the browser to the same path, but with a `Set-Cookie` header
        # to request the browser to delete duplicate cookie.
        #
        # We only do this for some cookies. See COOKIE_NAMES above.
        #
        # This idea was adapted from https://github.blog/2013-04-09-yummy-cookies-across-domains/
        qs = _query_string(request)
        redirect_url = f"{request.path}{qs}"
        response = HttpResponseRedirect(redirect_url)

        domain = ".sentry.io"
        try:
            host = request.get_host().lower()
            domain, port = split_domain_port(host)
            domain = f".{domain}"
        except DisallowedHost:
            pass

        for cookie_name in duplicate_cookies:
            # De-dupe cookies with Domain=.sentry.io that will collide with cookies with Domain=sentry.io
            # This change will be reverted once domains are configured for session, csrf, su, and sudo cookies for
            # shipping customer domains.
            response.delete_cookie(cookie_name, domain=domain)

        with sentry_sdk.configure_scope() as scope:
            scope.set_tag("has_duplicate_cookies", "yes")
            scope.set_tag("deleted_cookie_domain", domain)
            scope.set_context(
                "duplicate_cookies", {"cookies": list(duplicate_cookies), "domain": domain}
            )
            sentry_sdk.capture_message("Found duplicate cookies.")

        return response
