"""Compatibility scopes for writes that historically only required a read scope.

Many endpoints accept `org:read` for writes (creating dashboards, saved queries,
and so on) so that Members can use the UI. To make read scopes read-only without
renaming them, those endpoints list a compatibility scope from
`settings.LEGACY_READ_WRITE_SCOPES` instead of the read scope. A caller satisfies
the compatibility scope when it holds the underlying read scope and its credential
predates the cutoff.

Browser sessions and every credential without a stable creation marker keep the
legacy behavior. Only personal auth tokens created after
`api.legacy-read-writes.max-user-token-id` are strict.
"""

from __future__ import annotations

import logging
from collections.abc import Collection, Iterable

from django.conf import settings
from rest_framework.request import Request

from sentry import options
from sentry.auth.services.auth.model import AuthenticatedToken
from sentry.hybridcloud.models.apitokenreplica import ApiTokenReplica
from sentry.models.apitoken import ApiToken
from sentry.utils import metrics

logger = logging.getLogger(__name__)


def is_legacy_read_write_scope(scope: str) -> bool:
    return scope in settings.LEGACY_READ_WRITE_SCOPES


def without_legacy_read_write_scopes(scopes: Iterable[str]) -> set[str]:
    return {scope for scope in scopes if not is_legacy_read_write_scope(scope)}


def _user_token_id(auth: object) -> int | None:
    """The control-silo id of a personal auth token, or None for any other credential.

    OAuth and integration tokens are excluded because they are reissued on refresh,
    so their id says nothing about when the grant was made.
    """
    if isinstance(auth, AuthenticatedToken):
        if auth.kind == "api_token" and auth.application_id is None:
            return auth.entity_id
        return None
    if isinstance(auth, ApiTokenReplica):
        return auth.apitoken_id if auth.application_id is None else None
    if isinstance(auth, ApiToken):
        return auth.id if auth.application_id is None else None
    return None


def credential_allows_legacy_read_writes(auth: object | None) -> bool:
    if auth is None:
        return True
    max_token_id = options.get("api.legacy-read-writes.max-user-token-id")
    if not max_token_id:
        return True
    token_id = _user_token_id(auth)
    if token_id is None:
        return True
    return token_id <= max_token_id


def held_legacy_read_write_scopes(
    allowed_scopes: Collection[str], held_scopes: Collection[str]
) -> set[str]:
    """Compatibility scopes in `allowed_scopes` whose read scope is in `held_scopes`."""
    return {
        scope
        for scope in allowed_scopes
        if settings.LEGACY_READ_WRITE_SCOPES.get(scope) in held_scopes
    }


def record_legacy_read_write(
    request: Request, view: object, scopes: set[str], allowed: bool
) -> None:
    """Track who still depends on read scopes for writes, for outreach before enforcing."""
    endpoint = type(view).__name__
    metrics.incr(
        "api.legacy_read_writes",
        tags={
            "endpoint": endpoint,
            "method": request.method or "",
            "allowed": str(allowed).lower(),
        },
        sample_rate=1.0,
    )
    logger.info(
        "api.legacy_read_writes",
        extra={
            "endpoint": endpoint,
            "method": request.method,
            "scopes": sorted(scopes),
            "allowed": allowed,
            "user_id": getattr(request.user, "id", None),
        },
    )


def access_has_scope(request: Request, scope: str) -> bool:
    """`request.access.has_scope`, resolving compatibility scopes to their read scope."""
    read_scope = settings.LEGACY_READ_WRITE_SCOPES.get(scope)
    if read_scope is None:
        return request.access.has_scope(scope)
    return credential_allows_legacy_read_writes(request.auth) and request.access.has_scope(
        read_scope
    )
