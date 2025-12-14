from drf_spectacular.utils import extend_schema
from rest_framework import status
from rest_framework.exceptions import PermissionDenied
from rest_framework.request import Request
from rest_framework.response import Response

from sentry import audit_log
from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import region_silo_endpoint
from sentry.api.bases import OrganizationEndpoint
from sentry.api.bases.organization import OrganizationDetectorPermission
from sentry.api.exceptions import ResourceDoesNotExist
from sentry.api.serializers import serialize
from sentry.apidocs.constants import (
    RESPONSE_BAD_REQUEST,
    RESPONSE_FORBIDDEN,
    RESPONSE_NO_CONTENT,
    RESPONSE_NOT_FOUND,
    RESPONSE_UNAUTHORIZED,
)
from sentry.apidocs.parameters import DetectorWorkflowParams, GlobalParams
from sentry.models.organization import Organization
from sentry.utils.audit import create_audit_entry
from sentry.workflow_engine.endpoints.serializers.detector_workflow_serializer import (
    DetectorWorkflowSerializer,
)
from sentry.workflow_engine.endpoints.validators.detector_workflow import (
    can_edit_detector_workflow_connections,
)
from sentry.workflow_engine.models.detector_workflow import DetectorWorkflow


@region_silo_endpoint
class OrganizationDetectorWorkflowDetailsEndpoint(OrganizationEndpoint):
    def convert_args(self, request: Request, detector_workflow_id, *args, **kwargs):
        args, kwargs = super().convert_args(request, *args, **kwargs)
        try:
            kwargs["detector_workflow"] = DetectorWorkflow.objects.get(
                workflow__organization=kwargs["organization"], id=detector_workflow_id
            )
        except DetectorWorkflow.DoesNotExist:
            raise ResourceDoesNotExist

        return args, kwargs

    publish_status = {
        "GET": ApiPublishStatus.EXPERIMENTAL,
        "DELETE": ApiPublishStatus.EXPERIMENTAL,
    }
    owner = ApiOwner.ISSUES
    permission_classes = (OrganizationDetectorPermission,)

    @extend_schema(
        operation_id="Fetch a Detector-Workflow Connection",
        parameters=[
            GlobalParams.ORG_ID_OR_SLUG,
            DetectorWorkflowParams.DETECTOR_WORKFLOW_ID,
        ],
        responses={
            201: DetectorWorkflowSerializer,
            400: RESPONSE_BAD_REQUEST,
            401: RESPONSE_UNAUTHORIZED,
            403: RESPONSE_FORBIDDEN,
            404: RESPONSE_NOT_FOUND,
        },
    )
    def get(
        self, request: Request, organization: Organization, detector_workflow: DetectorWorkflow
    ):
        """
        Returns a DetectorWorkflow
        """
        serialized_detector_workflow = serialize(
            detector_workflow,
            request.user,
            DetectorWorkflowSerializer(),
        )
        return Response(serialized_detector_workflow)

    @extend_schema(
        operation_id="Remove a Detector-Workflow Connection",
        parameters=[
            GlobalParams.ORG_ID_OR_SLUG,
            DetectorWorkflowParams.DETECTOR_WORKFLOW_ID,
        ],
        responses={
            204: RESPONSE_NO_CONTENT,
            401: RESPONSE_UNAUTHORIZED,
            403: RESPONSE_FORBIDDEN,
            404: RESPONSE_NOT_FOUND,
        },
    )
    def delete(
        self, request: Request, organization: Organization, detector_workflow: DetectorWorkflow
    ):
        """
        Delete a DetectorWorkflow
        """
        if not can_edit_detector_workflow_connections(detector_workflow.detector, request):
            raise PermissionDenied

        detector_workflow_id = detector_workflow.id
        audit_log_data = detector_workflow.get_audit_log_data()

        detector_workflow.delete()
        create_audit_entry(
            request=request,
            organization=organization,
            target_object=detector_workflow_id,
            event=audit_log.get_event_id("DETECTOR_WORKFLOW_REMOVE"),
            data=audit_log_data,
        )

        return Response(status=status.HTTP_204_NO_CONTENT)
