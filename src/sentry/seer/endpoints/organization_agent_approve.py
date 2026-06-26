from __future__ import annotations

import logging

from django.utils import timezone
from rest_framework.exceptions import PermissionDenied
from rest_framework.request import Request
from rest_framework.response import Response

from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import cell_silo_endpoint
from sentry.api.bases.organization import OrganizationEndpoint, OrganizationPermission
from sentry.api.exceptions import ResourceDoesNotExist
from sentry.models.organization import Organization
from sentry.seer import agent_token
from sentry.seer.models.agent_write_grant import (
    DEFAULT_EXPIRATION,
    AgentWriteGrantStatus,
    SeerAgentWriteGrant,
)
from sentry.utils.auth import is_user_from_viewer_context

logger = logging.getLogger(__name__)


class AgentApprovalPermission(OrganizationPermission):
    # Approving is a first-party user action; any org member may reach the
    # endpoint, and ownership of the specific grant is enforced in the handler.
    scope_map = {
        "GET": ["org:read", "org:write", "org:admin"],
        "POST": ["org:read", "org:write", "org:admin"],
    }


@cell_silo_endpoint
class OrganizationAgentApproveEndpoint(OrganizationEndpoint):
    publish_status = {
        "GET": ApiPublishStatus.PRIVATE,
        "POST": ApiPublishStatus.PRIVATE,
    }
    owner = ApiOwner.ML_AI
    permission_classes = (AgentApprovalPermission,)

    def _require_user_session(self, request: Request) -> None:
        # Approval MUST come from a genuine first-party user session. The agent acts under
        # the user's identity (via X-Viewer-Context or an agent token), so without this
        # guard it could approve its own grant. Reject any non-session credential.
        if (
            request.auth is not None
            or is_user_from_viewer_context(request)
            or agent_token.get_agent_claims(request) is not None
        ):
            raise PermissionDenied("Approval must be performed from a user session.")

    def _get_owned_grant(
        self, organization: Organization, nonce: str, request: Request
    ) -> SeerAgentWriteGrant:
        # IDOR-safe lookup: scope by organization (cross-org nonce -> not found) and
        # require the grant to belong to the authenticated user. Return 404 for both
        # "missing" and "not yours" so we never disclose another user's pending operations.
        grant = SeerAgentWriteGrant.objects.filter(
            organization_id=organization.id, nonce=nonce
        ).first()
        if grant is None or grant.user_id != request.user.id:
            raise ResourceDoesNotExist
        return grant

    def _serialize(self, grant: SeerAgentWriteGrant) -> dict:
        return {
            "nonce": grant.nonce,
            "status": grant.status,
            "requiredScopes": grant.get_scopes(),
            "operation": grant.operation,
            "expiresAt": grant.expires_at.isoformat(),
        }

    def get(self, request: Request, organization: Organization, nonce: str) -> Response:
        """Return the details of a pending agent write challenge for the owning user."""
        self._require_user_session(request)
        grant = self._get_owned_grant(organization, nonce, request)
        return Response(self._serialize(grant))

    def post(self, request: Request, organization: Organization, nonce: str) -> Response:
        """Approve or decline an agent write challenge. Body: {"decision": "approve"|"decline"}."""
        self._require_user_session(request)
        grant = self._get_owned_grant(organization, nonce, request)

        decision = request.data.get("decision", "approve")
        if decision not in ("approve", "decline"):
            return Response({"detail": "Invalid decision."}, status=400)

        # Declining is terminal; an already-declined grant cannot be flipped to approved.
        # An already-approved grant, by contrast, may be re-approved (it refreshes the TTL).
        if grant.status == AgentWriteGrantStatus.DECLINED:
            return Response({"detail": "This request was already declined."}, status=409)

        if decision == "decline":
            grant.status = AgentWriteGrantStatus.DECLINED
            grant.save(update_fields=["status", "date_updated"])
            logger.info(
                "seer.agent_token.declined",
                extra={"organization_id": organization.id, "user_id": request.user.id},
            )
            return Response(self._serialize(grant))

        # Approve. We grant exactly the scopes recorded on the challenge — never anything
        # supplied in the request body — so approval cannot escalate. The TTL restarts from
        # approval time (not from challenge creation), so the grant lives a full window from
        # when the user actually consented.
        now = timezone.now()
        grant.status = AgentWriteGrantStatus.APPROVED
        grant.approved_at = now
        grant.expires_at = now + DEFAULT_EXPIRATION
        grant.save(update_fields=["status", "approved_at", "expires_at", "date_updated"])
        logger.info(
            "seer.agent_token.approved",
            extra={
                "organization_id": organization.id,
                "user_id": request.user.id,
                "scopes": grant.get_scopes(),
            },
        )
        return Response(self._serialize(grant))
