from __future__ import annotations

from drf_spectacular.utils import extend_schema
from rest_framework import serializers
from rest_framework.exceptions import PermissionDenied
from rest_framework.request import Request
from rest_framework.response import Response

from sentry import features
from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import cell_silo_endpoint
from sentry.api.bases.organization import OrganizationEndpoint, OrganizationPermission
from sentry.api.exceptions import ResourceDoesNotExist
from sentry.apidocs.constants import (
    RESPONSE_BAD_REQUEST,
    RESPONSE_FORBIDDEN,
    RESPONSE_NOT_FOUND,
    RESPONSE_UNAUTHORIZED,
)
from sentry.apidocs.parameters import GlobalParams
from sentry.models.organization import Organization
from sentry.seer import agent_token
from sentry.seer.models.agent_write_grant import AGENT_SESSION_ID_MAX_LENGTH


class AgentTokenRequestSerializer(serializers.Serializer):
    sessionId = serializers.CharField(max_length=AGENT_SESSION_ID_MAX_LENGTH)
    requestedScopes = serializers.ListField(child=serializers.CharField(), required=False)


class AgentTokenResponseSerializer(serializers.Serializer):
    token = serializers.CharField()
    expiresAt = serializers.DateTimeField()
    scopes = serializers.ListField(child=serializers.CharField())


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

    @extend_schema(
        operation_id="Mint a Seer agent capability token",
        parameters=[GlobalParams.ORG_ID_OR_SLUG],
        request=AgentTokenRequestSerializer,
        responses={
            200: AgentTokenResponseSerializer,
            400: RESPONSE_BAD_REQUEST,
            401: RESPONSE_UNAUTHORIZED,
            403: RESPONSE_FORBIDDEN,
            404: RESPONSE_NOT_FOUND,
        },
    )
    def post(self, request: Request, organization: Organization) -> Response:
        """Mint a short-lived, scope-bound capability token for the Seer agent.

        Body: ``{"sessionId": str, "requestedScopes"?: [str]}``. The token's scopes are the
        caller's own scopes intersected with read-only plus any approved grants for this
        org and session; ``requestedScopes`` can only narrow further. No token is stored.
        """
        if not features.has(agent_token.FEATURE_FLAG, organization, actor=request.user):
            raise ResourceDoesNotExist

        # Minting is a user-initiated action (direct session or Seer's X-Viewer-Context on
        # the user's behalf). A non-user actor -- including an agent token itself -- must not
        # mint, so identity is always a real user, never anonymous.
        if not request.user.is_authenticated:
            raise PermissionDenied("Minting requires a user session.")

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
        assert user_id is not None  # guaranteed by the user-session requirement above

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
