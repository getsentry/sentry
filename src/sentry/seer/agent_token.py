"""Short-lived, scope-bound capability tokens for the Seer agent.

Tokens are signed JWTs, not stored (verified by signature/claims, re-minted on demand);
only :class:`SeerAgentWriteGrant`, the durable record of user consent, persists.
"""

from __future__ import annotations

from collections.abc import Iterable
from datetime import datetime, timedelta
from typing import Any

from django.conf import settings
from django.db import router, transaction
from django.http.request import HttpRequest
from django.utils import timezone
from rest_framework.request import Request

from sentry.auth.services.auth import AuthenticatedToken
from sentry.seer.models.agent_write_grant import DEFAULT_EXPIRATION, SeerAgentWriteGrant
from sentry.types.token import SENTRY_AGENT_TOKEN_PREFIX
from sentry.utils import jwt

FEATURE_FLAG = "organizations:seer-agent-token-flow"

# Distinct audience so the token can't be replayed against another audience that shares the
# signing secret (e.g. X-Viewer-Context JWTs).
AGENT_TOKEN_AUDIENCE = "sentry-agent-api"

# TTL is the only bound on a leaked token, so keep it short.
DEFAULT_TOKEN_TTL = timedelta(minutes=5)

# Set when an agent token authenticates; read by the cross-org binding guard.
_REQUEST_CLAIMS_ATTR = "_agent_token_claims"


def _signing_key() -> str:
    return settings.SEER_API_SHARED_SECRET


def readonly_scopes() -> frozenset[str]:
    # Not demo_mode.get_readonly_scopes(): that also allows project:releases, a write.
    return frozenset(settings.SENTRY_READONLY_SCOPES)


def active_grant_scopes(organization_id: int, user_id: int, session_id: str) -> set[str]:
    """Unexpired scopes the user approved for the agent in this org + session. Keyed on
    authenticated identity, never client input."""
    scopes: set[str] = set()
    grants = SeerAgentWriteGrant.objects.filter(
        organization_id=organization_id,
        user_id=user_id,
        agent_session_id=session_id,
        expires_at__gt=timezone.now(),
    )
    for grant in grants:
        scopes.update(grant.get_scopes())
    return scopes


def compute_token_scopes(
    caller_scopes: Iterable[str],
    organization_id: int,
    user_id: int,
    session_id: str,
    requested_scopes: Iterable[str] | None = None,
) -> list[str]:
    """De-escalation rule: ``caller_scopes ∩ (read-only ∪ approved grants)``, optionally
    narrowed by ``requested_scopes``. Never exceeds the caller's own authority."""
    caller = set(caller_scopes)
    allowed = readonly_scopes() | active_grant_scopes(organization_id, user_id, session_id)
    effective = caller & allowed
    if requested_scopes is not None:
        effective &= set(requested_scopes)
    return sorted(effective)


def encode_agent_token(
    *,
    user_id: int,
    organization_id: int,
    scopes: Iterable[str],
    session_id: str,
    ttl: timedelta = DEFAULT_TOKEN_TTL,
) -> tuple[str, datetime]:
    """Mint a signed agent token. Returns the JWT and its expiry. No DB write."""
    now = timezone.now()
    expires_at = now + ttl
    payload = {
        "aud": AGENT_TOKEN_AUDIENCE,
        "sub": str(user_id),
        "org": organization_id,
        "scopes": sorted(scopes),
        "sid": session_id,
        "iat": int(now.timestamp()),
        "exp": int(expires_at.timestamp()),
    }
    token = SENTRY_AGENT_TOKEN_PREFIX + jwt.encode(payload, _signing_key(), algorithm="HS256")
    return token, expires_at


def decode_agent_token(token_str: str) -> dict[str, Any]:
    """Verify signature, ``exp`` and ``aud``; return the claims. Raises a pyjwt error on any
    invalid token."""
    if not token_str.startswith(SENTRY_AGENT_TOKEN_PREFIX):
        raise jwt.DecodeError("not an agent token")
    return jwt.decode(
        token_str.removeprefix(SENTRY_AGENT_TOKEN_PREFIX),
        _signing_key(),
        audience=AGENT_TOKEN_AUDIENCE,
        algorithms=["HS256"],
    )


def build_authenticated_token(claims: dict[str, Any]) -> AuthenticatedToken:
    # kind="api_token" routes the token through the ordinary token-scope path (scope
    # intersection with the member's role).
    return AuthenticatedToken(
        kind="api_token",
        scopes=list(claims.get("scopes", [])),
        user_id=int(claims["sub"]),
        organization_id=int(claims["org"]),
    )


def mark_agent_request(request: HttpRequest | Request, claims: dict[str, Any]) -> None:
    setattr(request, _REQUEST_CLAIMS_ATTR, claims)


def get_agent_claims(request: HttpRequest | Request) -> dict[str, Any] | None:
    return getattr(request, _REQUEST_CLAIMS_ATTR, None)


def create_write_grant(
    *, organization_id: int, user_id: int, session_id: str, scopes: Iterable[str]
) -> SeerAgentWriteGrant:
    """Merge ``scopes`` into the single grant for ``(org, user, session)`` and refresh its
    expiry, creating it if absent. The caller MUST have already capped ``scopes`` to the
    approving user's own authority. The unique constraint plus row lock keep concurrent
    approvals from racing."""
    with transaction.atomic(using=router.db_for_write(SeerAgentWriteGrant)):
        grant, created = SeerAgentWriteGrant.objects.select_for_update().get_or_create(
            organization_id=organization_id,
            user_id=user_id,
            agent_session_id=session_id,
            defaults={
                "scope_list": sorted(scopes),
                "expires_at": timezone.now() + DEFAULT_EXPIRATION,
            },
        )
        if not created:
            grant.scope_list = sorted(set(grant.get_scopes()) | set(scopes))
            grant.expires_at = timezone.now() + DEFAULT_EXPIRATION
            grant.save(update_fields=["scope_list", "expires_at", "date_updated"])
    return grant
