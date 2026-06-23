"""
Server-side permission gate for mutating Sentry API requests made by the Seer agent.

The agent forwards a user's identity via the ``X-Viewer-Context`` JWT and marks its
own traffic with ``X-Is-Agent: true``. For such requests we *mask* the effective
scopes down to read-only (reusing ``SENTRY_READONLY_SCOPES``), so any write fails
the normal scope check unless an ``approved`` :class:`SeerAgentWriteGrant` covers the
required scope. A masked-out write returns a structured challenge the Seer chat
widget turns into an approval prompt.

This mirrors the demo-mode read-only pattern in ``sentry.api.permissions`` and is a
no-op unless the request is a genuine agent request *and* the per-org feature flag
is enabled, so it cannot affect normal traffic.
"""

from __future__ import annotations

import dataclasses
import logging
from collections.abc import Iterable
from typing import Any

from django.conf import settings
from django.utils import timezone
from rest_framework import status
from rest_framework.request import Request

from sentry import features
from sentry.api.exceptions import SentryAPIException
from sentry.auth import access
from sentry.models.organization import Organization
from sentry.organizations.services.organization import RpcOrganization, RpcUserOrganizationContext
from sentry.seer.models.agent_write_grant import AgentWriteGrantStatus, SeerAgentWriteGrant
from sentry.utils.auth import is_user_from_viewer_context

logger = logging.getLogger(__name__)

# Django converts the ``X-Is-Agent`` request header into this META key.
AGENT_REQUEST_HEADER = "HTTP_X_IS_AGENT"
FEATURE_FLAG = "organizations:seer-agent-write-gate"


class AgentWritePermissionRequired(SentryAPIException):
    # Renders as {"detail": {"code": "agent-write-permission-required", "message": ...,
    # "extra": {required_scopes, operation, organization, nonce, approval_endpoint,
    # expires_at}}}. The Seer side reads `extra` to drive the approval prompt.
    status_code = status.HTTP_403_FORBIDDEN
    code = "agent-write-permission-required"
    message = "This operation requires explicit user permission for the Seer agent."


@dataclasses.dataclass(frozen=True)
class AgentWriteGateState:
    """Stashed on the request when masking is applied, so the challenge step can
    tell a masked denial apart from a genuine lack of role permission."""

    organization_id: int
    user_id: int
    # The user's real (pre-mask) role scopes. A challenge is only offered for a
    # scope the user actually has — the agent can never be granted more than the user.
    unmasked_scopes: frozenset[str]


def readonly_scopes() -> frozenset[str]:
    # Note: intentionally NOT demo_mode.get_readonly_scopes() — that set also allows
    # project:releases, which is a write the agent must not get for free.
    return frozenset(settings.SENTRY_READONLY_SCOPES)


def is_agent_request(request: Request) -> bool:
    """True only for genuine agent traffic: the ``X-Is-Agent`` header is present
    *and* the request is authenticated through the trusted viewer-context path.
    The header alone confers nothing."""
    header = request.META.get(AGENT_REQUEST_HEADER, "")
    if header.strip().lower() != "true":
        return False
    return is_user_from_viewer_context(request)


def gate_enabled(organization: Organization | RpcOrganization, user: Any = None) -> bool:
    return features.has(FEATURE_FLAG, organization, actor=user)


def should_gate(request: Request, organization: Organization | RpcOrganization) -> bool:
    return is_agent_request(request) and gate_enabled(organization, getattr(request, "user", None))


def active_grant_scopes(organization_id: int, user_id: int) -> set[str]:
    """Scopes the user has already approved for the agent in this org (and which
    have not expired). Looked up strictly by authenticated identity — never by
    client-supplied input — to stay IDOR-safe."""
    scopes: set[str] = set()
    grants = SeerAgentWriteGrant.objects.filter(
        organization_id=organization_id,
        user_id=user_id,
        status=AgentWriteGrantStatus.APPROVED,
        expires_at__gt=timezone.now(),
    )
    for grant in grants:
        scopes.update(grant.get_scopes())
    return scopes


def masked_scopes(full_scopes: Iterable[str], organization_id: int, user_id: int) -> set[str]:
    """The effective scopes for an agent request: read-only plus any approved
    write scopes, never exceeding the user's own role scopes."""
    full = set(full_scopes)
    allowed = readonly_scopes() | active_grant_scopes(organization_id, user_id)
    return full & allowed


def apply_scope_mask(request: Request, org_context: RpcUserOrganizationContext) -> None:
    """Rebuild ``request.access`` for an agent request with masked scopes, and
    record the pre-mask scopes so the challenge step can run later."""
    member = org_context.member
    full = set(member.scopes) if member and member.scopes else set()
    organization = org_context.organization
    user_id = request.user.id
    assert user_id is not None
    masked = masked_scopes(full, organization.id, user_id)

    if member is not None:
        member.scopes = sorted(masked)

    request.access = access.from_request_org_and_scopes(
        request=request,
        rpc_user_org_context=org_context,
        scopes=masked,
    )
    request._agent_write_gate = AgentWriteGateState(  # type: ignore[attr-defined]
        organization_id=organization.id,
        user_id=user_id,
        unmasked_scopes=frozenset(full),
    )
    logger.info(
        "seer.agent_write_gate.masked",
        extra={
            "organization_id": organization.id,
            "user_id": request.user.id,
            "masked_scopes": sorted(masked),
        },
    )


def _describe_operation(request: Request) -> str:
    return f"{request.method} {request.path}"


def _find_or_create_pending_grant(
    organization_id: int, user_id: int, scopes: list[str], operation: str
) -> SeerAgentWriteGrant:
    existing = SeerAgentWriteGrant.objects.filter(
        organization_id=organization_id,
        user_id=user_id,
        status=AgentWriteGrantStatus.PENDING,
        scope_list=scopes,
        expires_at__gt=timezone.now(),
    ).first()
    if existing is not None:
        return existing
    return SeerAgentWriteGrant.objects.create(
        organization_id=organization_id,
        user_id=user_id,
        scope_list=scopes,
        status=AgentWriteGrantStatus.PENDING,
        operation=operation,
    )


def maybe_challenge(
    request: Request,
    organization: Organization | RpcOrganization | RpcUserOrganizationContext,
    required_scopes: Iterable[str],
) -> None:
    """If an agent write was denied only because of scope masking — and the user's
    own role actually has the required scope — mint a pending grant and raise a
    structured challenge. Otherwise do nothing (an ordinary denial follows)."""
    state: AgentWriteGateState | None = getattr(request, "_agent_write_gate", None)
    if state is None:
        return

    # Only scopes the user genuinely holds are grantable; the agent cannot be
    # granted more than the user. If none qualify, fall through to a normal denial.
    grantable = sorted(s for s in required_scopes if s in state.unmasked_scopes)
    if not grantable:
        return

    grant = _find_or_create_pending_grant(
        organization_id=state.organization_id,
        user_id=state.user_id,
        scopes=grantable,
        operation=_describe_operation(request),
    )

    org = (
        organization.organization
        if isinstance(organization, RpcUserOrganizationContext)
        else organization
    )
    org_slug = org.slug

    raise AgentWritePermissionRequired(
        required_scopes=grantable,
        operation=grant.operation,
        organization=org_slug,
        nonce=grant.nonce,
        approval_endpoint=f"/api/0/organizations/{org_slug}/agent/approve/{grant.nonce}/",
        expires_at=grant.expires_at.isoformat(),
    )
