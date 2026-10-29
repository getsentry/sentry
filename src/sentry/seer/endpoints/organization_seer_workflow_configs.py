from collections import defaultdict
from collections.abc import Sequence
from dataclasses import dataclass
from datetime import datetime
from functools import partial
from typing import Any, NotRequired, TypedDict

from django.db.models import OuterRef, Subquery
from drf_spectacular.utils import OpenApiParameter, extend_schema
from rest_framework import serializers
from rest_framework.exceptions import NotFound, PermissionDenied, ValidationError
from rest_framework.request import Request
from rest_framework.response import Response

from sentry import features
from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import cell_silo_endpoint
from sentry.api.bases.organization import OrganizationEndpoint, OrganizationPermission
from sentry.api.paginator import OffsetPaginator
from sentry.api.serializers.rest_framework.base import convert_dict_key_case, snake_to_camel_case
from sentry.api.utils import to_valid_int_id_list
from sentry.apidocs.parameters import CursorQueryParam, GlobalParams
from sentry.apidocs.utils import inline_sentry_response_serializer
from sentry.constants import ALL_ACCESS_PROJECT_ID
from sentry.models.organization import Organization
from sentry.ratelimits.config import RateLimitConfig
from sentry.seer.models.workflow import (
    SEER_CONFIGURABLE_WORKFLOW_STRATEGIES,
    SeerWorkflowConfig,
    SeerWorkflowConfigProject,
    SeerWorkflowRun,
    SeerWorkflowSchedule,
    SeerWorkflowStrategy,
)
from sentry.seer.workflows.workflow import SeerWorkflow
from sentry.types.ratelimit import RateLimit, RateLimitCategory


class SeerWorkflowConfigResponse(TypedDict):
    id: str
    strategy: str
    enabled: bool
    schedule: str
    version: int
    projects: list[int]
    environments: list[str]
    filters: dict[str, Any]
    outputPolicy: dict[str, Any]
    seededDefault: str | None
    dateAdded: datetime
    dateUpdated: datetime
    dateLastRun: NotRequired[datetime]


class SeerWorkflowConfigsResponse(TypedDict):
    configs: list[SeerWorkflowConfigResponse]


class WorkflowConfigListErrorResponse(TypedDict):
    detail: dict[str, str]


class SeerWorkflowConfigPermission(OrganizationPermission):
    # POST and PUT are further limited to the projects the caller can access.
    scope_map = {
        "GET": ["org:read", "org:write", "org:admin"],
        "POST": ["project:read", "project:write", "project:admin"],
        "PUT": ["project:read", "project:write", "project:admin"],
    }


class WorkflowConfigCreateSerializer(serializers.Serializer):
    strategy = serializers.ChoiceField(
        choices=sorted(s.value for s in SEER_CONFIGURABLE_WORKFLOW_STRATEGIES)
    )
    enabled = serializers.BooleanField(default=False)
    schedule = serializers.ChoiceField(
        choices=SeerWorkflowSchedule.choices, default=SeerWorkflowSchedule.DAILY
    )
    environments = serializers.ListField(
        child=serializers.CharField(max_length=64), default=list, allow_empty=True
    )
    # [-1] selects all projects. Omitted means no projects, or all for breached metrics.
    projectIds = serializers.ListField(
        child=serializers.IntegerField(min_value=ALL_ACCESS_PROJECT_ID),
        required=False,
        allow_empty=True,
    )

    def validate_projectIds(self, value: list[int]) -> list[int]:
        if ALL_ACCESS_PROJECT_ID in value and value != [ALL_ACCESS_PROJECT_ID]:
            raise serializers.ValidationError("[-1] cannot be combined with project IDs.")
        if 0 in value:
            raise serializers.ValidationError("Project IDs must be positive.")
        return value


class WorkflowConfigUpdateSerializer(serializers.Serializer):
    projectIds = serializers.ListField(
        child=serializers.IntegerField(min_value=1), required=False, allow_empty=True
    )


@dataclass(frozen=True)
class WorkflowConfigLastRun:
    config_id: int
    last_run_at: datetime | None


@cell_silo_endpoint
@extend_schema(tags=["Seer"])
class OrganizationSeerWorkflowConfigsEndpoint(OrganizationEndpoint):
    owner = ApiOwner.ML_AI
    publish_status = {"GET": ApiPublishStatus.PRIVATE, "POST": ApiPublishStatus.PRIVATE}
    permission_classes = (SeerWorkflowConfigPermission,)
    enforce_rate_limit = True
    rate_limits = RateLimitConfig(
        limit_overrides={
            "POST": {
                RateLimitCategory.USER: RateLimit(limit=5, window=60),
                RateLimitCategory.ORGANIZATION: RateLimit(limit=20, window=60 * 60),
            },
        }
    )

    @extend_schema(
        operation_id="List Seer automation workflows",
        parameters=[
            GlobalParams.ORG_ID_OR_SLUG,
            CursorQueryParam,
            OpenApiParameter(
                name="id",
                type=int,
                location=OpenApiParameter.QUERY,
                many=True,
                explode=True,
                description="Filter by config IDs. Repeat the parameter for multiple IDs.",
            ),
        ],
        responses={
            200: inline_sentry_response_serializer(
                "SeerWorkflowConfigs", SeerWorkflowConfigsResponse
            ),
            400: inline_sentry_response_serializer(
                "SeerWorkflowConfigListError", WorkflowConfigListErrorResponse
            ),
        },
    )
    def get(self, request: Request, organization: Organization) -> Response:
        """List saved Seer automation workflows.

        The ``configs`` list contains the current page; pagination links are in headers.
        Filter by config IDs with ``?id=123&id=456``; omit ``id`` to list all configs.
        Invalid IDs return 400; no visible matches return ``{"configs": []}``.
        ``projects`` is ``[-1]`` for all projects, ``[]`` for no projects, or a list
        of selected active project IDs accessible to the caller. An empty
        ``environments`` list means all environments; otherwise it contains names.
        ``filters`` contains strategy-specific filters. ``seededDefault`` records
        the seeded strategy even after edits.
        ``outputPolicy`` is the saved, opaque policy document.
        ``dateLastRun`` is the latest visible run's creation time,
        omitted if none are visible under the runs endpoint's project-scope rules.
        """
        if not features.has("organizations:seer-automations", organization, actor=request.user):
            raise NotFound

        try:
            config_ids = to_valid_int_id_list("id", request.query_params.getlist("id"))
        except ValidationError as error:
            return Response({"detail": error.detail}, status=400)

        projects = self.get_projects(request, organization, include_all_accessible=True)
        configs = SeerWorkflowConfig.objects.filter(
            organization=organization, strategy__in=SEER_CONFIGURABLE_WORKFLOW_STRATEGIES
        )
        if config_ids:
            configs = configs.filter(id__in=config_ids)
        return self.paginate(
            request=request,
            queryset=configs,
            order_by="id",
            paginator_cls=OffsetPaginator,
            on_results=partial(
                serialize_workflow_configs,
                accessible_project_ids=[p.id for p in projects],
                has_global_access=request.access.has_global_access,
            ),
        )

    @extend_schema(
        operation_id="Create a Seer automation workflow",
        parameters=[GlobalParams.ORG_ID_OR_SLUG],
        request=WorkflowConfigCreateSerializer,
        responses={
            201: inline_sentry_response_serializer(
                "SeerWorkflowConfig", SeerWorkflowConfigResponse
            ),
        },
    )
    def post(self, request: Request, organization: Organization) -> Response:
        """Create a Seer automation workflow.

        ``projectIds`` of ``[-1]`` selects all projects and requires ``org:write``.
        Otherwise every project must be active and accessible to the caller. Omitting
        ``projectIds`` selects no projects, except for breached metric automations,
        which always cover all projects. Returns the new config in the same shape as
        an item in ``configs``.
        """
        if not features.has("organizations:seer-automations", organization, actor=request.user):
            raise NotFound

        serializer = WorkflowConfigCreateSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=400)
        data = serializer.validated_data
        strategy = SeerWorkflowStrategy(data["strategy"])

        project_ids: list[int] | None = data.get("projectIds")
        if project_ids is None:
            if strategy == SeerWorkflowStrategy.BREACHED_METRIC_INVESTIGATION:
                project_ids = [ALL_ACCESS_PROJECT_ID]
            else:
                project_ids = []
        all_projects = project_ids == [ALL_ACCESS_PROJECT_ID]
        if all_projects:
            if not (request.access.has_scope("org:write") or request.access.has_scope("org:admin")):
                raise PermissionDenied
        elif project_ids:
            # Raises PermissionDenied unless every project is active and accessible.
            requested = self.get_projects(request, organization, project_ids=set(project_ids))
            if not all(
                request.access.has_project_scope(project, "project:read") for project in requested
            ):
                raise PermissionDenied

        try:
            workflow = SeerWorkflow.create(
                organization.id,
                strategy=strategy,
                enabled=data["enabled"],
                schedule=SeerWorkflowSchedule(data["schedule"]),
                environments=data["environments"],
                project_ids=None if all_projects else project_ids,
            )
        except ValueError:
            return Response({"detail": "Invalid workflow configuration."}, status=400)

        projects = self.get_projects(request, organization, include_all_accessible=True)
        result = serialize_workflow_configs(
            [workflow.config],
            accessible_project_ids=[p.id for p in projects],
            has_global_access=request.access.has_global_access,
        )
        return Response(result["configs"][0], status=201)


@cell_silo_endpoint
@extend_schema(tags=["Seer"])
class OrganizationSeerWorkflowConfigDetailsEndpoint(OrganizationEndpoint):
    owner = ApiOwner.ML_AI
    publish_status = {"GET": ApiPublishStatus.PRIVATE, "PUT": ApiPublishStatus.PRIVATE}
    permission_classes = (SeerWorkflowConfigPermission,)

    @extend_schema(
        operation_id="Retrieve a Seer automation workflow",
        parameters=[GlobalParams.ORG_ID_OR_SLUG],
        responses={
            200: inline_sentry_response_serializer(
                "SeerWorkflowConfig", SeerWorkflowConfigResponse
            ),
        },
    )
    def get(self, request: Request, organization: Organization, config_id: str) -> Response:
        """Retrieve a saved Seer automation workflow by ID.

        The response has the same shape as an item in the list endpoint's ``configs``.
        """
        if not features.has("organizations:seer-automations", organization, actor=request.user):
            raise NotFound

        config = get_workflow_config(organization, config_id)
        return Response(self.serialize(request, organization, config))

    @extend_schema(
        operation_id="Update a Seer automation workflow",
        parameters=[GlobalParams.ORG_ID_OR_SLUG],
        request=WorkflowConfigUpdateSerializer,
        responses={
            200: inline_sentry_response_serializer(
                "SeerWorkflowConfig", SeerWorkflowConfigResponse
            ),
        },
    )
    def put(self, request: Request, organization: Organization, config_id: str) -> Response:
        """Update a saved Seer automation workflow.

        Only the fields sent are changed. ``projectIds`` replaces the projects the
        caller can access; selected projects the caller can't access are kept. Every
        project sent must be active and accessible to the caller. Returns the updated
        config in the same shape as an item in the list endpoint's ``configs``.
        """
        if not features.has("organizations:seer-automations", organization, actor=request.user):
            raise NotFound

        serializer = WorkflowConfigUpdateSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=400)
        config = get_workflow_config(organization, config_id)

        project_ids: list[int] | None = serializer.validated_data.get("projectIds")
        if project_ids is not None:
            if project_ids:
                # Raises PermissionDenied unless every project is active and accessible.
                requested = self.get_projects(request, organization, project_ids=set(project_ids))
                if not all(
                    request.access.has_project_scope(project, "project:read")
                    for project in requested
                ):
                    raise PermissionDenied
            accessible = self.get_projects(request, organization, include_all_accessible=True)
            workflow = SeerWorkflow(config)
            try:
                workflow.replace_projects(
                    project_ids,
                    editable_project_ids=[
                        project.id
                        for project in accessible
                        if request.access.has_project_scope(project, "project:read")
                    ],
                )
            except ValueError as e:
                return Response({"detail": str(e)}, status=400)
            config = workflow.config

        return Response(self.serialize(request, organization, config))

    def serialize(
        self, request: Request, organization: Organization, config: SeerWorkflowConfig
    ) -> SeerWorkflowConfigResponse:
        projects = self.get_projects(request, organization, include_all_accessible=True)
        return serialize_workflow_configs(
            [config],
            accessible_project_ids=[p.id for p in projects],
            has_global_access=request.access.has_global_access,
        )["configs"][0]


def get_workflow_config(organization: Organization, config_id: str) -> SeerWorkflowConfig:
    try:
        return SeerWorkflowConfig.objects.get(
            id=int(config_id),
            organization=organization,
            strategy__in=SEER_CONFIGURABLE_WORKFLOW_STRATEGIES,
        )
    except (ValueError, SeerWorkflowConfig.DoesNotExist) as e:
        raise NotFound from e


def serialize_workflow_configs(
    configs: Sequence[SeerWorkflowConfig],
    *,
    accessible_project_ids: Sequence[int],
    has_global_access: bool,
) -> SeerWorkflowConfigsResponse:
    selected_projects = get_selected_project_ids(
        configs, accessible_project_ids=accessible_project_ids
    )
    last_runs = get_config_last_runs(
        configs,
        accessible_project_ids=accessible_project_ids,
        has_global_access=has_global_access,
    )
    last_run_dates_by_config_id = {run.config_id: run.last_run_at for run in last_runs}
    return {
        "configs": [
            serialize_workflow_config(
                config,
                selected_project_ids=selected_projects[config.id],
                last_run=last_run_dates_by_config_id.get(config.id),
            )
            for config in configs
        ]
    }


def get_selected_project_ids(
    configs: Sequence[SeerWorkflowConfig], *, accessible_project_ids: Sequence[int]
) -> defaultdict[int, list[int]]:
    selected_projects: defaultdict[int, list[int]] = defaultdict(list)
    links = SeerWorkflowConfigProject.objects.filter(
        config__in=configs, project_id__in=accessible_project_ids
    ).order_by("project_id")
    for config_id, project_id in links.values_list("config_id", "project_id"):
        selected_projects[config_id].append(project_id)
    return selected_projects


def get_config_last_runs(
    configs: Sequence[SeerWorkflowConfig],
    *,
    accessible_project_ids: Sequence[int],
    has_global_access: bool,
) -> list[WorkflowConfigLastRun]:
    runs = SeerWorkflowRun.objects.filter(
        workflow_config_id=OuterRef("id"), organization_id=OuterRef("organization_id")
    )
    if not has_global_access:
        runs = runs.filter(extras__snapshot__project_ids__contained_by=list(accessible_project_ids))
    last_runs = (
        SeerWorkflowConfig.objects.filter(id__in=[config.id for config in configs])
        .annotate(last_run_at=Subquery(runs.order_by("-date_added").values("date_added")[:1]))
        .values_list("id", "last_run_at")
    )
    return [
        WorkflowConfigLastRun(config_id=config_id, last_run_at=last_run_at)
        for config_id, last_run_at in last_runs
    ]


def serialize_workflow_config(
    config: SeerWorkflowConfig, *, selected_project_ids: list[int], last_run: datetime | None
) -> SeerWorkflowConfigResponse:
    workflow = SeerWorkflow(config)
    filters = workflow.filters
    result: SeerWorkflowConfigResponse = {
        "id": str(config.id),
        "strategy": config.strategy,
        "enabled": config.enabled,
        "schedule": config.schedule,
        "version": config.version,
        "projects": [ALL_ACCESS_PROJECT_ID] if filters.all_projects else selected_project_ids,
        "environments": filters.environments,
        "filters": convert_dict_key_case(
            {
                key: value
                for key, value in config.filters.items()
                if key not in {"all_projects", "environments"}
            },
            snake_to_camel_case,
        ),
        "outputPolicy": config.output_policy,
        "seededDefault": workflow.extras.seeded_default,
        "dateAdded": config.date_added,
        "dateUpdated": config.date_updated,
    }
    if last_run is not None:
        result["dateLastRun"] = last_run
    return result
