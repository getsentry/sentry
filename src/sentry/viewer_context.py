from __future__ import annotations

import contextlib
import contextvars
import dataclasses
import enum
import hashlib
import hmac
import logging
import time
from collections.abc import Generator
from typing import TYPE_CHECKING, Any

import jwt as pyjwt
import orjson
from django.conf import settings

logger = logging.getLogger(__name__)

if TYPE_CHECKING:
    from sentry.auth.services.auth import AuthenticatedToken

_viewer_context_var: contextvars.ContextVar[ViewerContext | None] = contextvars.ContextVar(
    "viewer_context", default=None
)

"""
ViewerContext is an object propagated across codebase (and crossing service boundary) to deliver
accurate information regarding the viewer on behalf of which the request is being made.

This can be global, limited to an organization, or particular user.

The proposal for this project alongside needs and specific considerations can be found in:
https://www.notion.so/sentry/RFC-Unified-ViewerContext-via-ContextVar-32f8b10e4b5d81988625cb5787035e02
"""


class ActorType(enum.StrEnum):
    USER = "user"
    SYSTEM = "system"
    INTEGRATION = "integration"
    UNKNOWN = "unknown"


@dataclasses.dataclass(frozen=True)
class ViewerContext:
    """Identity of the caller for the current unit of work.

    Set once at each entrypoint (API request, task, consumer, RPC) via
    ``viewer_context_scope`` and readable anywhere via ``get_viewer_context``.

    Frozen so that ``copy_context()`` produces a safe shallow copy when
    propagating across threads.
    """

    organization_id: int | None = None
    user_id: int | None = None
    actor_type: ActorType = ActorType.UNKNOWN

    # Carries scopes/kind for in-process permission checks.
    # NOT propagated across process/service boundaries.
    token: AuthenticatedToken | None = None

    def serialize(self) -> dict[str, Any]:
        """Serialize to a dict for cross-service headers (e.g. X-Viewer-Context)."""
        result: dict[str, Any] = {"actor_type": self.actor_type.value}
        if self.organization_id is not None:
            result["organization_id"] = self.organization_id
        if self.user_id is not None:
            result["user_id"] = self.user_id
        return result

    @classmethod
    def deserialize(cls, data: dict[str, Any]) -> ViewerContext:
        """Reconstruct from a serialized dict. Token is not deserialized."""
        try:
            actor_type = ActorType(data.get("actor_type", "unknown"))
        except ValueError:
            actor_type = ActorType.UNKNOWN
        return cls(
            organization_id=data.get("organization_id"),
            user_id=data.get("user_id"),
            actor_type=actor_type,
        )


@contextlib.contextmanager
def viewer_context_scope(ctx: ViewerContext) -> Generator[None]:
    """Enter a viewer context for the duration of a unit of work.

    Always use this instead of raw ``_viewer_context_var.set()`` —
    it guarantees cleanup via ``reset(token)`` even on exceptions.
    """
    tok = _viewer_context_var.set(ctx)
    try:
        yield
    finally:
        _viewer_context_var.reset(tok)


def get_viewer_context() -> ViewerContext | None:
    """Return the current ``ViewerContext``, or ``None`` if not set."""
    return _viewer_context_var.get()


# ---------------------------------------------------------------------------
# JWT encoding / decoding for cross-service propagation
# ---------------------------------------------------------------------------

_JWT_STANDARD_CLAIMS = frozenset({"iat", "exp", "iss", "aud", "nbf", "jti", "sub"})
# JWT header field identifying which key was used for signing (RFC 7515 §4.1.4).
_JWT_KEY_ID_HEADER = "kid"


def _key_id(key: str) -> str:
    """Short stable identifier for a key (first 8 hex chars of SHA-256).

    Embedded as ``kid`` in the JWT header so the receiver can look up the
    correct verification key without trying every key it knows about.
    """
    return hashlib.sha256(key.encode("utf-8")).hexdigest()[:8]


def _get_signing_key(key: str | None = None) -> str:
    """Return the key to use for JWT signing.

    Resolution: explicit *key* → ``SEER_API_SHARED_SECRET``.

    TODO: Add a dedicated ``VIEWER_CONTEXT_JWT_SECRET`` setting so that
    ViewerContext signing is not coupled to the Seer shared secret.
    """
    if key is not None:
        return key

    secret = getattr(settings, "SEER_API_SHARED_SECRET", "")
    if secret:
        return secret

    raise ValueError("No signing key available. Set SEER_API_SHARED_SECRET in settings.")


def _get_verification_keys() -> dict[str, str]:
    """Return a ``{kid: key}`` mapping of all known verification keys.

    Add new service keys here as more services propagate ViewerContext.
    """
    keys: dict[str, str] = {}

    seer_secret = getattr(settings, "SEER_API_SHARED_SECRET", "")
    if seer_secret:
        keys[_key_id(seer_secret)] = seer_secret

    return keys


def encode_viewer_context(
    viewer_context: ViewerContext,
    *,
    key: str | None = None,
    ttl: int | None = None,
) -> str:
    """Encode a :class:`ViewerContext` as a signed HS256 JWT."""
    secret = _get_signing_key(key)

    if ttl is None:
        ttl = getattr(settings, "VIEWER_CONTEXT_JWT_TTL", 900)

    now = time.time()
    payload: dict[str, Any] = {
        **viewer_context.serialize(),
        "iat": now,
        "exp": now + ttl,
        "iss": "sentry",
    }

    return pyjwt.encode(
        payload, secret, algorithm="HS256", headers={_JWT_KEY_ID_HEADER: _key_id(secret)}
    )


def decode_viewer_context(
    token: str,
    *,
    key: str | None = None,
    leeway: int = 5,
) -> ViewerContext:
    """Decode and verify an HS256 JWT into a :class:`ViewerContext`.

    When *key* is provided it is used directly.  Otherwise all keys
    from ``_get_verification_keys()`` are tried, kid-matched key first.
    """
    if key is not None:
        secret = key
    else:
        keys_by_kid = _get_verification_keys()
        if not keys_by_kid:
            raise ValueError("No verification keys available.")

        kid = pyjwt.get_unverified_header(token).get(_JWT_KEY_ID_HEADER)
        secret = keys_by_kid.get(kid, "") if kid else ""
        if not secret:
            raise pyjwt.exceptions.InvalidKeyError(f"No verification key matches kid={kid!r}")

    claims = pyjwt.decode(
        token,
        secret,
        algorithms=["HS256"],
        options={"require": ["iat", "exp", "iss"]},
        issuer="sentry",
        leeway=leeway,
    )
    vc_data = {ck: cv for ck, cv in claims.items() if ck not in _JWT_STANDARD_CLAIMS}
    return ViewerContext.deserialize(vc_data)


def viewer_context_from_header(
    header_value: str, signature: str | None = None
) -> ViewerContext | None:
    """Decode a ViewerContext from ``X-Viewer-Context`` header(s).

    Dual-mode for migration:
    - JWT (HS256) — new format, self-contained
    - Raw JSON + ``X-Viewer-Context-Signature`` HMAC — legacy format
    """
    if is_jwt_viewer_context(header_value):
        try:
            return decode_viewer_context(header_value)
        except Exception:
            logger.warning("viewer_context.jwt_decode_failed", exc_info=True)
            return None

    # Legacy: raw JSON + HMAC signature
    if signature is not None:
        return _verify_legacy_viewer_context(header_value, signature)

    return None


def _verify_legacy_viewer_context(context_json: str, signature: str) -> ViewerContext | None:
    """Verify and decode a legacy JSON + HMAC-signed viewer context."""
    keys_by_kid = _get_verification_keys()
    context_bytes = context_json.encode("utf-8")

    for key in keys_by_kid.values():
        computed = hmac.new(key.encode("utf-8"), context_bytes, hashlib.sha256).hexdigest()
        if hmac.compare_digest(computed, signature):
            try:
                data = orjson.loads(context_bytes)
                return ViewerContext.deserialize(data)
            except Exception:
                logger.warning("viewer_context.legacy_decode_failed", exc_info=True)
                return None

    logger.warning("viewer_context.legacy_signature_mismatch")
    return None


def is_jwt_viewer_context(header_value: str) -> bool:
    """Check whether the header value is a JWT by attempting to read its header.

    Uses PyJWT's own parser — raises ``DecodeError`` on anything that
    isn't a valid JWT structure (raw JSON, empty string, etc.).
    """
    try:
        pyjwt.get_unverified_header(header_value)
        return True
    except pyjwt.exceptions.DecodeError:
        return False
