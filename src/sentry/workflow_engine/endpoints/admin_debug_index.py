from typing import TypedDict

from drf_spectacular.utils import extend_schema
from rest_framework.response import Response

from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import Endpoint, region_silo_endpoint
from sentry.api.permissions import SuperuserPermission
from sentry.api.serializers import serialize
from sentry.apidocs.constants import (
    RESPONSE_BAD_REQUEST,
    RESPONSE_FORBIDDEN,
    RESPONSE_NOT_FOUND,
    RESPONSE_UNAUTHORIZED,
)
from sentry.apidocs.parameters import WorkflowParams
from sentry.utils.auth import AuthenticatedHttpRequest
from sentry.workflow_engine.endpoints.serializers.workflow_serializer import WorkflowSerializer
from sentry.workflow_engine.models import Workflow


class DetectorCountResponse(TypedDict):
    active: int
    deactive: int
    total: int


@region_silo_endpoint
@extend_schema(tags=["Workflows"])
class AdminWorkflowDetailEndpoint(Endpoint):
    publish_status = {
        "GET": ApiPublishStatus.PRIVATE,
    }
    permissions_classes = (SuperuserPermission,)
    owner = ApiOwner.ALERTS_NOTIFICATIONS

    @extend_schema(
        operation_id="Get Organization Detector Count",
        parameters=[
            WorkflowParams.WORKFLOW_ID,
        ],
        responses={
            200: WorkflowSerializer,
            400: RESPONSE_BAD_REQUEST,
            401: RESPONSE_UNAUTHORIZED,
            403: RESPONSE_FORBIDDEN,
            404: RESPONSE_NOT_FOUND,
        },
    )
    def get(self, request: AuthenticatedHttpRequest, workflow: Workflow) -> Response:
        """
        This API is for superusers to access workflow information w/o needing the organization.
        The API is used on the `_admin/alerts` page to gather the information
        related to the alert for debugging investigations
        """
        serialized_workflow = serialize(workflow, request.user, WorkflowSerializer())
        return Response(serialized_workflow)


# TODO - add an endpoint for POST /workflow/:id/evaluate
