from __future__ import annotations

import logging

from jwt import PyJWTError
from rest_framework.exceptions import PermissionDenied
from rest_framework.request import Request
from rest_framework.response import Response

from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import cell_silo_endpoint
from sentry.api.bases.organization import OrganizationEndpoint, OrganizationPermission
from sentry.models.organization import Organization
from sentry.seer import agent_token
from sentry.utils.auth import is_user_from_viewer_context

logger = logging.getLogger(__name__)


class AgentApprovalPermission(OrganizationPermission):
    # Approving is a first-party user action; any org member may reach the endpoint, and
    # ownership is enforced by matching the signed challenge's subject in the handler.
    scope_map = {
        "POST": ["org:read", "org:write", "org:admin"],
    }


@cell_silo_endpoint
class OrganizationAgentApproveEndpoint(OrganizationEndpoint):
    publish_status = {
        "POST": ApiPublishStatus.PRIVATE,
    }
    owner = ApiOwner.ML_AI
    permission_classes = (AgentApprovalPermission,)

    def _require_user_session(self, request: Request) -> None:
        # Approval MUST come from a genuine first-party user session. The agent acts under
        # the user's identity (via X-Viewer-Context or an agent token), so without this
        # guard it could approve its own challenge. Reject any non-session credential.
        if (
            request.auth is not None
            or is_user_from_viewer_context(request)
            or agent_token.get_agent_claims(request) is not None
        ):
            raise PermissionDenied("Approval must be performed from a user session.")

    def post(self, request: Request, organization: Organization) -> Response:
        """Approve or decline a write challenge.

        Body: ``{"challenge": "<signed-jwt>", "decision": "approve"|"decline"}``. The grant
        is created only on approval, with exactly the scopes carried by the signed challenge
        token — never scopes from the request body — so approval cannot escalate.
        """
        self._require_user_session(request)

        challenge = request.data.get("challenge")
        if not challenge or not isinstance(challenge, str):
            return Response({"detail": "challenge is required."}, status=400)

        decision = request.data.get("decision", "approve")
        if decision not in ("approve", "decline"):
            return Response({"detail": "Invalid decision."}, status=400)

        try:
            claims = agent_token.decode_challenge_token(challenge)
        except PyJWTError:
            return Response({"detail": "Invalid or expired challenge."}, status=400)

        # The challenge is bound to its subject and org; only that user, acting in that org,
        # may approve it. Identity comes from the first-party session, never the token.
        if int(claims["sub"]) != request.user.id or int(claims["org"]) != organization.id:
            raise PermissionDenied("Challenge does not belong to this user or organization.")

        if decision == "decline":
            # Declining persists nothing — the challenge simply expires.
            logger.info(
                "seer.agent_token.declined",
                extra={"organization_id": organization.id, "user_id": request.user.id},
            )
            return Response({"status": "declined"})

        grant = agent_token.grant_from_challenge_claims(claims)
        logger.info(
            "seer.agent_token.approved",
            extra={
                "organization_id": organization.id,
                "user_id": request.user.id,
                "scopes": grant.get_scopes(),
            },
        )
        return Response(
            {
                "status": "approved",
                "scopes": grant.get_scopes(),
                "expiresAt": grant.expires_at.isoformat(),
            }
        )
