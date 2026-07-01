from __future__ import annotations

import logging

from rest_framework.exceptions import PermissionDenied
from rest_framework.request import Request
from rest_framework.response import Response

from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import cell_silo_endpoint
from sentry.api.bases.organization import OrganizationEndpoint, OrganizationPermission
from sentry.models.organization import Organization
from sentry.seer import agent_token
from sentry.seer.models.agent_write_grant import AGENT_SESSION_ID_MAX_LENGTH
from sentry.utils.auth import is_user_from_viewer_context

logger = logging.getLogger(__name__)


class AgentApprovalPermission(OrganizationPermission):
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
        # The agent acts under the user's identity (X-Viewer-Context or an agent token), so
        # approval must come from a genuine first-party session or the agent could approve
        # its own writes.
        if (
            request.auth is not None
            or is_user_from_viewer_context(request)
            or agent_token.get_agent_claims(request) is not None
        ):
            raise PermissionDenied("Approval must be performed from a user session.")

    def post(self, request: Request, organization: Organization) -> Response:
        """Approve write scopes for the agent in a given session.

        Body: ``{"sessionId": "<id>", "scopes": ["org:write", ...]}``. Scopes are capped at
        the approving user's own scopes, and the grant is bound to that user, so approval
        cannot escalate.
        """
        self._require_user_session(request)

        session_id = request.data.get("sessionId")
        if not session_id or not isinstance(session_id, str):
            return Response({"detail": "sessionId is required."}, status=400)
        if len(session_id) > AGENT_SESSION_ID_MAX_LENGTH:
            return Response(
                {"detail": f"sessionId must be {AGENT_SESSION_ID_MAX_LENGTH} characters or fewer."},
                status=400,
            )

        requested = request.data.get("scopes")
        if not isinstance(requested, list) or not all(isinstance(s, str) for s in requested):
            return Response({"detail": "scopes must be a list of strings."}, status=400)

        grantable = sorted(set(requested) & set(request.access.scopes))
        if not grantable:
            return Response({"detail": "No grantable scopes for this user."}, status=400)

        user_id = request.user.id
        assert user_id is not None  # guaranteed by the user-session requirement above

        grant = agent_token.create_write_grant(
            organization_id=organization.id,
            user_id=user_id,
            session_id=session_id,
            scopes=grantable,
        )
        logger.info(
            "seer.agent_token.approved",
            extra={
                "organization_id": organization.id,
                "user_id": user_id,
                "scopes": grantable,
            },
        )
        return Response(
            {
                "status": "approved",
                "scopes": grant.get_scopes(),
                "expiresAt": grant.expires_at.isoformat(),
            }
        )
