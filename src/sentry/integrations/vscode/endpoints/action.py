from __future__ import annotations

import orjson
from rest_framework import serializers, status
from rest_framework.request import Request
from rest_framework.response import Response

from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import cell_silo_endpoint
from sentry.api.bases.organization import OrganizationEndpoint
from sentry.integrations.vscode.endpoints.utils import (
    VSCodeEndpointPermission,
    editor_response,
    get_run_from_session_id,
    validate_vscode_access,
)
from sentry.models.organization import Organization
from sentry.seer.agent.client_utils import agent_connection_pool
from sentry.seer.models import SeerApiError
from sentry.seer.signed_seer_api import make_signed_seer_api_request


class VSCodeActionSerializer(serializers.Serializer[dict[str, object]]):
    type = serializers.ChoiceField(choices=["user_input_response"])
    inputId = serializers.CharField(allow_blank=False, max_length=256)
    responseData = serializers.JSONField()


@cell_silo_endpoint
class VSCodeActionEndpoint(OrganizationEndpoint):
    owner = ApiOwner.COMMUNITY
    publish_status = {"POST": ApiPublishStatus.PRIVATE}

    permission_classes = (VSCodeEndpointPermission,)

    def post(self, request: Request, organization: Organization, session_id: str) -> Response:
        user_id = validate_vscode_access(request=request, organization=organization)
        try:
            run = get_run_from_session_id(
                organization=organization, user_id=user_id, session_id=session_id
            )
        except serializers.ValidationError as e:
            return Response({"detail": str(e)}, status=status.HTTP_400_BAD_REQUEST)

        serializer = VSCodeActionSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
        action = serializer.validated_data
        payload = {
            "type": "user_input_response",
            "input_id": action["inputId"],
            "response_data": action["responseData"],
        }

        response = make_signed_seer_api_request(
            agent_connection_pool,
            "/v1/automation/explorer/update",
            orjson.dumps(
                {
                    "run_id": run.seer_run_state_id,
                    "organization_id": organization.id,
                    "payload": payload,
                }
            ),
        )
        if response.status >= 400:
            raise SeerApiError("Seer request failed", response.status)
        return Response(editor_response(run, run.agent, status="running"), status=202)
