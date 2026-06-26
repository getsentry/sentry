"""
Short-lived, scope-bound capability tokens for the Seer agent.

Instead of masking the caller's session scopes inside the access layer, Sentry mints
the agent a real, signed JWT that carries exactly the scopes it is allowed to use right
now: the caller's read-only scopes plus any write scopes the user has approved for this
org and agent session. The agent presents the token as an ordinary ``Authorization:
Bearer`` credential, so enforcement rides Sentry's normal token-scope path — the token's
scopes are intersected with the member's role scopes in ``auth.access`` and nothing
special is needed in the permission layer.

Tokens are not stored: they are verified from their signature and claims and re-minted on
demand. Only :class:`SeerAgentWriteGrant` records (the durable record of user consent)
live in the database.

This module is the server side of the flow:

- :func:`encode_agent_token` / :func:`decode_agent_token` — mint and verify the JWT.
- :func:`compute_token_scopes` — the de-escalation rule used at mint time.
- :func:`build_authenticated_token` — turn verified claims into the ``request.auth`` object
  Sentry's access layer already understands.
- :func:`maybe_challenge` — on a denied agent write the user *could* grant, mint a pending
  grant and raise a structured challenge instead of a bare 403.
"""

from __future__ import annotations

import logging
from collections.abc import Iterable
from datetime import datetime, timedelta
from typing import Any

from django.conf import settings
from django.utils import timezone
from rest_framework import status
from rest_framework.request import Request

from sentry.api.exceptions import SentryAPIException
from sentry.auth.services.auth import AuthenticatedToken
from sentry.organizations.services.organization import organization_service
from sentry.seer.models.agent_write_grant import AgentWriteGrantStatus, SeerAgentWriteGrant
from sentry.utils import jwt

logger = logging.getLogger(__name__)

FEATURE_FLAG = "organizations:seer-agent-token-flow"

# Binds the token to the Sentry agent API so it cannot be replayed against any other
# audience that happens to share the signing secret (e.g. X-Viewer-Context JWTs).
AGENT_TOKEN_AUDIENCE = "sentry-agent-api"

# Short by design: the TTL is the only bound on a leaked token, so keep it small. The
# agent caches the token for its life and re-mints when it expires. Prototype default.
DEFAULT_TOKEN_TTL = timedelta(minutes=5)

# Attribute stashed on the request when an agent token authenticates, so the challenge
# step can recognize an agent write and recover its session id.
_REQUEST_CLAIMS_ATTR = "_agent_token_claims"


class AgentWritePermissionRequired(SentryAPIException):
    # Renders as {"detail": {"code": "agent-write-permission-required", "message": ...,
    # "extra": {required_scopes, operation, organization, nonce, approval_endpoint,
    # expires_at}}}. The Seer side reads `extra` to drive the approval prompt.
    status_code = status.HTTP_403_FORBIDDEN
    code = "agent-write-permission-required"
    message = "This operation requires explicit user permission for the Seer agent."


def _signing_key() -> str:
    return settings.SEER_API_SHARED_SECRET


def readonly_scopes() -> frozenset[str]:
    # Intentionally NOT demo_mode.get_readonly_scopes() — that set also allows
    # project:releases, which is a write the agent must not get by default.
    return frozenset(settings.SENTRY_READONLY_SCOPES)


def active_grant_scopes(organization_id: int, user_id: int, session_id: str) -> set[str]:
    """Scopes the user has approved for the agent in this org and session (and which
    have not expired). Looked up strictly by authenticated identity plus the session id —
    never by other client input — to stay IDOR-safe."""
    scopes: set[str] = set()
    grants = SeerAgentWriteGrant.objects.filter(
        organization_id=organization_id,
        user_id=user_id,
        agent_session_id=session_id,
        status=AgentWriteGrantStatus.APPROVED,
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
    """The de-escalation rule. Effective scopes never exceed the caller's own authority:
    ``caller_scopes ∩ (read-only ∪ approved grants)``, optionally narrowed further by an
    explicit ``requested_scopes`` list. ``requested_scopes`` can only remove scopes."""
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
    token = jwt.encode(payload, _signing_key(), algorithm="HS256")
    return token, expires_at


def looks_like_agent_token(token_str: str) -> bool:
    """Cheap, signature-free check that a bearer credential is one of our agent tokens,
    so the authenticator can defer (return None) on anything else without raising. A real
    decision is always made by :func:`decode_agent_token` afterwards."""
    try:
        claims = jwt.peek_claims(token_str)
    except jwt.DecodeError:
        return False
    return claims.get("aud") == AGENT_TOKEN_AUDIENCE


def decode_agent_token(token_str: str) -> dict[str, Any]:
    """Verify signature, ``exp`` and ``aud`` and return the claims. Raises
    ``jwt.DecodeError`` (or a pyjwt subclass) on any invalid token."""
    return jwt.decode(
        token_str,
        _signing_key(),
        audience=AGENT_TOKEN_AUDIENCE,
        algorithms=["HS256"],
    )


def build_authenticated_token(claims: dict[str, Any]) -> AuthenticatedToken:
    """Turn verified claims into the ``request.auth`` object the access layer understands.

    We use ``kind="api_token"`` so the token flows through the ordinary token-scope path
    (``token_has_org_access`` + scope intersection with the member's role)."""
    return AuthenticatedToken(
        kind="api_token",
        scopes=list(claims.get("scopes", [])),
        user_id=int(claims["sub"]),
        organization_id=int(claims["org"]),
    )


def mark_agent_request(request: Request, claims: dict[str, Any]) -> None:
    setattr(request, _REQUEST_CLAIMS_ATTR, claims)


def get_agent_claims(request: Request) -> dict[str, Any] | None:
    return getattr(request, _REQUEST_CLAIMS_ATTR, None)


def _describe_operation(request: Request) -> str:
    return f"{request.method} {request.path}"


def _find_or_create_pending_grant(
    organization_id: int, user_id: int, session_id: str, scopes: list[str], operation: str
) -> SeerAgentWriteGrant:
    existing = SeerAgentWriteGrant.objects.filter(
        organization_id=organization_id,
        user_id=user_id,
        agent_session_id=session_id,
        status=AgentWriteGrantStatus.PENDING,
        scope_list=scopes,
        expires_at__gt=timezone.now(),
    ).first()
    if existing is not None:
        return existing
    return SeerAgentWriteGrant.objects.create(
        organization_id=organization_id,
        user_id=user_id,
        agent_session_id=session_id,
        scope_list=scopes,
        status=AgentWriteGrantStatus.PENDING,
        operation=operation,
    )


def maybe_challenge(request: Request, required_scopes: Iterable[str]) -> None:
    """If an agent-token request was denied and the acting user's role actually holds one
    of the required scopes, mint a pending grant and raise a structured challenge.
    Otherwise do nothing — an ordinary denial follows.

    Everything is derived from the signed token claims (org, user, session), never from
    the URL or body, so the challenge is bound to the same identity the token authorized.
    """
    claims = get_agent_claims(request)
    if claims is None:
        return

    organization_id = int(claims["org"])
    user_id = int(claims["sub"])
    session_id = claims["sid"]

    # One lookup gives us both the org slug (for the approval URL) and the member's role
    # scopes. Looked up by authenticated identity, never client input, so it is IDOR-safe.
    org_context = organization_service.get_organization_by_id(id=organization_id, user_id=user_id)
    if org_context is None:
        return
    member = org_context.member
    if member is None or not member.scopes:
        return
    role_scopes = set(member.scopes)

    # Only scopes the user genuinely holds are grantable; the agent can never be granted
    # more than the user. The authoritative re-check still happens at mint time, but we
    # avoid offering a prompt the user could not fulfill.
    grantable = sorted(s for s in required_scopes if s in role_scopes)
    if not grantable:
        return

    org_slug = org_context.organization.slug
    grant = _find_or_create_pending_grant(
        organization_id=organization_id,
        user_id=user_id,
        session_id=session_id,
        scopes=grantable,
        operation=_describe_operation(request),
    )

    raise AgentWritePermissionRequired(
        required_scopes=grantable,
        operation=grant.operation,
        organization=org_slug,
        nonce=grant.nonce,
        approval_endpoint=f"/api/0/organizations/{org_slug}/agent/approve/{grant.nonce}/",
        expires_at=grant.expires_at.isoformat(),
    )
