from collections.abc import Iterable, Sequence
from functools import partial
from typing import assert_never

from django.db import router, transaction
from django.db.models import Count, F, OuterRef, Q, Subquery
from django.db.models.query import QuerySet
from drf_spectacular.utils import PolymorphicProxySerializer, extend_schema
from rest_framework import status
from rest_framework.exceptions import PermissionDenied, ValidationError
from rest_framework.request import Request
from rest_framework.response import Response

from sentry import audit_log, features
from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import region_silo_endpoint
from sentry.api.bases import OrganizationEndpoint
from sentry.api.bases.organization import OrganizationDetectorPermission
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
from sentry.apidocs.examples.workflow_engine_examples import WorkflowEngineExamples
from sentry.apidocs.parameters import DetectorParams, GlobalParams, OrganizationParams
from sentry.apidocs.utils import inline_sentry_response_serializer
from sentry.constants import ObjectStatus
from sentry.deletions.models.scheduleddeletion import RegionScheduledDeletion
from sentry.incidents.grouptype import MetricIssue
from sentry.issues import grouptype
from sentry.issues.issue_search import convert_actor_or_none_value
from sentry.models.group import GroupStatus
from sentry.models.organization import Organization
from sentry.models.project import Project
from sentry.models.team import Team
from sentry.monitors.grouptype import MonitorIncidentType
from sentry.uptime.grouptype import UptimeDomainCheckFailure
from sentry.users.models.user import User
from sentry.users.services.user import RpcUser
from sentry.utils.audit import create_audit_entry
from sentry.workflow_engine.endpoints.serializers.detector_serializer import (
    DetectorSerializer,
    DetectorSerializerResponse,
)
from sentry.workflow_engine.endpoints.utils.filters import apply_filter
from sentry.workflow_engine.endpoints.validators.base import BaseDetectorTypeValidator
from sentry.workflow_engine.endpoints.validators.detector_workflow import (
    BulkDetectorWorkflowsValidator,
    can_delete_detectors,
    can_edit_detectors,
)
from sentry.workflow_engine.endpoints.validators.detector_workflow_mutation import (
    DetectorWorkflowMutationValidator,
)
from sentry.workflow_engine.endpoints.validators.utils import get_unknown_detector_type_error
from sentry.workflow_engine.models import Detector
from sentry.workflow_engine.models.detector_group import DetectorGroup

detector_search_config = SearchConfig.create_from(
    default_config,
    text_operator_keys={"name", "type"},
    allowed_keys={"name", "type", "assignee"},
    allow_boolean=False,
    free_text_key="query",
)
parse_detector_query = partial(base_parse_search_query, config=detector_search_config)


def convert_assignee_values(value: Iterable[str], projects: Sequence[Project], user: User) -> Q:
    """
    Convert an assignee search value to a Django Q object for filtering detectors.
    """
    actors_or_none: list[RpcUser | Team | None] = convert_actor_or_none_value(
        value, projects, user, None
    )
    assignee_query = Q()
    for actor in actors_or_none:
        if isinstance(actor, (User, RpcUser)):
            assignee_query |= Q(owner_user_id=actor.id)
        elif isinstance(actor, Team):
            assignee_query |= Q(owner_team_id=actor.id)
        elif actor is None:
            assignee_query |= Q(owner_team_id__isnull=True, owner_user_id__isnull=True)
        else:
            assert_never(actor)
    return assignee_query


# Maps API field name to database ordering expressions
SORT_MAP = {
    "name": "name",
    "-name": "-name",
    "id": "id",
    "-id": "-id",
    "type": "type",
    "-type": "-type",
    "connectedWorkflows": "connected_workflows",
    "-connectedWorkflows": "-connected_workflows",
    "latestGroup": F("latest_group_date_added").asc(nulls_first=True),
    "-latestGroup": F("latest_group_date_added").desc(nulls_last=True),
    "openIssues": F("open_issues_count").asc(nulls_first=True),
    "-openIssues": F("open_issues_count").desc(nulls_last=True),
}

DETECTOR_TYPE_ALIASES = {
    "metric": MetricIssue.slug,
    "uptime": UptimeDomainCheckFailure.slug,
    "cron": MonitorIncidentType.slug,
}


def get_detector_validator(
    request: Request, project: Project, detector_type_slug: str, instance=None
) -> BaseDetectorTypeValidator:
    type = grouptype.registry.get_by_slug(detector_type_slug)
    if type is None:
        error_message = get_unknown_detector_type_error(detector_type_slug, project.organization)
        raise ValidationError({"type": [error_message]})

    if type.detector_settings is None or type.detector_settings.validator is None:
        raise ValidationError({"type": ["Detector type not compatible with detectors"]})

    return type.detector_settings.validator(
        instance=instance,
        context={
            "project": project,
            "organization": project.organization,
            "request": request,
            "access": request.access,
        },
        data=request.data,
    )


@region_silo_endpoint
@extend_schema(tags=["Workflows"])
class OrganizationDetectorIndexEndpoint(OrganizationEndpoint):
    publish_status = {
        "GET": ApiPublishStatus.EXPERIMENTAL,
        "POST": ApiPublishStatus.EXPERIMENTAL,
        "PUT": ApiPublishStatus.EXPERIMENTAL,
        "DELETE": ApiPublishStatus.EXPERIMENTAL,
    }
    owner = ApiOwner.ISSUES

    permission_classes = (OrganizationDetectorPermission,)

    def filter_detectors(self, request: Request, organization) -> QuerySet[Detector]:
        """
        Filter detectors based on the request parameters.
        """

        if not request.user.is_authenticated:
            return Detector.objects.none()

        if raw_idlist := request.GET.getlist("id"):
            try:
                ids = [int(id) for id in raw_idlist]
                # If filtering by IDs, we must search across all accessible projects
                projects = self.get_projects(
                    request,
                    organization,
                    include_all_accessible=True,
                )
                return Detector.objects.with_type_filters().filter(
                    project_id__in=projects,
                    id__in=ids,
                )
            except ValueError:
                raise ValidationError({"id": ["Invalid ID format"]})

        projects = self.get_projects(
            request,
            organization,
        )

        queryset: QuerySet[Detector] = Detector.objects.with_type_filters().filter(
            project_id__in=projects,
        )

        if raw_query := request.GET.get("query"):
            for filter in parse_detector_query(raw_query):
                assert isinstance(filter, SearchFilter)
                match filter:
                    case SearchFilter(key=SearchKey("name"), operator=("=" | "IN" | "!=")):
                        queryset = apply_filter(queryset, filter, "name")
                    case SearchFilter(key=SearchKey("type"), operator=("=" | "IN" | "!=")):
                        values = (
                            filter.value.value
                            if isinstance(filter.value.value, list)
                            else [filter.value.value]
                        )
                        values = [DETECTOR_TYPE_ALIASES.get(value, value) for value in values]

                        if filter.operator == "!=":
                            queryset = queryset.exclude(type__in=values)
                        else:
                            queryset = queryset.filter(type__in=values)
                    case SearchFilter(key=SearchKey("assignee"), operator=("=" | "IN" | "!=")):
                        # Filter values can be emails, team slugs, "me", "my_teams", "none"
                        values = (
                            filter.value.value
                            if isinstance(filter.value.value, list)
                            else [filter.value.value]
                        )
                        assignee_q = convert_assignee_values(values, projects, request.user)

                        if filter.operator == "!=":
                            queryset = queryset.exclude(assignee_q)
                        else:
                            queryset = queryset.filter(assignee_q)
                    case SearchFilter(key=SearchKey("query"), operator="="):
                        # 'query' is our free text key; all free text gets returned here
                        # as '=', and we search any relevant fields for it.
                        queryset = queryset.filter(
                            Q(description__icontains=filter.value.value)
                            | Q(name__icontains=filter.value.value)
                            | Q(type__icontains=filter.value.value)
                        ).distinct()

        return queryset

    @extend_schema(
        operation_id="Fetch an Organization's Monitors",
        parameters=[
            GlobalParams.ORG_ID_OR_SLUG,
            OrganizationParams.PROJECT,
            DetectorParams.QUERY,
            DetectorParams.SORT,
            DetectorParams.ID,
        ],
        responses={
            201: inline_sentry_response_serializer(
                "ListDetectorSerializerResponse", list[DetectorSerializerResponse]
            ),
            400: RESPONSE_BAD_REQUEST,
            401: RESPONSE_UNAUTHORIZED,
            403: RESPONSE_FORBIDDEN,
            404: RESPONSE_NOT_FOUND,
        },
        examples=WorkflowEngineExamples.LIST_ORG_DETECTORS,
    )
    def get(self, request: Request, organization: Organization) -> Response:
        """
        List an Organization's Monitors
        """
        if not request.user.is_authenticated:
            return self.respond(status=status.HTTP_401_UNAUTHORIZED)

        queryset = self.filter_detectors(request, organization)

        sort_by = request.GET.get("sortBy", "id")
        sort_by_field = sort_by.lstrip("-")
        if sort_by not in SORT_MAP:
            raise ValidationError({"sortBy": ["Invalid sort field"]})

        if sort_by_field == "connectedWorkflows":
            queryset = queryset.annotate(connected_workflows=Count("detectorworkflow"))
        elif sort_by_field == "latestGroup":
            latest_detector_group_subquery = (
                DetectorGroup.objects.filter(detector=OuterRef("pk"))
                .order_by("-date_added")
                .values("date_added")[:1]
            )
            queryset = queryset.annotate(
                latest_group_date_added=Subquery(latest_detector_group_subquery)
            )
        elif sort_by_field == "openIssues":
            queryset = queryset.annotate(
                open_issues_count=Count(
                    "detectorgroup__group",
                    filter=Q(detectorgroup__group__status=GroupStatus.UNRESOLVED),
                )
            )

        order_by_field = [SORT_MAP[sort_by]]

        return self.paginate(
            request=request,
            paginator_cls=OffsetPaginator,
            queryset=queryset,
            order_by=order_by_field,
            on_results=lambda x: serialize(x, request.user),
            count_hits=True,
        )

    @extend_schema(
        operation_id="Create a Detector",
        parameters=[
            GlobalParams.ORG_ID_OR_SLUG,
        ],
        request=PolymorphicProxySerializer(
            "GenericDetectorSerializer",
            serializers=[
                gt.detector_settings.validator
                for gt in grouptype.registry.all()
                if gt.detector_settings and gt.detector_settings.validator
            ],
            resource_type_field_name=None,
        ),
        responses={
            201: DetectorSerializer,
            400: RESPONSE_BAD_REQUEST,
            401: RESPONSE_UNAUTHORIZED,
            403: RESPONSE_FORBIDDEN,
            404: RESPONSE_NOT_FOUND,
        },
    )
    def post(self, request: Request, organization: Organization) -> Response:
        """
        Create a Detector
        ````````````````
        Create a new detector for a project.

        :param string name: The name of the detector
        :param string type: The type of detector to create
        :param string projectId: The detector project
        :param object dataSource: Configuration for the data source
        :param array dataConditions: List of conditions to trigger the detector
        :param array workflowIds: List of workflow IDs to connect to the detector
        """
        detector_type = request.data.get("type")
        if not detector_type:
            raise ValidationError({"type": ["This field is required."]})

        # Restrict creating metric issue detectors by plan type
        if detector_type == MetricIssue.slug and not features.has(
            "organizations:incidents", organization, actor=request.user
        ):
            raise ResourceDoesNotExist

        try:
            project_id = request.data.get("projectId")
            if not project_id:
                raise ValidationError({"projectId": ["This field is required."]})

            project = Project.objects.get(id=project_id)
        except Project.DoesNotExist:
            raise ValidationError({"projectId": ["Project not found"]})

        if project.organization.id != organization.id:
            raise ValidationError({"projectId": ["Project not found"]})

        # TODO: Should be in the validator?
        if not request.access.has_project_access(project):
            return Response(status=status.HTTP_403_FORBIDDEN)

        validator = get_detector_validator(request, project, detector_type)
        if not validator.is_valid():
            return Response(validator.errors, status=status.HTTP_400_BAD_REQUEST)

        with transaction.atomic(router.db_for_write(Detector)):
            detector = validator.save()

            # Handle workflow connections in bulk
            workflow_ids = request.data.get("workflowIds", [])
            if workflow_ids:
                bulk_validator = BulkDetectorWorkflowsValidator(
                    data={
                        "detector_id": detector.id,
                        "workflow_ids": workflow_ids,
                    },
                    context={
                        "organization": organization,
                        "request": request,
                    },
                )
                if not bulk_validator.is_valid():
                    raise ValidationError({"workflowIds": bulk_validator.errors})

                bulk_validator.save()

        return Response(serialize(detector, request.user), status=status.HTTP_201_CREATED)

    @extend_schema(
        operation_id="Mutate an Organization's Detectors",
        parameters=[
            GlobalParams.ORG_ID_OR_SLUG,
            OrganizationParams.PROJECT,
            DetectorParams.QUERY,
            DetectorParams.SORT,
            DetectorParams.ID,
        ],
        responses={
            200: RESPONSE_SUCCESS,
            201: DetectorSerializer,
            400: RESPONSE_BAD_REQUEST,
            401: RESPONSE_UNAUTHORIZED,
            403: RESPONSE_FORBIDDEN,
            404: RESPONSE_NOT_FOUND,
        },
    )
    def put(self, request: Request, organization: Organization) -> Response:
        """
        Mutate an Organization's Detectors
        """
        if not request.user.is_authenticated:
            return self.respond(status=status.HTTP_401_UNAUTHORIZED)

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
        enabled = validator.validated_data.get("enabled", True)

        queryset = self.filter_detectors(request, organization)

        # If explicitly filtering by IDs and some were not found, return 400
        if request.GET.getlist("id") and len(queryset) != len(set(request.GET.getlist("id"))):
            return Response(
                {
                    "detail": "Some detectors were not found or you do not have permission to update them."
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        if not queryset:
            return Response(
                {"detail": "No detectors found."},
                status=status.HTTP_200_OK,
            )

        # Check if the user has edit permissions for all detectors
        if not can_edit_detectors(queryset, request):
            raise PermissionDenied

        # We update detectors individually to ensure post_save signals are called
        with transaction.atomic(router.db_for_write(Detector)):
            for detector in queryset:
                detector.update(enabled=enabled)

        return self.paginate(
            request=request,
            queryset=queryset,
            paginator_cls=OffsetPaginator,
            on_results=lambda x: serialize(x, request.user),
            order_by=["id"],
        )

    @extend_schema(
        operation_id="Delete an Organization's Detectors",
        parameters=[
            GlobalParams.ORG_ID_OR_SLUG,
            OrganizationParams.PROJECT,
            DetectorParams.QUERY,
            DetectorParams.SORT,
            DetectorParams.ID,
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
    def delete(self, request: Request, organization: Organization) -> Response:
        """
        Delete an Organization's Detectors
        """
        if not request.user.is_authenticated:
            return self.respond(status=status.HTTP_401_UNAUTHORIZED)

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

        queryset = self.filter_detectors(request, organization)

        # If explicitly filtering by IDs and some were not found, return 400
        if request.GET.getlist("id") and len(queryset) != len(set(request.GET.getlist("id"))):
            return Response(
                {
                    "detail": "Some detectors were not found or you do not have permission to delete them."
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        if not queryset:
            return Response(
                {"detail": "No detectors found."},
                status=status.HTTP_200_OK,
            )

        # Check if the user has edit permissions for all detectors
        if not can_delete_detectors(queryset, request):
            raise PermissionDenied

        for detector in queryset:
            with transaction.atomic(router.db_for_write(Detector)):
                RegionScheduledDeletion.schedule(detector, days=0, actor=request.user)
                create_audit_entry(
                    request=request,
                    organization=organization,
                    target_object=detector.id,
                    event=audit_log.get_event_id("DETECTOR_REMOVE"),
                    data=detector.get_audit_log_data(),
                )
                detector.update(status=ObjectStatus.PENDING_DELETION)

        return Response(status=status.HTTP_204_NO_CONTENT)
