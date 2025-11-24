from drf_spectacular.utils import extend_schema
from rest_framework import serializers, status
from rest_framework.exceptions import PermissionDenied
from rest_framework.response import Response

from sentry import audit_log
from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import region_silo_endpoint
from sentry.api.bases import OrganizationEndpoint
from sentry.api.bases.organization import OrganizationDetectorPermission
from sentry.api.serializers import serialize
from sentry.apidocs.constants import (
    RESPONSE_BAD_REQUEST,
    RESPONSE_CONFLICT,
    RESPONSE_FORBIDDEN,
    RESPONSE_NOT_FOUND,
    RESPONSE_UNAUTHORIZED,
)
from sentry.apidocs.parameters import GlobalParams
from sentry.utils.audit import create_audit_entry
from sentry.workflow_engine.endpoints.serializers.detector_workflow_serializer import (
    DetectorWorkflowSerializer,
)
from sentry.workflow_engine.endpoints.validators.detector_workflow import (
    DetectorWorkflowValidator,
    can_edit_detector_workflow_connections,
)
from sentry.workflow_engine.models.detector_workflow import DetectorWorkflow


@region_silo_endpoint
class OrganizationDetectorWorkflowIndexEndpoint(OrganizationEndpoint):
    publish_status = {
        "GET": ApiPublishStatus.EXPERIMENTAL,
        "POST": ApiPublishStatus.EXPERIMENTAL,
        "DELETE": ApiPublishStatus.EXPERIMENTAL,
    }
    owner = ApiOwner.ISSUES
    permission_classes = (OrganizationDetectorPermission,)

    @extend_schema(
        operation_id="Fetch Connected Detectors and Workflows",
        parameters=[
            GlobalParams.ORG_ID_OR_SLUG,
        ],
        responses={
            201: DetectorWorkflowSerializer,
            400: RESPONSE_BAD_REQUEST,
            401: RESPONSE_UNAUTHORIZED,
            403: RESPONSE_FORBIDDEN,
            404: RESPONSE_NOT_FOUND,
        },
    )
    def get(self, request, organization):
        """
        Returns a list of connected detector and workflows.
        Can optionally filter by detector_id and/or workflow_id.
        """
        detector_id = request.GET.get("detector_id")
        workflow_id = request.GET.get("workflow_id")

        queryset = DetectorWorkflow.objects.filter(workflow__organization=organization)

        if workflow_id:
            queryset = queryset.filter(workflow_id=workflow_id)

        if detector_id:
            queryset = queryset.filter(detector_id=detector_id)

        return self.paginate(
            request=request,
            queryset=queryset,
            order_by="id",
            on_results=lambda x: serialize(x, request.user),
        )

    @extend_schema(
        operation_id="Connect a Detector and Workflow",
        parameters=[
            GlobalParams.ORG_ID_OR_SLUG,
        ],
        responses={
            201: DetectorWorkflowSerializer,
            400: RESPONSE_BAD_REQUEST,
            401: RESPONSE_UNAUTHORIZED,
            403: RESPONSE_FORBIDDEN,
            404: RESPONSE_NOT_FOUND,
            409: RESPONSE_CONFLICT,
        },
    )
    def post(self, request, organization):
        """
        Creates a connection between a detector and workflow.
        """
        validator = DetectorWorkflowValidator(
            data=request.data, context={"organization": organization, "request": request}
        )
        if not validator.is_valid():
            raise serializers.ValidationError(validator.errors)

        detector_workflow = validator.save()

        return Response(serialize(detector_workflow, request.user))

    def delete(self, request, organization):
        """
        Deletes connections between detectors and workflows.
        Must provide either detector_id or workflow_id.
        Specifying detector_id deletes all associations for the detector.
        Specifying workflow_id deletes all associations for the workflow.
        Specifying both deletes the specific connection between the detector and workflow.
        """
        detector_id = request.GET.get("detector_id")
        workflow_id = request.GET.get("workflow_id")

        if not detector_id and not workflow_id:
            raise serializers.ValidationError(
                {"detail": "detector_id and/or workflow_id must be provided."}
            )

        queryset = (
            DetectorWorkflow.objects.filter(workflow__organization=organization)
            .select_related("detector")
            .select_related("detector__project")
        )

        if workflow_id:
            queryset = queryset.filter(workflow_id=workflow_id)

        if detector_id:
            queryset = queryset.filter(detector_id=detector_id)

        if not queryset:
            return Response(status=status.HTTP_404_NOT_FOUND)

        detector_workflows = list(queryset)

        # check that the user has permission to edit all detectors connections before deleting
        for detector_workflow in detector_workflows:
            if not can_edit_detector_workflow_connections(detector_workflow.detector, request):
                raise PermissionDenied

        queryset.delete()

        for detector_workflow in detector_workflows:
            create_audit_entry(
                request=request,
                organization=organization,
                target_object=detector_workflow.id,
                event=audit_log.get_event_id("DETECTOR_WORKFLOW_REMOVE"),
                data=detector_workflow.get_audit_log_data(),
            )

        return Response(status=status.HTTP_204_NO_CONTENT)
