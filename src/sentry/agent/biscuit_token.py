"""Biscuit capability tokens for AI agents (Ed25519, asymmetric).

Tokens are minted and verified using a root Ed25519 keypair. The authority
block carries user/org/scope facts and a time-bound check. Scope escalation
requires out-of-band user approval; the refresh endpoint only re-mints at
baseline.
"""

from __future__ import annotations

import re
from collections.abc import Iterable
from dataclasses import dataclass, field
from datetime import datetime, timedelta

from django.conf import settings
from django.utils import timezone

from sentry.auth.services.auth import AuthenticatedToken

FEATURE_FLAG = "organizations:agent-biscuit-token-flow"

BISCUIT_TOKEN_PREFIX = "sntryb_"
BISCUIT_TOKEN_KIND = "biscuit_agent_token"
DEFAULT_TOKEN_TTL = timedelta(minutes=5)
INITIAL_TOKEN_TTL = timedelta(hours=4)

_SCOPE_FACT_RE = re.compile(r'^scope\("([^"]+)"\)$')
_MAX_SCOPE_FACT_RE = re.compile(r'^max_scope\("([^"]+)"\)$')
_SESSION_FACT_RE = re.compile(r'^session\("([^"]+)"\)$')
_USER_FACT_RE = re.compile(r"^user\((\d+)\)$")
_ORG_FACT_RE = re.compile(r"^org\((\d+)\)$")


@dataclass(frozen=True)
class BiscuitTokenClaims:
    user_id: int
    organization_id: int
    scopes: list[str]
    session_id: str
    max_scopes: list[str] = field(default_factory=list)


def _root_private_key():  # type: ignore[no-untyped-def]
    from biscuit_auth import Algorithm, PrivateKey

    key_hex = settings.BISCUIT_AGENT_ROOT_PRIVATE_KEY
    if not key_hex:
        raise ValueError("BISCUIT_AGENT_ROOT_PRIVATE_KEY not configured.")
    return PrivateKey.from_bytes(bytes.fromhex(key_hex), Algorithm.Ed25519)


def _root_public_key():  # type: ignore[no-untyped-def]
    from biscuit_auth import Algorithm, PublicKey

    key_hex = settings.BISCUIT_AGENT_ROOT_PUBLIC_KEY
    if not key_hex:
        raise ValueError("BISCUIT_AGENT_ROOT_PUBLIC_KEY not configured.")
    return PublicKey.from_bytes(bytes.fromhex(key_hex), Algorithm.Ed25519)


_SAFE_SESSION_ID_RE = re.compile(r"^[A-Za-z0-9_\-]{1,128}$")
_SAFE_SCOPE_RE = re.compile(r"^[a-z][a-z0-9:\-]{0,63}$")


def _validate_session_id(session_id: str) -> str:
    if not _SAFE_SESSION_ID_RE.match(session_id):
        raise ValueError("Invalid session_id: must be 1-128 alphanumeric/dash/underscore chars")
    return session_id


def _validate_scopes(scopes: Iterable[str]) -> list[str]:
    validated = []
    for s in scopes:
        if not _SAFE_SCOPE_RE.match(s):
            raise ValueError(f"Invalid scope string: {s!r}")
        validated.append(s)
    return validated


def is_biscuit_token_string(token_str: str) -> bool:
    return token_str.startswith(BISCUIT_TOKEN_PREFIX)


def mint_biscuit_token(
    *,
    user_id: int,
    organization_id: int,
    scopes: list[str],
    session_id: str,
    max_scopes: list[str] | None = None,
    ttl: timedelta = DEFAULT_TOKEN_TTL,
) -> tuple[str, datetime]:
    """Mint a signed biscuit token. Returns ``(prefixed_token, expires_at)``."""
    from biscuit_auth import BiscuitBuilder

    safe_session = _validate_session_id(session_id)
    safe_scopes = _validate_scopes(scopes)
    effective_max = max_scopes if max_scopes is not None else list(scopes)
    safe_max = _validate_scopes(effective_max)

    now = timezone.now()
    expires_at = now + ttl
    exp_unix = int(expires_at.timestamp())

    facts = f"user({user_id}); org({organization_id}); session(\"{safe_session}\");"
    for scope in sorted(safe_scopes):
        facts += f' scope("{scope}");'

    for scope in sorted(safe_max):
        facts += f' max_scope("{scope}");'

    facts += f" check if time($t), $t < {exp_unix};"

    builder = BiscuitBuilder(facts)
    token = builder.build(_root_private_key())
    serialized = token.to_base64()

    return BISCUIT_TOKEN_PREFIX + serialized, expires_at


def verify_biscuit_token(token_str: str) -> BiscuitTokenClaims:
    """Verify signature and time check; extract claims. Raises on invalid token."""
    from biscuit_auth import AuthorizerBuilder, AuthorizationError, Biscuit, BiscuitValidationError

    if not is_biscuit_token_string(token_str):
        raise ValueError("Not a biscuit agent token")

    raw = token_str[len(BISCUIT_TOKEN_PREFIX) :]

    try:
        biscuit = Biscuit.from_base64(raw, _root_public_key())
    except BiscuitValidationError as e:
        raise ValueError(f"Invalid biscuit token: {e}") from e

    now_unix = int(timezone.now().timestamp())
    ab = AuthorizerBuilder(f"time({now_unix}); allow if true;")
    auth = ab.build(biscuit)

    try:
        auth.authorize()
    except AuthorizationError as e:
        raise ValueError(f"Biscuit authorization failed (likely expired): {e}") from e

    return _extract_claims(biscuit)


def _extract_claims(biscuit) -> BiscuitTokenClaims:  # type: ignore[no-untyped-def]
    source = biscuit.block_source(0)

    user_id: int | None = None
    organization_id: int | None = None
    session_id: str | None = None
    scopes: list[str] = []
    max_scopes: list[str] = []

    for line in source.split(";"):
        fact = line.strip()
        if not fact or fact.startswith("check"):
            continue

        if m := _USER_FACT_RE.match(fact):
            user_id = int(m.group(1))
        elif m := _ORG_FACT_RE.match(fact):
            organization_id = int(m.group(1))
        elif m := _SESSION_FACT_RE.match(fact):
            session_id = m.group(1)
        elif m := _SCOPE_FACT_RE.match(fact):
            scopes.append(m.group(1))
        elif m := _MAX_SCOPE_FACT_RE.match(fact):
            max_scopes.append(m.group(1))

    if user_id is None or organization_id is None or session_id is None:
        raise ValueError("Biscuit token missing required facts")

    _validate_session_id(session_id)
    _validate_scopes(scopes)
    _validate_scopes(max_scopes)

    return BiscuitTokenClaims(
        user_id=user_id,
        organization_id=organization_id,
        scopes=sorted(scopes),
        session_id=session_id,
        max_scopes=sorted(max_scopes),
    )


def build_authenticated_token(claims: BiscuitTokenClaims) -> AuthenticatedToken:
    return AuthenticatedToken(
        kind=BISCUIT_TOKEN_KIND,
        scopes=claims.scopes,
        user_id=claims.user_id,
        organization_id=claims.organization_id,
    )
