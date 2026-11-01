"""Bearer tokens for service accounts, for clients outside Sentry (curl, CI, MCP).

EXPERIMENT, not for production. Tokens are signed JWTs, not stored: a token only
names the account, and every request reads the account's scopes and projects from
its cell replica. Revoke by disabling or deleting the account. A production version
would store hashed tokens like `OrgAuthToken`, with per-token revoke and last use.
"""

from __future__ import annotations

from datetime import datetime, timedelta
from typing import TypedDict
from uuid import uuid4

from django.conf import settings
from django.utils import timezone

from sentry.utils import jwt

SERVICE_ACCOUNT_TOKEN_PREFIX = "sntrysa_"
# Distinct audience so the token can't be replayed as another JWT signed with the same key.
SERVICE_ACCOUNT_TOKEN_AUDIENCE = "sentry-service-account-api"
SERVICE_ACCOUNT_TOKEN_TYPE = "sentry-service-account+jwt"
SERVICE_ACCOUNT_TOKEN_VERSION = 1
SUBJECT_PREFIX = "service_account:"

DEFAULT_TOKEN_TTL = timedelta(hours=24)
MAX_TOKEN_TTL = timedelta(days=30)


class ServiceAccountTokenClaims(TypedDict):
    ver: int
    aud: str
    sub: str
    org: int
    iat: int
    exp: int
    jti: str


def _signing_key() -> str:
    # Sentry's own secret, not the one shared with Seer, so only Sentry can mint these.
    return settings.SECRET_KEY


def is_service_account_token_string(token_str: str) -> bool:
    return token_str.startswith(SERVICE_ACCOUNT_TOKEN_PREFIX)


def encode_service_account_token(
    *, service_account_id: int, organization_id: int, ttl: timedelta = DEFAULT_TOKEN_TTL
) -> tuple[str, datetime]:
    """Mint a token for a service account. Returns the token and its expiry. No DB write."""
    now = timezone.now()
    expires_at = now + ttl
    claims: ServiceAccountTokenClaims = {
        "ver": SERVICE_ACCOUNT_TOKEN_VERSION,
        "aud": SERVICE_ACCOUNT_TOKEN_AUDIENCE,
        "sub": f"{SUBJECT_PREFIX}{service_account_id}",
        "org": organization_id,
        "iat": int(now.timestamp()),
        "exp": int(expires_at.timestamp()),
        "jti": uuid4().hex,
    }
    token = jwt.encode(
        claims, _signing_key(), algorithm="HS256", headers={"typ": SERVICE_ACCOUNT_TOKEN_TYPE}
    )
    return SERVICE_ACCOUNT_TOKEN_PREFIX + token, expires_at


def decode_service_account_token(token_str: str) -> tuple[int, int]:
    """Verify a token and return ``(service_account_id, organization_id)``. Raises a pyjwt
    error on any invalid token."""
    if not is_service_account_token_string(token_str):
        raise jwt.DecodeError("not a service account token")
    claims = jwt.decode(
        token_str.removeprefix(SERVICE_ACCOUNT_TOKEN_PREFIX),
        _signing_key(),
        audience=SERVICE_ACCOUNT_TOKEN_AUDIENCE,
        algorithms=["HS256"],
    )
    if claims.get("ver") != SERVICE_ACCOUNT_TOKEN_VERSION:
        raise jwt.DecodeError("unsupported service account token version")
    subject = claims.get("sub")
    if (
        not isinstance(subject, str)
        or not subject.startswith(SUBJECT_PREFIX)
        or not subject.removeprefix(SUBJECT_PREFIX).isdigit()
    ):
        raise jwt.DecodeError("invalid service account token subject")
    organization_id = claims.get("org")
    if not isinstance(organization_id, int) or isinstance(organization_id, bool):
        raise jwt.DecodeError("invalid service account token organization")
    return int(subject.removeprefix(SUBJECT_PREFIX)), organization_id
