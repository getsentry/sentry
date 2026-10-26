from __future__ import annotations

import logging
from collections.abc import Mapping
from typing import Any, cast

from drf_spectacular.utils import extend_schema
from rest_framework import serializers
from rest_framework.exceptions import PermissionDenied
from rest_framework.request import Request
from rest_framework.response import Response

from sentry import features
from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.authentication import SessionNoAuthTokenAuthentication
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
from sentry.seer.endpoints.agent_request import (
    AgentApprovalRequestData,
    AgentApprovalRequestSerializer,
)
from sentry.utils.auth import is_user_from_viewer_context

logger = logging.getLogger(__name__)


class AgentApprovalResponseSerializer(serializers.Serializer):
    status = serializers.ChoiceField(choices=["approved"])
    scopes = serializers.ListField(child=serializers.CharField())
    expiresAt = serializers.DateTimeField()


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
    authentication_classes = (SessionNoAuthTokenAuthentication,)
    permission_classes = (AgentApprovalPermission,)

    def _require_user_session(self, request: Request) -> None:
        # Viewer context is a service assertion, not interactive user consent.
        if is_user_from_viewer_context(request):
            raise PermissionDenied("Approval must be performed from a user session.")

    @extend_schema(
        operation_id="Approve Seer agent write scopes",
        description=(
            "Requires a first-party browser session. Bearer credentials and "
            "X-Viewer-Context service assertions cannot approve agent writes."
        ),
        parameters=[GlobalParams.ORG_ID_OR_SLUG],
        request=AgentApprovalRequestSerializer,
        responses={
            200: AgentApprovalResponseSerializer,
            400: RESPONSE_BAD_REQUEST,
            401: RESPONSE_UNAUTHORIZED,
            403: RESPONSE_FORBIDDEN,
            404: RESPONSE_NOT_FOUND,
        },
    )
    def post(self, request: Request, organization: Organization) -> Response:
        """Approve write scopes for the agent in a given session.

        Body: ``{"sessionId": "<id>", "scopes": ["org:write", ...]}``. Scopes are capped at
        the approving user's own scopes, and the grant is bound to that user, so approval
        cannot escalate.
        """
        if not features.has(agent_token.FEATURE_FLAG, organization, actor=request.user):
            raise ResourceDoesNotExist

        self._require_user_session(request)

        data: Any = request.data
        if not isinstance(data, Mapping):
            return Response({"detail": "Request body must be an object."}, status=400)

        serializer = AgentApprovalRequestSerializer(data=data)
        if not serializer.is_valid():
            return Response({"detail": serializer.errors}, status=400)
        validated_data = cast(AgentApprovalRequestData, serializer.validated_data)
        session_id = validated_data["sessionId"]
        requested = validated_data["scopes"]

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
