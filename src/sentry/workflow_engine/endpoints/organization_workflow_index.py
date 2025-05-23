from django.db.models import Count, Q
from drf_spectacular.utils import extend_schema
from rest_framework import status
from rest_framework.request import Request
from rest_framework.response import Response

from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import region_silo_endpoint
from sentry.api.bases import OrganizationEndpoint
from sentry.api.exceptions import ResourceDoesNotExist
from sentry.api.paginator import OffsetPaginator
from sentry.api.serializers import serialize
from sentry.apidocs.constants import (
    RESPONSE_BAD_REQUEST,
    RESPONSE_FORBIDDEN,
    RESPONSE_NOT_FOUND,
    RESPONSE_UNAUTHORIZED,
)
from sentry.apidocs.parameters import GlobalParams, OrganizationParams, WorkflowParams
from sentry.db.models.query import in_icontains, in_iexact
from sentry.search.utils import tokenize_query
from sentry.workflow_engine.endpoints.serializers import WorkflowSerializer
from sentry.workflow_engine.endpoints.utils.sortby import SortByParam
from sentry.workflow_engine.endpoints.validators.base.workflow import WorkflowValidator
from sentry.workflow_engine.models import Workflow

# Maps API field name to database field name, with synthetic aggregate fields keeping
# to our field naming scheme for consistency.
SORT_COL_MAP = {
    "name": "name",
    "id": "id",
    "dateCreated": "date_added",
    "dateUpdated": "date_updated",
    "connectedDetectors": "connected_detectors",
    "actions": "actions",
}


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
            WorkflowParams.SORT_BY,
            WorkflowParams.QUERY,
            OrganizationParams.PROJECT,
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
        sort_by = SortByParam.parse(request.GET.get("sortBy", "id"), SORT_COL_MAP)

        queryset = Workflow.objects.filter(organization_id=organization.id)

        if raw_query := request.GET.get("query"):
            tokenized_query = tokenize_query(raw_query)
            for key, values in tokenized_query.items():
                match key:
                    case "name":
                        queryset = queryset.filter(in_iexact("name", values))
                    case "action":
                        queryset = queryset.filter(
                            in_iexact(
                                "workflowdataconditiongroup__condition_group__dataconditiongroupaction__action__type",
                                values,
                            )
                        ).distinct()
                    case "query":
                        queryset = queryset.filter(
                            in_icontains("name", values)
                            | in_icontains(
                                "workflowdataconditiongroup__condition_group__dataconditiongroupaction__action__type",
                                values,
                            )
                        ).distinct()
                    case _:
                        # TODO: What about unreecognized keys?
                        pass

        projects = self.get_projects(request, organization)
        if projects:
            queryset = queryset.filter(
                Q(detectorworkflow__detector__project__in=projects)
                | Q(detectorworkflow__isnull=True)
            ).distinct()

        # Add synthetic fields to the queryset if needed.
        match sort_by.db_field_name:
            case "connected_detectors":
                queryset = queryset.annotate(connected_detectors=Count("detectorworkflow"))
            case "actions":
                queryset = queryset.annotate(
                    actions=Count(
                        "workflowdataconditiongroup__condition_group__dataconditiongroupaction__action",
                    )
                )

        queryset = queryset.order_by(*sort_by.db_order_by)

        return self.paginate(
            request=request,
            queryset=queryset,
            order_by=sort_by.db_order_by,
            paginator_cls=OffsetPaginator,
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
