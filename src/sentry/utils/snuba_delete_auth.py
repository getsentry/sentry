"""Mint short-lived service tokens for Snuba destructive endpoints.

Claims are derived from trusted server-side ids after Sentry has already
authorized the user/system action. Never pass through request-body tenant
fields. Mesh workload identity should replace this JWT later.
"""

from __future__ import annotations

from collections.abc import Iterable
from datetime import UTC, datetime, timedelta

import jwt
from django.conf import settings

SNUBA_DELETE_AUDIENCE = "snuba-deletes"
SNUBA_DELETE_PRINCIPAL = "sentry-delete"
SNUBA_DELETE_TTL_SECONDS = 60


def mint_snuba_delete_token(
    *,
    project_ids: Iterable[int],
    organization_ids: Iterable[int],
) -> str:
    secret = getattr(settings, "SENTRY_SNUBA_DELETE_AUTH_SECRET", "") or ""
    if not secret:
        raise RuntimeError("SENTRY_SNUBA_DELETE_AUTH_SECRET is not configured")

    now = datetime.now(tz=UTC)
    payload = {
        "iss": "sentry",
        "aud": SNUBA_DELETE_AUDIENCE,
        "sub": SNUBA_DELETE_PRINCIPAL,
        "iat": int(now.timestamp()),
        "exp": int((now + timedelta(seconds=SNUBA_DELETE_TTL_SECONDS)).timestamp()),
        "project_ids": [int(pid) for pid in project_ids],
        "organization_ids": [int(oid) for oid in organization_ids],
    }
    return jwt.encode(payload, secret, algorithm="HS256")


def snuba_delete_auth_headers(
    *,
    project_ids: Iterable[int],
    organization_ids: Iterable[int],
) -> dict[str, str]:
    secret = getattr(settings, "SENTRY_SNUBA_DELETE_AUTH_SECRET", "") or ""
    if not secret:
        # Allow this PR to land before snuba enforce. Once snuba AuthN is on,
        # an empty secret makes snuba fail closed (401).
        return {}
    token = mint_snuba_delete_token(
        project_ids=project_ids,
        organization_ids=organization_ids,
    )
    return {"Authorization": f"Bearer {token}"}
