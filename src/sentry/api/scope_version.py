"""Record whether a request was admitted by a deprecated, broad scope.

`v1` requests relied on one of the broad read scopes we want to retire; `v2`
requests got in without one. The version is stashed on the request and read when
the `api.attribution` span is emitted (`sentry.api.client_kind`), which happens
after the permission checks that produce it.
"""

from __future__ import annotations

from collections.abc import Collection, Iterable
from typing import Literal

from django.conf import settings
from django.http.request import HttpRequest
from rest_framework.request import Request

ScopeVersion = Literal["v1", "v2"]

REQUEST_ATTR = "scope_version"


def record_scope_version(
    request: Request | HttpRequest, allowed_scopes: Collection[str], granted_scopes: Iterable[str]
) -> None:
    """Record the scope version of the scopes that admitted this request.

    Called from each permission check that admits a request. A request can pass
    several checks (token scopes, then the organization's, then a project's); the
    last one wins, because it is the most specific.
    """
    satisfying = set(allowed_scopes).intersection(granted_scopes)
    if not satisfying:
        return
    version: ScopeVersion = "v1" if satisfying & settings.DEPRECATED_SCOPES else "v2"
    setattr(_underlying(request), REQUEST_ATTR, version)


def get_scope_version(request: Request | HttpRequest) -> ScopeVersion | None:
    return getattr(_underlying(request), REQUEST_ATTR, None)


def _underlying(request: Request | HttpRequest) -> HttpRequest:
    """The Django request a DRF request wraps, so both reach the same attribute.

    Permission classes are also called with a plain Django request (internal API
    clients, tests), which has no `_request` to unwrap.
    """
    return getattr(request, "_request", request)
