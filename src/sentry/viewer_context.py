from __future__ import annotations

import contextlib
import contextvars
import dataclasses
import enum
import hashlib
import logging
import time
from collections.abc import Generator, Mapping
from random import random
from typing import Any, NamedTuple

import jwt as pyjwt
import sentry_sdk
from django.conf import settings

from sentry.silo.base import SiloMode
from sentry.types.superuser import SUPERUSER_ACCESS_TTL, SuperuserAccess

logger = logging.getLogger(__name__)

# Sentinel for `observe_viewer_context_propagation(ctx=...)`: distinguishes
# "caller passed None" from "caller didn't pass ctx".
_OBSERVE_USE_CONTEXTVAR: Any = object()

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
    SERVICE_ACCOUNT = "service_account"
    SYSTEM = "system"
    INTEGRATION = "integration"
    AGENT = "agent"
    UNKNOWN = "unknown"


class ActorId(NamedTuple):
    type: ActorType
    id: int | None


@dataclasses.dataclass(frozen=True)
class Actor:
    """Typed caller identity, separate from any human delegating its work."""

    type: ActorType
    actor_id: int | None = None
    delegated_user_id: int | None = None
    superuser: SuperuserAccess | None = dataclasses.field(default=None, repr=False)

    @property
    def id(self) -> ActorId:
        return ActorId(self.type, self.actor_id)

    def serialize(self) -> dict[str, Any]:
        result: dict[str, Any] = {"type": self.type.value}
        if self.actor_id is not None:
            result["id"] = self.actor_id
        if self.delegated_user_id is not None:
            result["delegated_user_id"] = self.delegated_user_id
        if self.superuser is not None:
            result["superuser"] = self.superuser.dict()
        return result

    @classmethod
    def deserialize(cls, data: Any) -> Actor:
        if not isinstance(data, dict) or "type" not in data:
            raise ValueError("Actor must be an object with a type")
        superuser = data.get("superuser")
        return cls(
            type=ActorType(data["type"]),
            actor_id=data.get("id"),
            delegated_user_id=data.get("delegated_user_id"),
            superuser=SuperuserAccess.parse_obj(superuser) if superuser is not None else None,
        )


@dataclasses.dataclass(frozen=True)
class ViewerContext:
    """Caller identity and organization/project scope for the current unit of work."""

    actor: Actor
    organization_id: int | None = None
    project_id: int | None = None

    def serialize(self) -> dict[str, Any]:
        result: dict[str, Any] = {"version": 2, "actor": self.actor.serialize()}
        if self.organization_id is not None:
            result["organization_id"] = self.organization_id
        if self.project_id is not None:
            result["project_id"] = self.project_id
        return result

    @classmethod
    def deserialize(cls, data: dict[str, Any]) -> ViewerContext:
        if not isinstance(data, dict):
            raise ValueError("Viewer context must be an object")
        if type(data.get("version")) is not int or data["version"] != 2:
            raise ValueError("Expected a V2 viewer context")
        if {"user_id", "actor_type", "superuser", "token"}.intersection(data):
            raise ValueError("V2 contexts cannot carry V1 identity or credentials")
        return cls(
            actor=Actor.deserialize(data.get("actor")),
            organization_id=data.get("organization_id"),
            project_id=data.get("project_id"),
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


def get_acting_user_id(ctx: ViewerContext | None) -> int | None:
    """Return the human user *ctx* acts as, or ``None``.

    A user actor acts as itself and an agent acts for its delegating user. Other
    actor types never resolve to a user, so a stray ``delegated_user_id`` on them
    cannot grant user identity.
    """
    if ctx is None:
        return None
    actor = ctx.actor
    if actor.type == ActorType.USER:
        return actor.actor_id
    if actor.type == ActorType.AGENT:
        return actor.delegated_user_id
    return None


def observe_viewer_context_propagation(
    point: str,
    *,
    ctx: ViewerContext | None | Any = _OBSERVE_USE_CONTEXTVAR,
    expected: bool = True,
    extra_attributes: Mapping[str, str] | None = None,
) -> None:
    """Emit a ``viewer_context.observation`` counter for the current ViewerContext at *point*.

    Tags: ``point``, ``actor_type``, ``has_user_id``, ``has_org_id``, ``expected``,
    plus any *extra_attributes* the caller provides (e.g. ``method`` for RPC dispatch
    points where we want per-method breakdown). Callers are responsible for keeping
    extra-attribute cardinality bounded — values must come from a closed set.

    Cardinality stays bounded otherwise: never tag user/org ids themselves, only
    their presence.

    By default reads the current ContextVar. Pass *ctx* explicitly when the value
    being observed is a just-resolved override that hasn't entered a scope yet
    (e.g. the merged result inside ``make_signed_seer_api_request``).

    When ``expected`` is True (the default — most chokepoints expect a viewer)
    and no ViewerContext is present, also emits a warning log so the offending
    call site can be identified.
    """
    if ctx is _OBSERVE_USE_CONTEXTVAR:
        ctx = _viewer_context_var.get()

    if ctx is None:
        actor_type = "none"
        has_user = False
        has_org = False
    else:
        actor_type = ctx.actor.type.value
        has_user = get_acting_user_id(ctx) is not None
        has_org = ctx.organization_id is not None

    # Fixed tags layered on top of extras so callers can't accidentally swap
    # `point` / `actor_type` / etc. and corrupt the metric's cardinality story.
    attributes: dict[str, str] = dict(extra_attributes) if extra_attributes else {}
    attributes.update(
        {
            "point": point,
            "actor_type": actor_type,
            "has_user_id": str(has_user).lower(),
            "has_org_id": str(has_org).lower(),
            "expected": str(expected).lower(),
        }
    )

    # testing internal sampling on high volume metrics, not yet public api
    if random() < 0.001:
        attributes_with_sampling: dict[str, str | float] = {
            **attributes,
            "sentry.client_sample_rate": 0.001,
        }
        sentry_sdk.metrics.count(
            "viewer_context.observation", 1, attributes=attributes_with_sampling
        )

    if expected and ctx is None:
        log_extra: dict[str, Any] = dict(extra_attributes) if extra_attributes else {}
        log_extra["point"] = point
        logger.warning("viewer_context.missing", extra=log_extra)


def set_viewer_context_superuser(
    *, user_id: int, organization_id: int, superuser: SuperuserAccess
) -> None:
    """Attach elevation produced by the normal organization access checks."""
    ctx = get_viewer_context()
    if ctx is None:
        return
    if get_acting_user_id(ctx) == user_id:
        _viewer_context_var.set(
            dataclasses.replace(
                ctx,
                organization_id=organization_id,
                actor=dataclasses.replace(ctx.actor, superuser=superuser),
            )
        )


def set_viewer_context_organization(organization_id: int) -> None:
    """Update the current ``ViewerContext`` with a resolved organization id."""
    ctx = get_viewer_context()
    if ctx is None or ctx.organization_id == organization_id:
        return

    _viewer_context_var.set(
        dataclasses.replace(
            ctx,
            organization_id=organization_id,
            actor=dataclasses.replace(ctx.actor, superuser=None),
        )
    )


def set_viewer_context_project(project_id: int) -> None:
    """Update the current ``ViewerContext`` with a resolved project id.

    No-op when no ViewerContext exists — use ``viewer_context_scope``
    for system-originated tasks without middleware.
    """
    ctx = get_viewer_context()
    if ctx is None or ctx.project_id == project_id:
        return

    _viewer_context_var.set(dataclasses.replace(ctx, project_id=project_id))


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
    expires_at = now + ttl
    superuser = viewer_context.actor.superuser
    if superuser is not None:
        expires_at = min(
            expires_at,
            now + SUPERUSER_ACCESS_TTL.total_seconds(),
            superuser.expires_at,
        )
    payload: dict[str, Any] = {
        **viewer_context.serialize(),
        "iat": now,
        "exp": expires_at,
        "iss": "sentry",
    }
    if viewer_context.organization_id is not None and _organization_is_early_adopter(
        viewer_context.organization_id
    ):
        payload["organization_is_early_adopter"] = True

    return pyjwt.encode(
        payload, secret, algorithm="HS256", headers={_JWT_KEY_ID_HEADER: _key_id(secret)}
    )


def _organization_is_early_adopter(organization_id: int) -> bool:
    if SiloMode.get_current_mode() == SiloMode.CONTROL:
        from sentry.models.organizationmapping import OrganizationMapping

        try:
            mapping = OrganizationMapping.objects.get_from_cache(organization_id=organization_id)
        except OrganizationMapping.DoesNotExist:
            return False
        return mapping.early_adopter

    from sentry.models.organization import Organization

    try:
        organization = Organization.objects.get_from_cache(id=organization_id)
    except Organization.DoesNotExist:
        return False
    return bool(organization.flags.early_adopter)


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
    header_value: str,
) -> ViewerContext | None:
    """Decode a ViewerContext from the JWT ``X-Viewer-Context`` header."""
    if not is_jwt_viewer_context(header_value):
        return None

    try:
        return decode_viewer_context(header_value)
    except Exception:
        logger.warning("viewer_context.jwt_decode_failed", exc_info=True)
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
