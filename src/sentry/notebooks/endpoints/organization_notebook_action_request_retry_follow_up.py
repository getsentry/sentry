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
from sentry.apidocs.parameters import GlobalParams, NotebookParams
from sentry.apidocs.utils import inline_sentry_response_serializer
from sentry.models.organization import Organization
from sentry.notebooks.endpoints.base import (
    OrganizationNotebookEndpoint,
    require_authenticated_user,
)
from sentry.notebooks.endpoints.organization_notebook_action_request_apply import (
    apply_error_response,
)
from sentry.notebooks.endpoints.serializers import NotebookActionRequestSerializer
from sentry.notebooks.endpoints.serializers.responses import (
    NotebookActionRequestRetryFollowUpResponse,
)
from sentry.notebooks.endpoints.validators import ActionRequestRetryFollowUpValidator
from sentry.notebooks.models import Notebook
from sentry.notebooks.services.action_kinds.base import ApplyFailed
from sentry.notebooks.services.action_requests import retry_follow_up


@extend_schema(tags=["Investigations"])
@cell_silo_endpoint
class OrganizationNotebookActionRequestRetryFollowUpEndpoint(OrganizationNotebookEndpoint):
    owner = ApiOwner.ML_AI
    publish_status = {"POST": ApiPublishStatus.PRIVATE}

    @extend_schema(
        operation_id="Retry an Investigation Action Request Follow-Up",
        parameters=[
            GlobalParams.ORG_ID_OR_SLUG,
            NotebookParams.NOTEBOOK_ID,
            NotebookParams.ACTION_REQUEST_ID,
        ],
        request=ActionRequestRetryFollowUpValidator,
        responses={
            200: inline_sentry_response_serializer(
                "InvestigationActionRequestRetryFollowUpResponse",
                NotebookActionRequestRetryFollowUpResponse,
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
        notebook: Notebook,
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
                notebook=notebook,
                action_request_id=action_request_id,
                request=request,
                actor_id=actor_id,
                expected_action=validator.validated_data.get("action"),
            )
        except ApplyFailed as failed:
            return apply_error_response(failed)
        body: NotebookActionRequestRetryFollowUpResponse = {
            "actionRequest": serialize(
                action_request,
                request.user,
                NotebookActionRequestSerializer(access=request.access),
            ),
        }
        return Response(body)
