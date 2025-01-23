from drf_spectacular.utils import extend_schema
from rest_framework import status
from rest_framework.response import Response

from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import region_silo_endpoint
from sentry.api.bases import OrganizationEndpoint
from sentry.api.serializers import serialize
from sentry.apidocs.constants import (
    RESPONSE_BAD_REQUEST,
    RESPONSE_FORBIDDEN,
    RESPONSE_NOT_FOUND,
    RESPONSE_UNAUTHORIZED,
)
from sentry.apidocs.parameters import GlobalParams
from sentry.workflow_engine.endpoints.serializers import WorkflowSerializer
from sentry.workflow_engine.models import Workflow


@region_silo_endpoint
class OrganizationWorkflowIndexEndpoint(OrganizationEndpoint):
    publish_status = {
        "POST": ApiPublishStatus.EXPERIMENTAL,
        "GET": ApiPublishStatus.EXPERIMENTAL,
    }
    owner = ApiOwner.ISSUES

    def _get_validator(self, request, organization):
        # TODO - validate the POST request data
        # This should be similar to: BaseGroupTypeDetectorValidator
        pass

    @extend_schema(
        operation_id="Fetch Workflows",
        parameters=[
            GlobalParams.ORG_ID_OR_SLUG,
        ],
        responses={
            201: WorkflowSerializer,
            400: RESPONSE_BAD_REQUEST,
            401: RESPONSE_UNAUTHORIZED,
            403: RESPONSE_FORBIDDEN,
            404: RESPONSE_NOT_FOUND,
        },
    )
    def get(self, request, organization):
        """
        Returns a list of workflows for a given org
        """
        # TODO add additonal filters and ordering
        queryset = Workflow.objects.filter(organization_id=organization.id).order_by("id")

        return self.paginate(
            request=request,
            queryset=queryset,
            order_by="id",
            on_results=lambda x: serialize(x, request.user),
        )

    @extend_schema(
        operation_id="Create a Workflow",
        parameters=[
            GlobalParams.ORG_ID_OR_SLUG,
        ],
        responses={
            201: WorkflowSerializer,
            400: RESPONSE_BAD_REQUEST,
            401: RESPONSE_UNAUTHORIZED,
            403: RESPONSE_FORBIDDEN,
            404: RESPONSE_NOT_FOUND,
        },
    )
    def post(self, request, organization):
        """
        Creates a workflow for an organization
        ``````````````````````````````````````
        Create a new workflow for an organization.

        :param string name: The name of the workflow
        :param list[Conditions] conditions: The conditions that must be met for the workflow to trigger
        :param list[Actions] actions: The actions that will be triggered when the workflow is triggered
        """
        validator = self._get_validator(request, organization)

        if validator.is_valid():
            return Response(validator.errors, status=status.HTTP_400_BAD_REQUEST)

        workflow = validator.save()
        return Response(serialize(workflow, request.user), status=status.HTTP_201_CREATED)
