from drf_spectacular.utils import extend_schema
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
from sentry.deletions.models.scheduleddeletion import RegionScheduledDeletion
from sentry.models.organization import Organization
from sentry.utils.audit import create_audit_entry
from sentry.workflow_engine.endpoints.organization_workflow_index import (
    OrganizationWorkflowEndpoint,
)
from sentry.workflow_engine.endpoints.serializers import WorkflowSerializer
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

    def put(self, request: Request, organization: Organization, workflow: Workflow):
        """
        Updates a workflow
        """
        create_audit_entry(
            request=request,
            organization=organization,
            target_object=workflow.id,
            event=audit_log.get_event_id("WORKFLOW_EDIT"),
            data=workflow.get_audit_log_data(),
        )

        pass

    def delete(self, request: Request, organization: Organization, workflow: Workflow):
        """
        Delete a workflow
        """
        RegionScheduledDeletion.schedule(workflow, days=0, actor=request.user)
        create_audit_entry(
            request=request,
            organization=organization,
            target_object=workflow.id,
            event=audit_log.get_event_id("WORKFLOW_REMOVE"),
            data=workflow.get_audit_log_data(),
        )

        return Response(status=204)
