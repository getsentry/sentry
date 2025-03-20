from django.db import IntegrityError
from drf_spectacular.utils import extend_schema
from rest_framework import serializers, status
from rest_framework.response import Response

from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import region_silo_endpoint
from sentry.api.bases import OrganizationEndpoint
from sentry.api.bases.organization import OrganizationPermission
from sentry.api.exceptions import ResourceDoesNotExist
from sentry.api.serializers import serialize
from sentry.apidocs.constants import (
    RESPONSE_BAD_REQUEST,
    RESPONSE_CONFLICT,
    RESPONSE_FORBIDDEN,
    RESPONSE_NOT_FOUND,
    RESPONSE_UNAUTHORIZED,
)
from sentry.apidocs.parameters import GlobalParams
from sentry.workflow_engine.endpoints.serializers import DetectorWorkflowSerializer
from sentry.workflow_engine.endpoints.validators.detector_workflow import DetectorWorkflowValidator
from sentry.workflow_engine.models.detector import Detector
from sentry.workflow_engine.models.detector_workflow import DetectorWorkflow
from sentry.workflow_engine.models.workflow import Workflow


@region_silo_endpoint
class OrganizationDetectorWorkflowIndexEndpoint(OrganizationEndpoint):
    publish_status = {
        "GET": ApiPublishStatus.EXPERIMENTAL,
        "POST": ApiPublishStatus.EXPERIMENTAL,
        "DELETE": ApiPublishStatus.EXPERIMENTAL,
    }
    owner = ApiOwner.ISSUES
    permission_classes = OrganizationPermission

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
        Returns a list of connected detector and workflows
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
            on_results=lambda x: serialize(x, request.user, DetectorWorkflowSerializer()),
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
        Creates a connection between a detector and workflow
        """
        serializer = DetectorWorkflowValidator(data=request.data)
        if not serializer.is_valid():
            raise serializers.ValidationError(serializer.errors)

        result = serializer.validated_data

        try:
            detector = Detector.objects.get(
                project__organization=organization, id=result["detector_id"]
            )
            workflow = Workflow.objects.get(organization=organization, id=result["workflow_id"])
        except (Detector.DoesNotExist, Workflow.DoesNotExist):
            raise ResourceDoesNotExist

        try:
            detector_workflow = DetectorWorkflow.objects.create(
                detector=detector, workflow=workflow
            )
        except IntegrityError:
            return Response(
                {"detail": "Duplicate detector and workflow connection."},
                status=status.HTTP_409_CONFLICT,
            )

        return Response(serialize(detector_workflow, request.user, DetectorWorkflowSerializer()))

    def delete(self, request, organization):
        """
        Deletes connections between detectors and workflows
        """
        detector_id = request.GET.get("detector_id")
        workflow_id = request.GET.get("workflow_id")

        if not detector_id and not workflow_id:
            raise serializers.ValidationError(
                {"detail": "detector_id or workflow_id must be provided."}
            )

        queryset = DetectorWorkflow.objects.filter(workflow__organization=organization)

        if workflow_id:
            queryset = queryset.filter(workflow_id=workflow_id)

        if detector_id:
            queryset = queryset.filter(detector_id=detector_id)

        if not queryset:
            return Response(status=status.HTTP_404_NOT_FOUND)

        queryset.delete()

        return Response(status=status.HTTP_204_NO_CONTENT)
