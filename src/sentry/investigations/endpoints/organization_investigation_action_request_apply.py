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
    service_error,
)
from sentry.investigations.endpoints.serializers import InvestigationActionRequestSerializer
from sentry.investigations.endpoints.serializers.responses import (
    InvestigationActionRequestApplyResponse,
)
from sentry.investigations.endpoints.validators import ActionRequestApplyValidator
from sentry.investigations.models import Investigation
from sentry.investigations.services.action_requests import apply_action_request
from sentry.models.organization import Organization


@extend_schema(tags=["Investigations"])
@cell_silo_endpoint
class OrganizationInvestigationActionRequestApplyEndpoint(OrganizationInvestigationEndpoint):
    owner = ApiOwner.ML_AI
    publish_status = {"POST": ApiPublishStatus.PRIVATE}

    @extend_schema(
        operation_id="Apply an Investigation Action Request",
        parameters=[
            GlobalParams.ORG_ID_OR_SLUG,
            InvestigationParams.INVESTIGATION_ID,
            InvestigationParams.ACTION_REQUEST_ID,
        ],
        request=ActionRequestApplyValidator,
        responses={
            200: inline_sentry_response_serializer(
                "InvestigationActionRequestApplyResponse",
                InvestigationActionRequestApplyResponse,
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
        Apply a suggested action request as the current user. Errors have a `code`. With
        `dryRun`, it runs the same checks and changes nothing.

        Responds with a 409 if Seer withdrew the request.
        """
        actor_id = require_authenticated_user(request)
        validator = ActionRequestApplyValidator(data=request.data)
        if not validator.is_valid():
            return Response(validator.errors, status=status.HTTP_400_BAD_REQUEST)
        try:
            result = apply_action_request(
                investigation=investigation,
                action_request_id=action_request_id,
                request=request,
                actor_id=actor_id,
                dry_run=validator.validated_data["dry_run"],
            )
        except Exception as error:
            response = service_error(error)
            if response is not None:
                return response
            raise
        if result.error is not None:
            return Response(result.error, status=result.status)
        body: InvestigationActionRequestApplyResponse = {
            "actionRequest": serialize(
                result.action_request,
                request.user,
                InvestigationActionRequestSerializer(access=request.access),
            ),
        }
        return Response(body)
