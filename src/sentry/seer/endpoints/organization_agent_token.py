from __future__ import annotations

from rest_framework.request import Request
from rest_framework.response import Response

from sentry import features
from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import cell_silo_endpoint
from sentry.api.bases.organization import OrganizationEndpoint, OrganizationPermission
from sentry.api.exceptions import ResourceDoesNotExist
from sentry.models.organization import Organization
from sentry.seer import agent_token
from sentry.seer.models.agent_write_grant import AGENT_SESSION_ID_MAX_LENGTH


class AgentTokenPermission(OrganizationPermission):
    # Minting only ever de-escalates the caller's own authority, so any member who can
    # read the org may mint (a read-only member gets a read-only token). Write scopes are
    # added only via approved grants, never by reaching this endpoint.
    scope_map = {
        "POST": ["org:read", "org:write", "org:admin"],
    }


@cell_silo_endpoint
class OrganizationAgentTokenEndpoint(OrganizationEndpoint):
    publish_status = {
        "POST": ApiPublishStatus.PRIVATE,
    }
    owner = ApiOwner.ML_AI
    permission_classes = (AgentTokenPermission,)

    def post(self, request: Request, organization: Organization) -> Response:
        """Mint a short-lived, scope-bound capability token for the Seer agent.

        Body: ``{"sessionId": str, "requestedScopes"?: [str]}``. The token's scopes are the
        caller's own scopes intersected with read-only plus any approved grants for this
        org and session; ``requestedScopes`` can only narrow further. No token is stored.
        """
        if not features.has(agent_token.FEATURE_FLAG, organization, actor=request.user):
            raise ResourceDoesNotExist

        session_id = request.data.get("sessionId")
        if not session_id or not isinstance(session_id, str):
            return Response({"detail": "sessionId is required."}, status=400)
        if len(session_id) > AGENT_SESSION_ID_MAX_LENGTH:
            return Response(
                {"detail": f"sessionId must be {AGENT_SESSION_ID_MAX_LENGTH} characters or fewer."},
                status=400,
            )

        requested_scopes = request.data.get("requestedScopes")
        if requested_scopes is not None and (
            not isinstance(requested_scopes, list)
            or not all(isinstance(s, str) for s in requested_scopes)
        ):
            return Response({"detail": "requestedScopes must be a list of strings."}, status=400)

        user_id = request.user.id
        assert user_id is not None  # an authenticated caller is guaranteed by the permission

        # request.access.scopes is already the caller's role scopes intersected with any
        # OAuth token scopes, so it is the correct upper bound for de-escalation. Identity
        # comes from the authenticated request, never from the body.
        scopes = agent_token.compute_token_scopes(
            caller_scopes=request.access.scopes,
            organization_id=organization.id,
            user_id=user_id,
            session_id=session_id,
            requested_scopes=requested_scopes,
        )

        token, expires_at = agent_token.encode_agent_token(
            user_id=user_id,
            organization_id=organization.id,
            scopes=scopes,
            session_id=session_id,
        )
        return Response(
            {
                "token": token,
                "expiresAt": expires_at.isoformat(),
                "scopes": scopes,
            }
        )
