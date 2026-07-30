"""Short-lived, scope-bound capability tokens for the Seer agent.

Tokens are signed JWTs, not stored (verified by signature/claims, re-minted on demand);
only :class:`SeerAgentWriteGrant`, the durable record of user consent, persists.
"""

from __future__ import annotations

from collections.abc import Iterable
from datetime import datetime, timedelta
from typing import Any, TypedDict

from django.conf import settings
from django.db import router, transaction
from django.utils import timezone
from jwt import PyJWTError

from sentry.auth.services.auth import AuthenticatedToken
from sentry.seer.models.agent_write_grant import (
    AGENT_SESSION_ID_MAX_LENGTH,
    DEFAULT_EXPIRATION,
    SeerAgentWriteGrant,
)
from sentry.utils import jwt

FEATURE_FLAG = "organizations:seer-agent-token-flow"

# Distinct audience so the token can't be replayed against another audience that shares the
# signing secret (e.g. X-Viewer-Context JWTs).
AGENT_TOKEN_AUDIENCE = "sentry-agent-api"
AGENT_TOKEN_TYPE = "sentry-agent+jwt"

# TTL is the only bound on a leaked token, so keep it short.
DEFAULT_TOKEN_TTL = timedelta(minutes=5)

AGENT_TOKEN_KIND = "agent_token"


class AgentTokenClaims(TypedDict):
    aud: str
    sub: str
    org: int
    scopes: list[str]
    sid: str
    iat: int
    exp: int


def _signing_key() -> str:
    key = settings.SEER_API_SHARED_SECRET
    if not key:
        raise ValueError("No agent token signing key configured.")
    return key


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
    payload: AgentTokenClaims = {
        "aud": AGENT_TOKEN_AUDIENCE,
        "sub": str(user_id),
        "org": organization_id,
        "scopes": sorted(scopes),
        "sid": session_id,
        "iat": int(now.timestamp()),
        "exp": int(expires_at.timestamp()),
    }
    token = jwt.encode(
        payload,
        _signing_key(),
        algorithm="HS256",
        headers={"typ": AGENT_TOKEN_TYPE},
    )
    return token, expires_at


def is_agent_token_string(token_str: str) -> bool:
    """Whether a bearer value should be routed to agent-token authentication.

    The header is only a routing hint here. ``decode_agent_token`` still verifies the signature,
    audience, expiry, algorithm, and protected ``typ`` before the credential is trusted.
    """
    try:
        return jwt.peek_header(token_str).get("typ") == AGENT_TOKEN_TYPE
    except PyJWTError:
        return False


def _validate_claims(claims: dict[str, Any]) -> AgentTokenClaims:
    required = ("aud", "sub", "org", "scopes", "sid", "iat", "exp")
    if any(name not in claims for name in required):
        raise jwt.DecodeError("missing agent token claim")
    if claims["aud"] != AGENT_TOKEN_AUDIENCE:
        raise jwt.DecodeError("invalid agent token audience")
    if not isinstance(claims["sub"], str) or not claims["sub"].isdigit():
        raise jwt.DecodeError("invalid agent token subject")
    if not isinstance(claims["org"], int) or isinstance(claims["org"], bool):
        raise jwt.DecodeError("invalid agent token organization")
    scopes = claims["scopes"]
    if not isinstance(scopes, list) or not all(isinstance(scope, str) for scope in scopes):
        raise jwt.DecodeError("invalid agent token scopes")
    session_id = claims["sid"]
    if (
        not isinstance(session_id, str)
        or not session_id
        or len(session_id) > AGENT_SESSION_ID_MAX_LENGTH
    ):
        raise jwt.DecodeError("invalid agent token session")
    for claim_name in ("iat", "exp"):
        value = claims[claim_name]
        if not isinstance(value, int) or isinstance(value, bool):
            raise jwt.DecodeError(f"invalid agent token {claim_name}")
    if claims["exp"] <= claims["iat"]:
        raise jwt.DecodeError("invalid agent token lifetime")
    return {
        "aud": claims["aud"],
        "sub": claims["sub"],
        "org": claims["org"],
        "scopes": scopes,
        "sid": session_id,
        "iat": claims["iat"],
        "exp": claims["exp"],
    }


def decode_agent_token(token_str: str) -> AgentTokenClaims:
    """Verify signature, ``exp`` and ``aud``; return the claims. Raises a pyjwt error on any
    invalid token."""
    if not is_agent_token_string(token_str):
        raise jwt.DecodeError("not an agent token")
    claims = jwt.decode(
        token_str,
        _signing_key(),
        audience=AGENT_TOKEN_AUDIENCE,
        algorithms=["HS256"],
    )
    return _validate_claims(claims)


def is_agent_auth(auth: Any) -> bool:
    """Whether an authenticated credential is a Seer agent capability token."""
    return getattr(auth, "kind", None) == AGENT_TOKEN_KIND


def build_authenticated_token(claims: AgentTokenClaims) -> AuthenticatedToken:
    """Build a delegated-user credential from claims verified by ``decode_agent_token``."""
    return AuthenticatedToken(
        kind=AGENT_TOKEN_KIND,
        scopes=claims["scopes"],
        user_id=int(claims["sub"]),
        organization_id=claims["org"],
    )


def create_write_grant(
    *, organization_id: int, user_id: int, session_id: str, scopes: Iterable[str]
) -> SeerAgentWriteGrant:
    """Merge ``scopes`` into the single grant for ``(org, user, session)`` and refresh its
    expiry, creating it if absent. The caller MUST have already capped ``scopes`` to the
    approving user's own authority. The unique constraint plus row lock keep concurrent
    approvals from racing."""
    now = timezone.now()
    with transaction.atomic(using=router.db_for_write(SeerAgentWriteGrant)):
        grant, created = SeerAgentWriteGrant.objects.select_for_update().get_or_create(
            organization_id=organization_id,
            user_id=user_id,
            agent_session_id=session_id,
            defaults={
                "scope_list": sorted(scopes),
            },
        )
        if not created:
            previous_scopes = set() if grant.expires_at <= now else set(grant.get_scopes())
            grant.scope_list = sorted(previous_scopes | set(scopes))
            grant.expires_at = now + DEFAULT_EXPIRATION
            grant.save(update_fields=["scope_list", "expires_at", "date_updated"])
    return grant
