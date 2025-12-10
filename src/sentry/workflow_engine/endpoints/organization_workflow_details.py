from django.db import router, transaction
from drf_spectacular.utils import extend_schema
from rest_framework.exceptions import ValidationError
from rest_framework.request import Request
from rest_framework.response import Response

from sentry import audit_log
from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import region_silo_endpoint
from sentry.api.serializers import serialize
from sentry.apidocs.constants import (
    RESPONSE_BAD_REQUEST,
    RESPONSE_FORBIDDEN,
    RESPONSE_NOT_FOUND,
    RESPONSE_UNAUTHORIZED,
)
from sentry.apidocs.parameters import GlobalParams, WorkflowParams
from sentry.constants import ObjectStatus
from sentry.deletions.models.scheduleddeletion import RegionScheduledDeletion
from sentry.models.organization import Organization
from sentry.utils.audit import create_audit_entry
from sentry.workflow_engine.endpoints.organization_workflow_index import (
    OrganizationWorkflowEndpoint,
)
from sentry.workflow_engine.endpoints.serializers.workflow_serializer import WorkflowSerializer
from sentry.workflow_engine.endpoints.validators.base.workflow import WorkflowValidator
from sentry.workflow_engine.endpoints.validators.detector_workflow import (
    BulkWorkflowDetectorsValidator,
)
from sentry.workflow_engine.models import Workflow


@region_silo_endpoint
class OrganizationWorkflowDetailsEndpoint(OrganizationWorkflowEndpoint):
    publish_status = {
        "GET": ApiPublishStatus.EXPERIMENTAL,
        "PUT": ApiPublishStatus.EXPERIMENTAL,
        "DELETE": ApiPublishStatus.EXPERIMENTAL,
    }
    owner = ApiOwner.ALERTS_NOTIFICATIONS

    @extend_schema(
        operation_id="Fetch a Workflow",
        parameters=[
            GlobalParams.ORG_ID_OR_SLUG,
            WorkflowParams.WORKFLOW_ID,
        ],
        responses={
            201: WorkflowSerializer,
            400: RESPONSE_BAD_REQUEST,
            401: RESPONSE_UNAUTHORIZED,
            403: RESPONSE_FORBIDDEN,
            404: RESPONSE_NOT_FOUND,
        },
    )
    def get(self, request: Request, organization: Organization, workflow: Workflow):
        """
        Returns a workflow
        """
        serialized_workflow = serialize(
            workflow,
            request.user,
            WorkflowSerializer(),
        )
        return Response(serialized_workflow)

    @extend_schema(
        operation_id="Update a Workflow",
        parameters=[
            GlobalParams.ORG_ID_OR_SLUG,
            WorkflowParams.WORKFLOW_ID,
        ],
        responses={
            201: WorkflowSerializer,
            400: RESPONSE_BAD_REQUEST,
            401: RESPONSE_UNAUTHORIZED,
            403: RESPONSE_FORBIDDEN,
            404: RESPONSE_NOT_FOUND,
        },
    )
    def put(self, request: Request, organization: Organization, workflow: Workflow):
        """
        Updates a workflow
        """
        validator = WorkflowValidator(
            data=request.data,
            context={
                "organization": organization,
                "request": request,
                "workflow": workflow,
            },
        )

        validator.is_valid(raise_exception=True)

        with transaction.atomic(router.db_for_write(Workflow)):
            validator.update(workflow, validator.validated_data)

            detector_ids = request.data.get("detectorIds")
            if detector_ids is not None:
                bulk_validator = BulkWorkflowDetectorsValidator(
                    data={
                        "workflow_id": workflow.id,
                        "detector_ids": detector_ids,
                    },
                    context={
                        "organization": organization,
                        "request": request,
                    },
                )
                if not bulk_validator.is_valid():
                    raise ValidationError({"detectorIds": bulk_validator.errors})

                bulk_validator.save()

            create_audit_entry(
                request=request,
                organization=organization,
                target_object=workflow.id,
                event=audit_log.get_event_id("WORKFLOW_EDIT"),
                data=workflow.get_audit_log_data(),
            )

        workflow.refresh_from_db()

        return Response(
            serialize(workflow, request.user, WorkflowSerializer()),
            status=200,
        )

    def delete(self, request: Request, organization: Organization, workflow: Workflow):
        """
        Delete a workflow
        """
        RegionScheduledDeletion.schedule(workflow, days=0, actor=request.user)
        workflow.update(status=ObjectStatus.PENDING_DELETION)
        create_audit_entry(
            request=request,
            organization=organization,
            target_object=workflow.id,
            event=audit_log.get_event_id("WORKFLOW_REMOVE"),
            data=workflow.get_audit_log_data(),
        )

        return Response(status=204)
