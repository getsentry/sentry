"""Record which scopes admitted a request, to plan deprecating the broad ones.

Endpoint scope maps are any-of lists, so a caller holding several of them is
admitted without us learning which one it depended on. Removing `org:read` from a
scope map only breaks a request whose *entire* satisfying set is being removed --
so the satisfying set, not a single "most permissive" scope, is what gets recorded.

The scopes are stashed on the request and read when the `api.attribution` span is
emitted (`sentry.api.client_kind`), which happens after the permission checks that
produce them.
"""

from __future__ import annotations

import logging
from collections.abc import Collection, Iterable
from dataclasses import dataclass

from django.conf import settings
from django.http.request import HttpRequest
from rest_framework.request import Request

logger = logging.getLogger(__name__)

REQUEST_ATTR = "scope_admission"


@dataclass(frozen=True)
class ScopeAdmission:
    """The scopes a request was admitted with, and the scopes it could have used."""

    satisfying: tuple[str, ...]
    allowed: tuple[str, ...]
    least_permissive: str | None


def record_scope_admission(
    request: Request, allowed_scopes: Collection[str], granted_scopes: Iterable[str]
) -> None:
    """Record the allowed scopes this caller held, for the attribution span.

    Called from each permission check that admits a request. A request can pass
    several checks (token scopes, then the organization's, then a project's); the
    last one wins, because it is the most specific and is evaluated against the
    caller's effective access rather than the raw token.
    """
    try:
        granted = set(granted_scopes)
        satisfying = tuple(sorted(scope for scope in allowed_scopes if scope in granted))
        if not satisfying:
            return
        record = ScopeAdmission(
            satisfying=satisfying,
            allowed=tuple(sorted(allowed_scopes)),
            least_permissive=least_permissive_scope(satisfying),
        )
        setattr(_underlying(request), REQUEST_ATTR, record)
    except Exception:
        # Telemetry on the permission path: a failure here must not turn an
        # authorized request into a 500.
        logger.exception("api.scope_admission.record_failed")


def get_scope_admission(request: Request) -> ScopeAdmission | None:
    return getattr(_underlying(request), REQUEST_ATTR, None)


def _underlying(request: Request | HttpRequest) -> HttpRequest:
    """The Django request a DRF request wraps, so both reach the same attribute.

    Permission classes are also called with a plain Django request (internal API
    clients, tests), which has no `_request` to unwrap.
    """
    return getattr(request, "_request", request)


def least_permissive_scope(scopes: Collection[str]) -> str | None:
    """The weakest of ``scopes``: the one none of the others sit above.

    A token created with ``org:write`` stores ``org:read`` too, so the satisfying set
    names a range rather than the bar the caller actually had to clear. `org:read` is
    the answer for ``{org:read, org:write}``.

    Scopes from different families (``org:read`` and ``dashboard:read``) sit above
    nothing in common, so the tie is broken alphabetically to keep the value stable;
    read it alongside ``satisfying``, which keeps both. Mirrors the rule in
    ``sentry.api.permissions._least_privileged_scope``, without that one's exclusions.
    """
    if not scopes:
        return None
    for scope in sorted(scopes):
        implied = set(settings.SENTRY_SCOPE_HIERARCHY_MAPPING.get(scope, (scope,)))
        if not (implied - {scope}) & set(scopes):
            return scope
    return min(scopes)
