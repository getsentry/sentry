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
from sentry.investigations.endpoints.base import (
    OrganizationInvestigationEndpoint,
    require_authenticated_user,
)
from sentry.investigations.endpoints.organization_investigation_action_request_apply import (
    apply_error_response,
)
from sentry.investigations.endpoints.serializers import InvestigationActionRequestSerializer
from sentry.investigations.endpoints.serializers.responses import (
    InvestigationActionRequestRecheckResponse,
)
from sentry.investigations.endpoints.validators import ActionRequestRecheckValidator
from sentry.investigations.models import Investigation
from sentry.investigations.services.action_kinds.base import ApplyFailed
from sentry.investigations.services.action_requests import recheck_action_request
from sentry.models.organization import Organization


@extend_schema(tags=["Investigations"])
@cell_silo_endpoint
class OrganizationInvestigationActionRequestRecheckEndpoint(OrganizationInvestigationEndpoint):
    owner = ApiOwner.ML_AI
    publish_status = {"POST": ApiPublishStatus.PRIVATE}

    @extend_schema(
        operation_id="Recheck an Investigation Action Request",
        parameters=[
            GlobalParams.ORG_ID_OR_SLUG,
            InvestigationParams.INVESTIGATION_ID,
            InvestigationParams.ACTION_REQUEST_ID,
        ],
        request=ActionRequestRecheckValidator,
        responses={
            200: inline_sentry_response_serializer(
                "InvestigationActionRequestRecheckResponse",
                InvestigationActionRequestRecheckResponse,
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
        investigation: Investigation,
        action_request_id: str,
    ) -> Response:
        """
        Check a suggested action request against what it changes now, without applying it. If
        something moved, the request is superseded and Seer is asked to check its suggestions
        again. If nothing moved, it's a 409 with code `not_stale`. Other errors are the same as
        apply's.
        """
        actor_id = require_authenticated_user(request)
        validator = ActionRequestRecheckValidator(data=request.data)
        if not validator.is_valid():
            return Response(validator.errors, status=status.HTTP_400_BAD_REQUEST)
        try:
            action_request = recheck_action_request(
                investigation=investigation,
                action_request_id=action_request_id,
                request=request,
                actor_id=actor_id,
                expected_action=validator.validated_data.get("action"),
            )
        except ApplyFailed as failed:
            return apply_error_response(failed)
        body: InvestigationActionRequestRecheckResponse = {
            "actionRequest": serialize(
                action_request,
                request.user,
                InvestigationActionRequestSerializer(access=request.access),
            ),
        }
        return Response(body)
