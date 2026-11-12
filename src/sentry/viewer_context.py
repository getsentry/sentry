from __future__ import annotations

import dataclasses
import logging
from collections.abc import Mapping
from random import random
from typing import Any

import sentry_sdk
from django.conf import settings
from sentry_viewercontext import (
    Actor,
    ActorId,
    ActorType,
    SuperuserAccess,
    ViewerContext,
    decode_jwt,
    encode_jwt,
    get_viewer_context,
    is_jwt,
    key_id,
    viewer_context_scope,
    viewer_context_var,
)

from sentry.silo.base import SiloMode

__all__ = [
    "Actor",
    "ActorId",
    "ActorType",
    "SuperuserAccess",
    "ViewerContext",
    "actor_id_from_references",
    "get_viewer_context",
    "viewer_context_scope",
]

logger = logging.getLogger(__name__)

# Sentinel for `observe_viewer_context_propagation(ctx=...)`: distinguishes
# "caller passed None" from "caller didn't pass ctx".
_OBSERVE_USE_CONTEXTVAR: Any = object()

_viewer_context_var = viewer_context_var

"""
ViewerContext is an object propagated across codebase (and crossing service boundary) to deliver
accurate information regarding the viewer on behalf of which the request is being made.

This can be global, limited to an organization, or particular user.

The proposal for this project alongside needs and specific considerations can be found in:
https://www.notion.so/sentry/RFC-Unified-ViewerContext-via-ContextVar-32f8b10e4b5d81988625cb5787035e02
"""


def actor_id_from_references(
    *, user_id: int | None, service_account_id: int | None
) -> ActorId | None:
    """Interpret mutually exclusive references without resolving or authorizing the actor."""
    if user_id is not None:
        if service_account_id is not None:
            raise ValueError("User and service-account references are mutually exclusive")
        kind, actor_id = ActorType.USER, user_id
    elif service_account_id is not None:
        kind, actor_id = ActorType.SERVICE_ACCOUNT, service_account_id
    else:
        return None

    if type(actor_id) is not int or actor_id <= 0:
        raise ValueError("Actor ID must be a positive integer")
    return ActorId(kind, actor_id)


def get_acting_user_id(ctx: ViewerContext | None) -> int | None:
    """Return the human user *ctx* acts as, or ``None``."""
    return ctx.actor.user_id if ctx is not None else None


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


def set_viewer_context_actor(actor: Actor) -> None:
    """Replace the caller, e.g. when an endpoint authenticates after the middleware did."""
    ctx = get_viewer_context()
    if ctx is None or ctx.actor == actor:
        return
    if actor.superuser is None and dataclasses.replace(ctx.actor, superuser=None) == actor:
        # Same caller: keep the elevation the access checks granted.
        return
    _viewer_context_var.set(dataclasses.replace(ctx, actor=actor))


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
        keys[key_id(seer_secret)] = seer_secret

    return keys


def encode_viewer_context(
    viewer_context: ViewerContext,
    *,
    key: str | None = None,
    ttl: int | None = None,
) -> str:
    """Encode a :class:`ViewerContext` as a signed HS256 JWT."""
    if ttl is None:
        ttl = getattr(settings, "VIEWER_CONTEXT_JWT_TTL", 900)
    if viewer_context.organization_id is not None and _organization_is_early_adopter(
        viewer_context.organization_id
    ):
        viewer_context = dataclasses.replace(viewer_context, organization_is_early_adopter=True)
    return encode_jwt(viewer_context, key=_get_signing_key(key), ttl=ttl)


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

    When *key* is provided it is used directly.  Otherwise the key matching the
    token's ``kid`` among ``_get_verification_keys()`` is used.
    """
    keys = [key] if key is not None else list(_get_verification_keys().values())
    if not keys:
        raise ValueError("No verification keys available.")
    return decode_jwt(token, keys=keys, leeway=leeway)


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
    return is_jwt(header_value)
