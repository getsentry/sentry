from drf_spectacular.utils import extend_schema
from rest_framework import status
from rest_framework.request import Request
from rest_framework.response import Response

from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import region_silo_endpoint
from sentry.api.bases import OrganizationEndpoint
from sentry.api.exceptions import ResourceDoesNotExist
from sentry.api.serializers import serialize
from sentry.apidocs.constants import (
    RESPONSE_BAD_REQUEST,
    RESPONSE_FORBIDDEN,
    RESPONSE_NOT_FOUND,
    RESPONSE_UNAUTHORIZED,
)
from sentry.apidocs.parameters import GlobalParams
from sentry.workflow_engine.endpoints.serializers import WorkflowSerializer
from sentry.workflow_engine.endpoints.validators.base.workflow import WorkflowValidator
from sentry.workflow_engine.models import Workflow


class OrganizationWorkflowEndpoint(OrganizationEndpoint):
    def convert_args(self, request: Request, workflow_id, *args, **kwargs):
        args, kwargs = super().convert_args(request, *args, **kwargs)
        try:
            kwargs["workflow"] = Workflow.objects.get(
                organization=kwargs["organization"], id=workflow_id
            )
        except Workflow.DoesNotExist:
            raise ResourceDoesNotExist

        return args, kwargs


@region_silo_endpoint
class OrganizationWorkflowIndexEndpoint(OrganizationEndpoint):
    publish_status = {
        "POST": ApiPublishStatus.EXPERIMENTAL,
        "GET": ApiPublishStatus.EXPERIMENTAL,
    }
    owner = ApiOwner.ISSUES

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
        `````````````````````````````````````
        :param string name: The name of the workflow
        :param bool enabled: Whether the workflow is enabled or not
        :param object config: The configuration of the workflow
        :param object triggers: The Data Condition and DataConditionGroup for the when condition of a workflow
        :param object action_filters: The Data Conditions, Data Condition Group, and Actions to invoke when a workflow is triggered
        """
        validator = WorkflowValidator(
            data=request.data,
            context={"organization": organization, "request": request},
        )

        validator.is_valid(raise_exception=True)
        workflow = validator.create(validator.validated_data)
        return Response(serialize(workflow, request.user), status=status.HTTP_201_CREATED)
