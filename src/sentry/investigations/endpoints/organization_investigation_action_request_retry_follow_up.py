from __future__ import annotations

from drf_spectacular.utils import extend_schema
from rest_framework import status
from rest_framework.request import Request
from rest_framework.response import Response

from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import cell_silo_endpoint
from sentry.api.serializers import serialize
from sentry.apidocs import constants
from sentry.apidocs.parameters import GlobalParams, InvestigationParams
from sentry.apidocs.utils import inline_sentry_response_serializer
from sentry.investigations.endpoints.organization_investigation_action_request_apply import (
    apply_error_response,
)
from sentry.investigations.endpoints.serializers import InvestigationActionRequestSerializer
from sentry.investigations.endpoints.serializers.responses import (
    InvestigationActionRequestRetryFollowUpResponse,
)
from sentry.investigations.endpoints.validators import ActionRequestRetryFollowUpValidator
from sentry.investigations.services.action_kinds.base import ApplyFailed
from sentry.investigations.services.action_requests import retry_follow_up
from sentry.models.organization import Organization
from sentry.notebooks.endpoints.base import (
    OrganizationInvestigationEndpoint,
    require_authenticated_user,
)
from sentry.notebooks.models import Notebook


@extend_schema(tags=["Investigations"])
@cell_silo_endpoint
class OrganizationInvestigationActionRequestRetryFollowUpEndpoint(
    OrganizationInvestigationEndpoint
):
    owner = ApiOwner.ML_AI
    publish_status = {"POST": ApiPublishStatus.PRIVATE}

    @extend_schema(
        operation_id="Retry an Investigation Action Request Follow-Up",
        parameters=[
            GlobalParams.ORG_ID_OR_SLUG,
            InvestigationParams.INVESTIGATION_ID,
            InvestigationParams.ACTION_REQUEST_ID,
        ],
        request=ActionRequestRetryFollowUpValidator,
        responses={
            200: inline_sentry_response_serializer(
                "InvestigationActionRequestRetryFollowUpResponse",
                InvestigationActionRequestRetryFollowUpResponse,
            ),
            400: constants.RESPONSE_BAD_REQUEST,
            401: constants.RESPONSE_UNAUTHORIZED,
            403: constants.RESPONSE_FORBIDDEN,
            404: constants.RESPONSE_NOT_FOUND,
            409: constants.RESPONSE_CONFLICT,
        },
    )
    def post(
        self,
        request: Request,
        organization: Organization,
        investigation: Notebook,
        action_request_id: str,
    ) -> Response:
        """
        Send Seer the follow-up command for an applied action request again, when Seer never
        got it. It's a 409 with code `not_retryable` otherwise.
        Other errors are the same as apply's.
        """
        actor_id = require_authenticated_user(request)
        validator = ActionRequestRetryFollowUpValidator(data=request.data)
        if not validator.is_valid():
            return Response(validator.errors, status=status.HTTP_400_BAD_REQUEST)
        try:
            action_request = retry_follow_up(
                investigation=investigation,
                action_request_id=action_request_id,
                request=request,
                actor_id=actor_id,
                expected_action=validator.validated_data.get("action"),
            )
        except ApplyFailed as failed:
            return apply_error_response(failed)
        body: InvestigationActionRequestRetryFollowUpResponse = {
            "actionRequest": serialize(
                action_request,
                request.user,
                InvestigationActionRequestSerializer(access=request.access),
            ),
        }
        return Response(body)
