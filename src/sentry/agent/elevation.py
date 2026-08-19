"""Cache-based elevation requests for biscuit agent tokens.

An elevation request is a short-lived record asking the user to approve
write-scope escalation for an agent session. The record lives in Django
cache (Redis) — no DB migration needed. Pending requests expire after 2 min;
approved/denied results stick around for 5 min so the MCP server can poll.
"""

from __future__ import annotations

import secrets
from dataclasses import dataclass
from datetime import datetime, timedelta

import logging

from django.utils import timezone

from sentry.agent.biscuit_token import DEFAULT_TOKEN_TTL, mint_biscuit_token
from sentry.cache import default_cache as cache
from sentry.seer.agent_token import create_write_grant

logger = logging.getLogger(__name__)

CACHE_PREFIX = "agent:elevation:"
PENDING_TTL_SECONDS = 600  # 10 min — user needs time to open the URL in browser
RESULT_TTL_SECONDS = 300
ELEVATION_GRANT_TTL = timedelta(minutes=5)


@dataclass
class ElevationRequest:
    elevation_id: str
    session_id: str
    user_id: int
    organization_id: int
    requested_scopes: list[str]
    max_scopes: list[str]
    status: str  # pending | approved | denied
    elevated_token: str | None = None
    elevated_expires_at: datetime | None = None
    created_at: datetime | None = None


def _cache_key(elevation_id: str) -> str:
    return f"{CACHE_PREFIX}{elevation_id}"


def _to_dict(req: ElevationRequest) -> dict:
    return {
        "elevation_id": req.elevation_id,
        "session_id": req.session_id,
        "user_id": req.user_id,
        "organization_id": req.organization_id,
        "requested_scopes": req.requested_scopes,
        "max_scopes": req.max_scopes,
        "status": req.status,
        "elevated_token": req.elevated_token,
        "elevated_expires_at": req.elevated_expires_at.isoformat() if req.elevated_expires_at else None,
        "created_at": req.created_at.isoformat() if req.created_at else None,
    }


def _from_dict(data: dict) -> ElevationRequest:
    return ElevationRequest(
        elevation_id=data["elevation_id"],
        session_id=data["session_id"],
        user_id=data["user_id"],
        organization_id=data["organization_id"],
        requested_scopes=data["requested_scopes"],
        max_scopes=data["max_scopes"],
        status=data["status"],
        elevated_token=data.get("elevated_token"),
        elevated_expires_at=(
            datetime.fromisoformat(data["elevated_expires_at"])
            if data.get("elevated_expires_at")
            else None
        ),
        created_at=(
            datetime.fromisoformat(data["created_at"]) if data.get("created_at") else None
        ),
    )


def create_elevation_request(
    *,
    session_id: str,
    user_id: int,
    organization_id: int,
    requested_scopes: list[str],
    max_scopes: list[str],
) -> ElevationRequest:
    elevation_id = secrets.token_urlsafe(32)
    req = ElevationRequest(
        elevation_id=elevation_id,
        session_id=session_id,
        user_id=user_id,
        organization_id=organization_id,
        requested_scopes=requested_scopes,
        max_scopes=max_scopes,
        status="pending",
        created_at=timezone.now(),
    )
    key = _cache_key(elevation_id)
    cache.set(key, _to_dict(req), timeout=PENDING_TTL_SECONDS)
    verify = cache.get(key)
    logger.info(
        "elevation.create",
        extra={
            "elevation_id": elevation_id,
            "cache_key": key,
            "readback": verify is not None,
            "cache_backend": type(cache).__name__,
        },
    )
    return req


def get_elevation_request(elevation_id: str) -> ElevationRequest | None:
    key = _cache_key(elevation_id)
    data = cache.get(key)
    logger.info(
        "elevation.get",
        extra={"elevation_id": elevation_id, "cache_key": key, "found": data is not None},
    )
    if data is None:
        return None
    return _from_dict(data)


def approve_elevation_request(
    elevation_id: str,
    *,
    approved_scopes: list[str],
) -> ElevationRequest | None:
    """Approve the request: mint an elevated biscuit and persist a write grant."""
    req = get_elevation_request(elevation_id)
    if req is None or req.status != "pending":
        return None

    create_write_grant(
        organization_id=req.organization_id,
        user_id=req.user_id,
        session_id=req.session_id,
        scopes=approved_scopes,
        ttl=ELEVATION_GRANT_TTL,
    )

    token, expires_at = mint_biscuit_token(
        user_id=req.user_id,
        organization_id=req.organization_id,
        scopes=approved_scopes,
        session_id=req.session_id,
        max_scopes=req.max_scopes,
        ttl=DEFAULT_TOKEN_TTL,
    )

    req.status = "approved"
    req.elevated_token = token
    req.elevated_expires_at = expires_at
    cache.set(_cache_key(elevation_id), _to_dict(req), timeout=RESULT_TTL_SECONDS)
    return req


def deny_elevation_request(elevation_id: str) -> ElevationRequest | None:
    req = get_elevation_request(elevation_id)
    if req is None or req.status != "pending":
        return None

    req.status = "denied"
    cache.set(_cache_key(elevation_id), _to_dict(req), timeout=RESULT_TTL_SECONDS)
    return req
