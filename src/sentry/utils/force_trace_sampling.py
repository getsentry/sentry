"""
Short-lived, signed grants that let an employee force their own traces to be sampled.

The SDK makes its sampling decision in the WSGI layer, before Django authenticates the
request, so `traces_sampler` can't look at `request.user`. It verifies this signed cookie
instead, which needs no database access.
"""

from __future__ import annotations

import time
from collections.abc import Mapping
from dataclasses import dataclass
from typing import Any

from django.core import signing
from django.http import parse_cookie

from sentry import options

COOKIE_NAME = "sentry-force-trace-sampling"
MAX_AGE_SECONDS = 15 * 60

_SALT = "sentry.utils.force_trace_sampling"


@dataclass(frozen=True)
class ForceSamplingGrant:
    user_id: int
    expires_at_ms: int


def create_grant_token(user_id: int) -> tuple[str, int]:
    """Returns a signed token and its expiry in milliseconds since the epoch."""
    expires_at_ms = int((time.time() + MAX_AGE_SECONDS) * 1000)
    token = signing.dumps({"user_id": user_id, "expires_at_ms": expires_at_ms}, salt=_SALT)
    return token, expires_at_ms


def read_grant(token: str | None) -> ForceSamplingGrant | None:
    """Returns the grant if the token is authentic, unexpired, and the feature is enabled."""
    if not token or not options.get("tracing.force-sampling.enabled"):
        return None

    try:
        payload = signing.loads(token, salt=_SALT, max_age=MAX_AGE_SECONDS)
    except signing.BadSignature:
        return None

    return ForceSamplingGrant(user_id=payload["user_id"], expires_at_ms=payload["expires_at_ms"])


def has_valid_grant_cookie(wsgi_environ: Mapping[str, Any] | None) -> bool:
    """
    Whether this WSGI request carries a valid grant.

    Runs on every unparented request, so it skips parsing unless the cookie is present.
    """
    raw_cookies = wsgi_environ.get("HTTP_COOKIE") if wsgi_environ else None
    if not raw_cookies or COOKIE_NAME not in raw_cookies:
        return False

    return read_grant(parse_cookie(raw_cookies).get(COOKIE_NAME)) is not None
