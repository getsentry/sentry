from datetime import datetime
from functools import partial

from django.db import router, transaction
from django.db.models import Count, OuterRef, Q, QuerySet, Subquery
from django.db.models.functions import Coalesce
from drf_spectacular.utils import extend_schema
from rest_framework import status
from rest_framework.exceptions import ValidationError
from rest_framework.request import Request
from rest_framework.response import Response

from sentry import audit_log
from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import region_silo_endpoint
from sentry.api.bases import OrganizationEndpoint
from sentry.api.bases.organization import OrganizationPermission
from sentry.api.event_search import SearchConfig, SearchFilter, SearchKey, default_config
from sentry.api.event_search import parse_search_query as base_parse_search_query
from sentry.api.exceptions import ResourceDoesNotExist
from sentry.api.paginator import OffsetPaginator
from sentry.api.serializers import serialize
from sentry.apidocs.constants import (
    RESPONSE_BAD_REQUEST,
    RESPONSE_FORBIDDEN,
    RESPONSE_NO_CONTENT,
    RESPONSE_NOT_FOUND,
    RESPONSE_SUCCESS,
    RESPONSE_UNAUTHORIZED,
)
from sentry.apidocs.parameters import GlobalParams, OrganizationParams, WorkflowParams
from sentry.constants import ObjectStatus
from sentry.deletions.models.scheduleddeletion import RegionScheduledDeletion
from sentry.models.organization import Organization
from sentry.utils.audit import create_audit_entry
from sentry.utils.dates import ensure_aware
from sentry.workflow_engine.endpoints.serializers.workflow_serializer import WorkflowSerializer
from sentry.workflow_engine.endpoints.utils.filters import apply_filter
from sentry.workflow_engine.endpoints.utils.sortby import SortByParam
from sentry.workflow_engine.endpoints.validators.base.workflow import WorkflowValidator
from sentry.workflow_engine.endpoints.validators.detector_workflow import (
    BulkWorkflowDetectorsValidator,
)
from sentry.workflow_engine.endpoints.validators.detector_workflow_mutation import (
    DetectorWorkflowMutationValidator,
)
from sentry.workflow_engine.models import Workflow
from sentry.workflow_engine.models.workflow_fire_history import WorkflowFireHistory

# Maps API field name to database field name, with synthetic aggregate fields keeping
# to our field naming scheme for consistency.
SORT_COL_MAP = {
    "name": "name",
    "id": "id",
    "dateCreated": "date_added",
    "dateUpdated": "date_updated",
    "connectedDetectors": "connected_detectors",
    "actions": "actions",
    "lastTriggered": "last_triggered",
}

workflow_search_config = SearchConfig.create_from(
    default_config,
    text_operator_keys={"name", "action"},
    allowed_keys={"name", "action"},
    allow_boolean=False,
    free_text_key="query",
)
parse_workflow_query = partial(base_parse_search_query, config=workflow_search_config)


class OrganizationWorkflowPermission(OrganizationPermission):
    scope_map = {
        "GET": ["org:read", "org:write", "org:admin", "alerts:read"],
        "POST": ["org:write", "org:admin", "alerts:write"],
        "PUT": ["org:write", "org:admin", "alerts:write"],
        "DELETE": ["org:write", "org:admin", "alerts:write"],
    }


class OrganizationWorkflowEndpoint(OrganizationEndpoint):
    permission_classes = (OrganizationWorkflowPermission,)

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
        "GET": ApiPublishStatus.EXPERIMENTAL,
        "POST": ApiPublishStatus.EXPERIMENTAL,
        "PUT": ApiPublishStatus.EXPERIMENTAL,
        "DELETE": ApiPublishStatus.EXPERIMENTAL,
    }
    owner = ApiOwner.ISSUES
    permission_classes = (OrganizationWorkflowPermission,)

    def filter_workflows(self, request: Request, organization: Organization) -> QuerySet[Workflow]:
        """
        Helper function to filter workflows based on request parameters.
        """
        queryset: QuerySet[Workflow] = Workflow.objects.filter(organization_id=organization.id)

        if raw_idlist := request.GET.getlist("id"):
            try:
                ids = [int(id) for id in raw_idlist]
            except ValueError:
                raise ValidationError({"id": ["Invalid ID format"]})
            queryset = queryset.filter(id__in=ids)

            # If specific IDs are provided, skip query and project filtering
            return queryset

        if raw_detectorlist := request.GET.getlist("detector"):
            try:
                detector_ids = [int(id) for id in raw_detectorlist]
            except ValueError:
                raise ValidationError({"detector": ["Invalid detector ID format"]})
            queryset = queryset.filter(detectorworkflow__detector_id__in=detector_ids).distinct()

        if raw_query := request.GET.get("query"):
            for filter in parse_workflow_query(raw_query):
                assert isinstance(filter, SearchFilter)
                match filter:
                    case SearchFilter(key=SearchKey("name"), operator=("=" | "IN" | "!=")):
                        queryset = apply_filter(queryset, filter, "name")
                    case SearchFilter(key=SearchKey("action"), operator=("=" | "IN" | "!=")):
                        queryset = apply_filter(
                            queryset,
                            filter,
                            "workflowdataconditiongroup__condition_group__dataconditiongroupaction__action__type",
                            distinct=True,
                        )
                    case SearchFilter(key=SearchKey("query"), operator="="):
                        # 'query' is our free text key; all free text gets returned here
                        # as '=', and we search any relevant fields for it.
                        queryset = queryset.filter(
                            Q(name__icontains=filter.value.value)
                            | Q(
                                workflowdataconditiongroup__condition_group__dataconditiongroupaction__action__type__icontains=filter.value.value,
                            )
                        ).distinct()
                    case _:
                        # TODO: What about unrecognized keys?
                        pass

        projects = self.get_projects(request, organization)
        if projects:
            queryset = queryset.filter(
                Q(detectorworkflow__detector__project__in=projects)
                | Q(detectorworkflow__isnull=True)
            ).distinct()

        return queryset

    @extend_schema(
        operation_id="Fetch Workflows",
        parameters=[
            GlobalParams.ORG_ID_OR_SLUG,
            WorkflowParams.SORT_BY,
            WorkflowParams.QUERY,
            WorkflowParams.ID,
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

        queryset = self.filter_workflows(request, organization)

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
            case "last_triggered":
                long_ago = ensure_aware(datetime(1970, 1, 1))

                # We've got an index on (workflow, date_added) which allows a subquery
                # to be more efficient than a Max() aggregation, because it lets us look at ~1
                # workflow fire history row per workflow.
                latest_fire_subquery = Subquery(
                    WorkflowFireHistory.objects.filter(workflow=OuterRef("pk"))
                    .order_by("-date_added")
                    .values("date_added")[:1]
                )

                queryset = queryset.annotate(
                    last_triggered=Coalesce(latest_fire_subquery, long_ago)
                )

        queryset = queryset.order_by(*sort_by.db_order_by)

        return self.paginate(
            request=request,
            queryset=queryset,
            order_by=sort_by.db_order_by,
            paginator_cls=OffsetPaginator,
            on_results=lambda x: serialize(x, request.user),
            count_hits=True,
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

        with transaction.atomic(router.db_for_write(Workflow)):
            workflow = validator.create(validator.validated_data)

            detector_ids = request.data.get("detectorIds", [])
            if detector_ids:
                bulk_validator = BulkWorkflowDetectorsValidator(
                    data={
                        "workflow_id": workflow.id,
                        "detector_ids": detector_ids,
                    },
                    context={"organization": organization, "request": request},
                )
                bulk_validator.is_valid(raise_exception=True)
                bulk_validator.save()

        return Response(serialize(workflow, request.user), status=status.HTTP_201_CREATED)

    @extend_schema(
        operation_id="Mutate an Organization's Workflows",
        description=("Currently supports bulk enabling/disabling workflows."),
        parameters=[
            GlobalParams.ORG_ID_OR_SLUG,
        ],
        responses={
            200: RESPONSE_SUCCESS,
            201: WorkflowSerializer,
            400: RESPONSE_BAD_REQUEST,
            401: RESPONSE_UNAUTHORIZED,
            403: RESPONSE_FORBIDDEN,
            404: RESPONSE_NOT_FOUND,
        },
    )
    def put(self, request, organization):
        """
        Mutates workflows for a given org
        """
        if not (
            request.GET.getlist("id")
            or request.GET.get("query")
            or request.GET.getlist("project")
            or request.GET.getlist("projectSlug")
        ):
            return Response(
                {
                    "detail": "At least one of 'id', 'query', 'project', or 'projectSlug' must be provided."
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        validator = DetectorWorkflowMutationValidator(data=request.data)
        validator.is_valid(raise_exception=True)
        enabled = validator.validated_data["enabled"]

        queryset = self.filter_workflows(request, organization)

        if not queryset:
            return Response(
                {"detail": "No workflows found."},
                status=status.HTTP_200_OK,
            )

        with transaction.atomic(router.db_for_write(Workflow)):
            # We update workflows individually to ensure post_save signals are called
            for workflow in queryset:
                workflow.update(enabled=enabled)

        return self.paginate(
            request=request,
            queryset=queryset,
            order_by="id",
            paginator_cls=OffsetPaginator,
            on_results=lambda x: serialize(x, request.user),
        )

    @extend_schema(
        operation_id="Delete an Organization's Workflows",
        parameters=[
            GlobalParams.ORG_ID_OR_SLUG,
        ],
        responses={
            200: RESPONSE_SUCCESS,
            204: RESPONSE_NO_CONTENT,
            400: RESPONSE_BAD_REQUEST,
            401: RESPONSE_UNAUTHORIZED,
            403: RESPONSE_FORBIDDEN,
            404: RESPONSE_NOT_FOUND,
        },
    )
    def delete(self, request, organization):
        """
        Deletes workflows for a given org
        """
        if not (
            request.GET.getlist("id")
            or request.GET.get("query")
            or request.GET.getlist("project")
            or request.GET.getlist("projectSlug")
        ):
            return Response(
                {
                    "detail": "At least one of 'id', 'query', 'project', or 'projectSlug' must be provided."
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        queryset = self.filter_workflows(request, organization)

        if not queryset:
            return Response(
                {"detail": "No workflows found."},
                status=status.HTTP_200_OK,
            )

        for workflow in queryset:
            with transaction.atomic(router.db_for_write(Workflow)):
                RegionScheduledDeletion.schedule(workflow, days=0, actor=request.user)
                create_audit_entry(
                    request=request,
                    organization=organization,
                    target_object=workflow.id,
                    event=audit_log.get_event_id("WORKFLOW_REMOVE"),
                    data=workflow.get_audit_log_data(),
                )
                workflow.update(status=ObjectStatus.PENDING_DELETION)

        return Response(status=status.HTTP_204_NO_CONTENT)
