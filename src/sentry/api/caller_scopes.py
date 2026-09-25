"""Record which kinds of scope the caller held when making a request.

Deprecated scopes are the broad read scopes we want to retire
(`settings.DEPRECATED_SCOPES`); granular scopes are the ones replacing them
(`settings.GRANULAR_SCOPES`). The flags are stashed on the request and read when
the `api.attribution` span is emitted (`sentry.api.client_kind`), which happens
after the permission checks that produce them.
"""

from __future__ import annotations

from collections.abc import Iterable

from django.conf import settings
from django.http.request import HttpRequest
from rest_framework.request import Request

DEPRECATED_ATTR = "has_deprecated_scopes"
GRANULAR_ATTR = "has_granular_scopes"


def record_caller_scopes(request: Request | HttpRequest, granted_scopes: Iterable[str]) -> None:
    """Record which kinds of scope the caller this request was admitted for holds.

    Called from each permission check that admits a request. A request can pass
    several checks (token scopes, then the organization's, then a project's); the
    last one wins, because it is the most specific.
    """
    granted = set(granted_scopes)
    underlying = _underlying(request)
    setattr(underlying, DEPRECATED_ATTR, not granted.isdisjoint(settings.DEPRECATED_SCOPES))
    setattr(underlying, GRANULAR_ATTR, not granted.isdisjoint(settings.GRANULAR_SCOPES))


def has_deprecated_scopes(request: Request | HttpRequest) -> bool | None:
    """None when no permission check admitted the request."""
    return getattr(_underlying(request), DEPRECATED_ATTR, None)


def has_granular_scopes(request: Request | HttpRequest) -> bool | None:
    """None when no permission check admitted the request."""
    return getattr(_underlying(request), GRANULAR_ATTR, None)


def _underlying(request: Request | HttpRequest) -> HttpRequest:
    """The Django request a DRF request wraps, so both reach the same attribute.

    Permission classes are also called with a plain Django request (internal API
    clients, tests), which has no `_request` to unwrap.
    """
    return getattr(request, "_request", request)
