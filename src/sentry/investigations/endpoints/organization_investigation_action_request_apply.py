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
from sentry.investigations.endpoints.serializers import InvestigationActionRequestSerializer
from sentry.investigations.endpoints.serializers.responses import (
    InvestigationActionRequestApplyResponse,
)
from sentry.investigations.endpoints.validators import ActionRequestApplyValidator
from sentry.investigations.services.action_kinds.base import (
    ApplyErrorCode,
    ApplyFailed,
    CannotApplyReason,
)
from sentry.investigations.services.action_requests import apply_action_request
from sentry.models.organization import Organization
from sentry.notebooks.models import Notebook

_STATUS = {
    CannotApplyReason.INVESTIGATION_ARCHIVED: status.HTTP_400_BAD_REQUEST,
    CannotApplyReason.UNSUPPORTED_ACTION: status.HTTP_400_BAD_REQUEST,
    ApplyErrorCode.VALIDATION_FAILED: status.HTTP_400_BAD_REQUEST,
    CannotApplyReason.NO_ACCESS: status.HTTP_403_FORBIDDEN,
    CannotApplyReason.PERMISSION_DENIED: status.HTTP_403_FORBIDDEN,
}


def apply_error_response(failed: ApplyFailed) -> Response:
    return Response(failed.error, status=_STATUS.get(failed.error["code"], 409))


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
        investigation: Notebook,
        action_request_id: str,
    ) -> Response:
        """
        Apply a suggested action request as the current user. With `dryRun`, it runs the same
        checks and changes nothing.

        Errors about the request have a `code`. It's a 409 when the request was applied,
        withdrawn or replaced, or its kind refuses it, and a 403 when the viewer can't apply it.
        """
        actor_id = require_authenticated_user(request)
        validator = ActionRequestApplyValidator(data=request.data)
        if not validator.is_valid():
            return Response(validator.errors, status=status.HTTP_400_BAD_REQUEST)
        try:
            action_request = apply_action_request(
                investigation=investigation,
                action_request_id=action_request_id,
                request=request,
                actor_id=actor_id,
                dry_run=validator.validated_data["dry_run"],
                expected_action=validator.validated_data.get("action"),
            )
        except ApplyFailed as failed:
            return apply_error_response(failed)
        body: InvestigationActionRequestApplyResponse = {
            "actionRequest": serialize(
                action_request,
                request.user,
                InvestigationActionRequestSerializer(access=request.access),
            ),
        }
        return Response(body)
