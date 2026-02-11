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
    RESPONSE_NO_CONTENT,
    RESPONSE_NOT_FOUND,
    RESPONSE_UNAUTHORIZED,
)
from sentry.apidocs.examples.workflow_engine_examples import WorkflowEngineExamples
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
@extend_schema(tags=["Monitors"])
class OrganizationWorkflowDetailsEndpoint(OrganizationWorkflowEndpoint):
    publish_status = {
        "GET": ApiPublishStatus.PUBLIC,
        "PUT": ApiPublishStatus.PUBLIC,
        "DELETE": ApiPublishStatus.PUBLIC,
    }
    owner = ApiOwner.ALERTS_NOTIFICATIONS

    @extend_schema(
        operation_id="Fetch an Alert",
        parameters=[
            GlobalParams.ORG_ID_OR_SLUG,
            WorkflowParams.WORKFLOW_ID,
        ],
        responses={
            200: WorkflowSerializer,
            400: RESPONSE_BAD_REQUEST,
            401: RESPONSE_UNAUTHORIZED,
            403: RESPONSE_FORBIDDEN,
            404: RESPONSE_NOT_FOUND,
        },
        examples=WorkflowEngineExamples.GET_WORKFLOW,
    )
    def get(self, request: Request, organization: Organization, workflow: Workflow) -> Response:
        """
        ⚠️ This endpoint is currently in **beta** and may be subject to change. It is supported by [New Monitors and Alerts](/product/new-monitors-and-alerts/) and may not be viewable in the UI today.

        Returns an alert.
        """
        serialized_workflow = serialize(
            workflow,
            request.user,
            WorkflowSerializer(),
        )
        return Response(serialized_workflow)

    @extend_schema(
        operation_id="Update an Alert by ID",
        parameters=[
            GlobalParams.ORG_ID_OR_SLUG,
            WorkflowParams.WORKFLOW_ID,
        ],
        request=WorkflowValidator,
        responses={
            200: WorkflowSerializer,
            400: RESPONSE_BAD_REQUEST,
            401: RESPONSE_UNAUTHORIZED,
            403: RESPONSE_FORBIDDEN,
            404: RESPONSE_NOT_FOUND,
        },
        examples=WorkflowEngineExamples.UPDATE_WORKFLOW,
    )
    def put(self, request: Request, organization: Organization, workflow: Workflow) -> Response:
        """
        ⚠️ This endpoint is currently in **beta** and may be subject to change. It is supported by [New Monitors and Alerts](/product/new-monitors-and-alerts/) and may not be viewable in the UI today.

        Updates an alert.
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

    @extend_schema(
        operation_id="Delete an Alert",
        parameters=[
            GlobalParams.ORG_ID_OR_SLUG,
            WorkflowParams.WORKFLOW_ID,
        ],
        responses={
            204: RESPONSE_NO_CONTENT,
            400: RESPONSE_BAD_REQUEST,
            401: RESPONSE_UNAUTHORIZED,
            403: RESPONSE_FORBIDDEN,
            404: RESPONSE_NOT_FOUND,
        },
    )
    def delete(self, request: Request, organization: Organization, workflow: Workflow) -> Response:
        """
        ⚠️ This endpoint is currently in **beta** and may be subject to change. It is supported by [New Monitors and Alerts](/product/new-monitors-and-alerts/) and may not be viewable in the UI today.

        Deletes an alert.
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
