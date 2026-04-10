from drf_spectacular.utils import extend_schema
from rest_framework import status
from rest_framework.exceptions import ValidationError
from rest_framework.request import Request
from rest_framework.response import Response

from sentry import features
from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import cell_silo_endpoint
from sentry.api.bases.project import ProjectEndpoint, ProjectPermission
from sentry.api.serializers import serialize
from sentry.apidocs.constants import (
    RESPONSE_BAD_REQUEST,
    RESPONSE_FORBIDDEN,
    RESPONSE_NOT_FOUND,
    RESPONSE_UNAUTHORIZED,
)
from sentry.apidocs.examples.workflow_engine_examples import WorkflowEngineExamples
from sentry.apidocs.parameters import GlobalParams
from sentry.incidents.grouptype import MetricIssue
from sentry.models.project import Project
from sentry.workflow_engine.endpoints.organization_detector_index import get_detector_validator
from sentry.workflow_engine.endpoints.serializers.detector_serializer import DetectorSerializer
from sentry.workflow_engine.endpoints.validators.base import BaseDetectorTypeValidator


class OrganizationProjectDetectorPermission(ProjectPermission):
    scope_map = {
        "POST": ["project:write", "project:admin", "alerts:write"],
    }


@cell_silo_endpoint
@extend_schema(tags=["Monitors"])
class OrganizationProjectDetectorIndexEndpoint(ProjectEndpoint):
    publish_status = {
        "POST": ApiPublishStatus.PUBLIC,
    }
    owner = ApiOwner.ALERTS_NOTIFICATIONS
    permission_classes = (OrganizationProjectDetectorPermission,)

    @extend_schema(
        operation_id="Create a Monitor for a Project",
        parameters=[
            GlobalParams.ORG_ID_OR_SLUG,
            GlobalParams.PROJECT_ID_OR_SLUG,
        ],
        request=BaseDetectorTypeValidator,
        responses={
            201: DetectorSerializer,
            400: RESPONSE_BAD_REQUEST,
            401: RESPONSE_UNAUTHORIZED,
            403: RESPONSE_FORBIDDEN,
            404: RESPONSE_NOT_FOUND,
        },
        examples=WorkflowEngineExamples.CREATE_DETECTOR,
    )
    def post(self, request: Request, project: Project) -> Response:
        """
        ⚠️ This endpoint is currently in **beta** and may be subject to change. It is supported by [New Monitors and Alerts](/product/new-monitors-and-alerts/) and may not be viewable in the UI today.

        Create a Monitor for a project
        """
        organization = project.organization

        detector_type = request.data.get("type")
        if not detector_type:
            raise ValidationError({"type": ["This field is required."]})

        # Restrict creating metric issue detectors by plan type
        if detector_type == MetricIssue.slug and not features.has(
            "organizations:incidents", organization, actor=request.user
        ):
            return Response(
                serialize({"detail": "Unable to process request, confirm payment options."}),
                status=status.HTTP_400_BAD_REQUEST,
            )

        validator = get_detector_validator(request, project, detector_type)
        if not validator.is_valid():
            return Response(validator.errors, status=status.HTTP_400_BAD_REQUEST)

        detector = validator.save()

        return Response(serialize(detector, request.user), status=status.HTTP_201_CREATED)
