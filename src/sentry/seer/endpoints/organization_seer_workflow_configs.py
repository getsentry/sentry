import logging
from collections import defaultdict
from collections.abc import Collection, Sequence
from dataclasses import dataclass
from datetime import datetime
from functools import partial
from typing import Any, Literal, NotRequired, TypedDict

from django.db.models import OuterRef, Subquery
from drf_spectacular.utils import OpenApiParameter, extend_schema
from rest_framework import serializers
from rest_framework.exceptions import NotFound, PermissionDenied, ValidationError
from rest_framework.request import Request
from rest_framework.response import Response
from sentry_conventions.attributes import ATTRIBUTE_NAMES

from sentry import audit_log, features, roles
from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import cell_silo_endpoint
from sentry.api.bases.organization import OrganizationEndpoint, OrganizationPermission
from sentry.api.paginator import OffsetPaginator
from sentry.api.serializers.rest_framework.base import convert_dict_key_case, snake_to_camel_case
from sentry.api.utils import to_valid_int_id, to_valid_int_id_list
from sentry.apidocs.parameters import CursorQueryParam, GlobalParams
from sentry.apidocs.utils import inline_sentry_response_serializer
from sentry.auth.principal import acting_user_id
from sentry.cadence.api import ScheduledTriggerType, get_schedules
from sentry.constants import ALL_ACCESS_PROJECT_ID, ALL_ACCESS_PROJECTS
from sentry.models.organization import Organization
from sentry.ratelimits.config import RateLimitConfig
from sentry.seer.models.workflow import (
    SEER_CONFIGURABLE_WORKFLOW_STRATEGIES,
    SeerWorkflowConfig,
    SeerWorkflowConfigExtras,
    SeerWorkflowConfigProject,
    SeerWorkflowFilters,
    SeerWorkflowRun,
    SeerWorkflowSchedule,
    SeerWorkflowStrategy,
)
from sentry.seer.workflows.breached_metrics import (
    BreachedMetricConfigUpdate,
    BreachedMetricWorkflow,
    ConnectedMonitor,
    get_config_monitors_bulk,
    get_monitor_project_ids,
)
from sentry.seer.workflows.registry import get_seer_workflow
from sentry.seer.workflows.workflow import (
    AllProjects,
    SeerServiceAccountGrant,
    SeerWorkflow,
    SelectedProjects,
    WorkflowUpdateError,
)
from sentry.service_accounts.models import (
    GRANTABLE_SCOPES,
    ServiceAccountProjectReplica,
    ServiceAccountReplica,
)
from sentry.service_accounts.services.service_account import RpcServiceAccount
from sentry.types.ratelimit import RateLimit, RateLimitCategory

logger = logging.getLogger(__name__)

type ServiceAccountAuditEvent = Literal["SERVICE_ACCOUNT_ADD", "SERVICE_ACCOUNT_REMOVE"]


class SeerServiceAccountResponse(TypedDict):
    serviceAccountId: str
    scopes: list[str]
    projectIds: list[int]
    allProjects: bool


class SeerWorkflowConfigResponse(TypedDict):
    id: str
    strategy: str
    enabled: bool
    schedule: str
    version: int
    projects: list[int]
    monitorIds: list[int]
    serviceAccount: SeerServiceAccountResponse | None
    environments: list[str]
    filters: dict[str, Any]
    outputPolicy: dict[str, Any]
    seededDefault: str | None
    # When the automation next runs on its schedule, or None if it doesn't run on one.
    nextRunAt: datetime | None
    dateAdded: datetime
    dateUpdated: datetime
    dateLastRun: NotRequired[datetime]
    lastRunStatus: NotRequired[str | None]
    name: NotRequired[str]
    createdBy: NotRequired[str]
    updatedBy: NotRequired[str]


class SeerWorkflowConfigsResponse(TypedDict):
    configs: list[SeerWorkflowConfigResponse]


class WorkflowConfigListErrorResponse(TypedDict):
    detail: dict[str, str]


class SeerWorkflowConfigPermission(OrganizationPermission):
    # POST and PUT are further limited to the projects the caller can access; DELETE
    # requires global access.
    scope_map = {
        "GET": ["org:read", "org:write", "org:admin", "seer:read"],
        "POST": ["org:write", "org:admin", "seer:write"],
        "PUT": ["org:write", "org:admin", "seer:write"],
        "DELETE": ["org:write", "org:admin", "seer:write"],
    }


class ServiceAccountGrantSerializer(serializers.Serializer):
    scopes = serializers.ListField(
        child=serializers.ChoiceField(choices=sorted(GRANTABLE_SCOPES)), allow_empty=False
    )
    projectIds = serializers.ListField(
        child=serializers.IntegerField(min_value=1), default=list, allow_empty=True
    )
    allProjects = serializers.BooleanField(default=False)

    def validate(self, data: dict[str, Any]) -> SeerServiceAccountGrant:
        if data["allProjects"] and data["projectIds"]:
            raise serializers.ValidationError(
                {
                    "projectIds": "A service account with access to all projects can't also list projects."
                }
            )
        return SeerServiceAccountGrant(
            scopes=sorted(set(data["scopes"])),
            project_ids=sorted(set(data["projectIds"])),
            all_projects=data["allProjects"],
        )


class WorkflowConfigCreateSerializer(serializers.Serializer):
    strategy = serializers.ChoiceField(
        choices=sorted(s.value for s in SEER_CONFIGURABLE_WORKFLOW_STRATEGIES)
    )
    enabled = serializers.BooleanField(default=False)
    schedule = serializers.ChoiceField(choices=SeerWorkflowSchedule.choices, required=False)
    environments = serializers.ListField(
        child=serializers.CharField(max_length=64), default=list, allow_empty=True
    )
    # [-1] selects all projects; omitted means no projects.
    projectIds = serializers.ListField(
        child=serializers.IntegerField(min_value=ALL_ACCESS_PROJECT_ID),
        required=False,
        allow_empty=True,
    )
    name = serializers.CharField(default=None, allow_null=True, max_length=64)
    serviceAccount = ServiceAccountGrantSerializer()
    # Metric automations only; their projects come from the connected monitors.
    monitorIds = serializers.ListField(
        child=serializers.IntegerField(min_value=1),
        required=False,
        allow_empty=True,
    )

    def validate_projectIds(self, value: list[int]) -> list[int]:
        if ALL_ACCESS_PROJECT_ID in value and value != [ALL_ACCESS_PROJECT_ID]:
            raise serializers.ValidationError("[-1] cannot be combined with project IDs.")
        return value

    def validate(self, data: dict[str, Any]) -> dict[str, Any]:
        if data["strategy"] == SeerWorkflowStrategy.BREACHED_METRIC_INVESTIGATION:
            if "projectIds" in data:
                raise serializers.ValidationError(
                    {
                        "projectIds": "Metric automation projects are selected by connecting monitors."
                    }
                )
            if "schedule" in data:
                raise serializers.ValidationError(
                    {
                        "schedule": "Metric automations run when a monitor breaches, not on a schedule."
                    }
                )
        elif "monitorIds" in data:
            raise serializers.ValidationError(
                {"monitorIds": "Only metric automations support monitor selection."}
            )
        return data


class WorkflowConfigUpdateSerializer(serializers.Serializer):
    enabled = serializers.BooleanField(required=False)
    projectIds = serializers.ListField(
        child=serializers.IntegerField(min_value=ALL_ACCESS_PROJECT_ID),
        required=False,
        allow_empty=True,
    )

    monitorIds = serializers.ListField(
        child=serializers.IntegerField(min_value=1),
        required=False,
        allow_empty=True,
    )

    def validate_projectIds(self, value: list[int]) -> list[int]:
        if ALL_ACCESS_PROJECT_ID in value and value != [ALL_ACCESS_PROJECT_ID]:
            raise serializers.ValidationError("[-1] cannot be combined with project IDs.")
        return value

    def validate(self, data: dict[str, Any]) -> dict[str, Any]:
        if not data:
            raise serializers.ValidationError("Send projectIds, monitorIds, or enabled.")
        if "projectIds" in data and "monitorIds" in data:
            raise serializers.ValidationError("Send at most one of projectIds or monitorIds.")
        return data


@dataclass(frozen=True)
class WorkflowConfigLastRun:
    config_id: int
    last_run_at: datetime | None
    last_run_status: str | None


def _check_project_access(
    project_ids: Sequence[int],
    *,
    request: Request,
    organization: Organization,
    endpoint: OrganizationEndpoint,
) -> str | None:
    """
    Check the caller can read every project in a list. Returns a user-facing denial
    detail, or None when access is allowed.

    - Every explicit project in ``projectIds`` must be active in the organization,
      and the caller must have read access to it.
    - Requesting all projects with ``[-1]`` requires global access.
    """
    if set(project_ids) == ALL_ACCESS_PROJECTS:
        if not request.access.has_global_access:
            return "Requesting all projects requires global access"
    elif project_ids:
        # Raises PermissionDenied unless every project is active and accessible.
        requested = endpoint.get_projects(request, organization, project_ids=set(project_ids))
        for project in requested:
            if not request.access.has_project_scope(project, "project:read"):
                # TODO(aliu): unreachable unless the endpoint permission class is looser
                return f"You do not have access to project {project.id}"

    return None


def _with_no_access_project_ids(
    project_ids: Sequence[int],
    curr_project_ids: Sequence[int],
    *,
    request: Request,
    organization: Organization,
    endpoint: OrganizationEndpoint,
) -> list[int]:
    """
    Return the requested projects plus the current ones the caller can't read, so a
    replace keeps projects outside the caller's access. Inputs must be pre-validated
    as active projects in the organization.
    """
    if not curr_project_ids:
        return sorted(set(project_ids))
    readable = {
        project.id
        for project in endpoint.get_projects(request, organization, include_all_accessible=True)
        if request.access.has_project_scope(project, "project:read")
    }
    return sorted(set(project_ids) | (set(curr_project_ids) - readable))


def _with_no_access_monitor_ids(
    monitor_ids: Sequence[int],
    curr_monitors: Sequence[ConnectedMonitor],
    *,
    request: Request,
    organization: Organization,
    endpoint: OrganizationEndpoint,
) -> list[int]:
    """
    Return the requested monitors plus the current ones in projects the caller can't
    read. ``curr_monitors`` are the active monitors currently connected.
    """
    if not curr_monitors:
        return sorted(set(monitor_ids))
    readable = {
        project.id
        for project in endpoint.get_projects(request, organization, include_all_accessible=True)
        if request.access.has_project_scope(project, "project:read")
    }
    return sorted(
        set(monitor_ids) | {m.monitor_id for m in curr_monitors if m.project_id not in readable}
    )


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
        ``name`` is the user-supplied name, omitted if unset.
        ``createdBy`` is the ID of the user who created the config, omitted if unset.
        ``updatedBy`` is the ID of the user who last changed it, omitted if unset.
        ``nextRunAt`` is when the automation next runs on its schedule, or null if it
        isn't scheduled to run.
        ``dateLastRun`` is the latest visible run's creation time and ``lastRunStatus``
        is its status (null for older runs that predate status tracking). Both are
        omitted if no runs are visible under the runs endpoint's project-scope rules.
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

        ``strategy`` and ``serviceAccount`` are required. ``enabled`` defaults to false,
        ``schedule`` to daily, and ``environments`` to all. ``name`` is optional. Omitting
        ``projectIds`` selects no projects. Use ``[-1]`` for all projects.

        Metric automations (``breached_metric_investigation``) take ``monitorIds``
        instead of ``projectIds``; their projects come from the connected monitors, and
        the caller needs read access to each monitor's project.

        ``serviceAccount`` sets the scopes and projects investigations run with, on a
        service account created for the automation.

        The number of automations per organization is capped, and creation is rate
        limited. Failures past request validation, such as reaching the cap, return an
        empty 400. Returns the new config in the same shape as an item in ``configs``.
        """
        if not features.has("organizations:seer-automations", organization, actor=request.user):
            raise NotFound

        serializer = WorkflowConfigCreateSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=400)
        data = serializer.validated_data
        strategy = SeerWorkflowStrategy(data["strategy"])

        project_ids: list[int] = data.get("projectIds") or []
        monitor_ids: list[int] = data.get("monitorIds") or []
        if strategy == SeerWorkflowStrategy.BREACHED_METRIC_INVESTIGATION:
            denied = _check_project_access(
                get_monitor_project_ids(monitor_ids, organization),
                request=request,
                organization=organization,
                endpoint=self,
            )
        else:
            denied = _check_project_access(
                project_ids, request=request, organization=organization, endpoint=self
            )
        if denied is not None:
            raise PermissionDenied(detail=denied)

        grant: SeerServiceAccountGrant = data["serviceAccount"]
        check_can_grant_service_account(grant, request, organization, self)
        extras = SeerWorkflowConfigExtras(
            name=data.get("name"),
            created_by=acting_user_id(request.user),
        )
        try:
            workflow: SeerWorkflow
            if strategy == SeerWorkflowStrategy.BREACHED_METRIC_INVESTIGATION:
                workflow = BreachedMetricWorkflow.create_with_monitors(
                    organization.id,
                    enabled=data["enabled"],
                    environments=data["environments"],
                    monitor_ids=monitor_ids,
                    extras=extras,
                    service_account_grant=grant,
                )
            else:
                workflow = SeerWorkflow.create(
                    organization_id=organization.id,
                    strategy=strategy,
                    enabled=data["enabled"],
                    schedule=SeerWorkflowSchedule(data.get("schedule", SeerWorkflowSchedule.DAILY)),
                    environments=data["environments"],
                    project_ids=project_ids,
                    extras=extras,
                    service_account_grant=grant,
                )
        except ValueError as e:
            logger.exception("bad request", extra={ATTRIBUTE_NAMES.HTTP_RESPONSE_STATUS_CODE: 400})
            if isinstance(e, WorkflowUpdateError):
                return Response({"detail": str(e)}, status=400)
            return Response(status=400)

        account = workflow.get_service_account()
        if account is not None:
            audit_service_account(self, request, organization, account, "SERVICE_ACCOUNT_ADD")

        projects = self.get_projects(request, organization, include_all_accessible=True)
        result = serialize_workflow_configs(
            [workflow.get_config()],
            accessible_project_ids=[p.id for p in projects],
            has_global_access=request.access.has_global_access,
            accounts=[account] if account else (),
        )
        return Response(result["configs"][0], status=201)


@cell_silo_endpoint
@extend_schema(tags=["Seer"])
class OrganizationSeerWorkflowConfigDetailsEndpoint(OrganizationEndpoint):
    owner = ApiOwner.ML_AI
    publish_status = {
        "GET": ApiPublishStatus.PRIVATE,
        "PUT": ApiPublishStatus.PRIVATE,
        "DELETE": ApiPublishStatus.PRIVATE,
    }
    permission_classes = (SeerWorkflowConfigPermission,)

    def serialize(
        self, request: Request, organization: Organization, config: SeerWorkflowConfig
    ) -> SeerWorkflowConfigResponse:
        projects = self.get_projects(request, organization, include_all_accessible=True)
        return serialize_workflow_configs(
            [config],
            accessible_project_ids=[p.id for p in projects],
            has_global_access=request.access.has_global_access,
        )["configs"][0]

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

        try:
            config = SeerWorkflowConfig.objects.get(
                id=to_valid_int_id("config_id", config_id),
                organization=organization,
                strategy__in=SEER_CONFIGURABLE_WORKFLOW_STRATEGIES,
            )
        except (ValueError, SeerWorkflowConfig.DoesNotExist) as e:
            raise NotFound from e

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
        caller can access; selected projects the caller can't access are kept.

        - The same project-access rules apply here AND to the associated projects of ``monitorIds``.
        - Changing the projects of a config that covers all projects requires global
          access.
        - ``monitorIds`` replaces the monitors of a metric automation and is rejected
          for other strategies.
        - Enabling or pausing requires access to every project the config covers.

        Failures past request validation return an empty 400. Returns the updated config
        in the same shape as an item in the list endpoint's ``configs``.
        """
        if not features.has("organizations:seer-automations", organization, actor=request.user):
            raise NotFound

        serializer = WorkflowConfigUpdateSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=400)

        try:
            config = SeerWorkflowConfig.objects.get(
                id=to_valid_int_id("config_id", config_id),
                organization=organization,
                strategy__in=SEER_CONFIGURABLE_WORKFLOW_STRATEGIES,
            )
        except (ValueError, SeerWorkflowConfig.DoesNotExist) as e:
            raise NotFound from e
        workflow = get_seer_workflow(config)

        enabled: bool | None = serializer.validated_data.get("enabled")
        project_ids: list[int] | None = serializer.validated_data.get("projectIds")
        monitor_ids: list[int] | None = serializer.validated_data.get("monitorIds")

        # Checks that depend only on the request run before taking the lock.
        if monitor_ids is not None and not isinstance(workflow, BreachedMetricWorkflow):
            return Response(
                {"detail": "Only metric automations support monitor selection."}, status=400
            )

        if project_ids or monitor_ids:
            request_project_ids = (
                get_monitor_project_ids(monitor_ids, organization) if monitor_ids else project_ids
            )
            assert request_project_ids is not None
            denied = _check_project_access(
                request_project_ids,
                request=request,
                organization=organization,
                endpoint=self,
            )
            if denied is not None:
                raise PermissionDenied(detail=denied)

        # Updates are done in one txn. Error cases must raise instead of early return,
        # so the transaction can rollback.
        try:
            with workflow.update_config() as update:
                all_projects = project_ids == [ALL_ACCESS_PROJECT_ID]
                config_all_projects = SeerWorkflowFilters.parse_obj(
                    update.config.filters
                ).all_projects

                if enabled is not None:
                    denied = _check_project_access(
                        (
                            [ALL_ACCESS_PROJECT_ID]
                            if config_all_projects
                            else workflow.get_project_ids()
                        ),
                        request=request,
                        organization=organization,
                        endpoint=self,
                    )
                    if denied is not None:
                        raise PermissionDenied(detail=denied)

                    update.set_enabled(enabled)

                if project_ids is not None:
                    # Narrowing an all-projects config drops future projects the caller may
                    # not see, so it needs the same global access as selecting all projects.
                    if (
                        not all_projects
                        and config_all_projects
                        and not request.access.has_global_access
                    ):
                        raise PermissionDenied(
                            detail=(
                                "You do not have permission to narrow this config's project scope"
                            )
                        )

                    if all_projects:
                        update.set_project_selection(AllProjects())
                    else:
                        # Replace only what the caller can see; keep current projects they can't.
                        update.set_project_selection(
                            SelectedProjects(
                                project_ids=tuple(
                                    _with_no_access_project_ids(
                                        project_ids,
                                        workflow.get_project_ids(),
                                        request=request,
                                        organization=organization,
                                        endpoint=self,
                                    )
                                )
                            )
                        )

                if monitor_ids is not None:
                    assert isinstance(workflow, BreachedMetricWorkflow)
                    assert isinstance(update, BreachedMetricConfigUpdate)
                    # Replace only what the caller can see; keep monitors in projects they can't.
                    update.set_monitor_selection(
                        _with_no_access_monitor_ids(
                            monitor_ids,
                            workflow.get_monitors(),
                            request=request,
                            organization=organization,
                            endpoint=self,
                        )
                    )

                if update.changed:
                    user_id = acting_user_id(request.user)
                    extras = SeerWorkflowConfigExtras.parse_obj(update.config.extras)
                    extras.updated_by = "bot" if user_id is None else user_id
                    update.set_extras(extras)

        except ValueError as e:
            logger.exception("bad request", extra={ATTRIBUTE_NAMES.HTTP_RESPONSE_STATUS_CODE: 400})
            if isinstance(e, WorkflowUpdateError):
                return Response({"detail": str(e)}, status=400)
            return Response(status=400)

        config = workflow.get_config()
        return Response(self.serialize(request, organization, config))

    @extend_schema(
        operation_id="Delete a Seer automation workflow",
        parameters=[GlobalParams.ORG_ID_OR_SLUG],
        responses={204: None},
    )
    def delete(self, request: Request, organization: Organization, config_id: str) -> Response:
        """Delete a saved Seer automation workflow.

        Requires global access. The config's runs and service account are deleted too.
        """
        if not features.has("organizations:seer-automations", organization, actor=request.user):
            raise NotFound

        if not request.access.has_global_access:
            raise PermissionDenied(detail="Deleting an automation requires global access")

        try:
            config = SeerWorkflowConfig.objects.get(
                id=to_valid_int_id("config_id", config_id),
                organization=organization,
                strategy__in=SEER_CONFIGURABLE_WORKFLOW_STRATEGIES,
            )
        except (ValueError, SeerWorkflowConfig.DoesNotExist) as e:
            raise NotFound from e

        workflow = get_seer_workflow(config)
        account = workflow.get_service_account()
        workflow.delete()
        if account is not None:
            audit_service_account(self, request, organization, account, "SERVICE_ACCOUNT_REMOVE")
        return Response(status=204)


def serialize_workflow_configs(
    configs: Sequence[SeerWorkflowConfig],
    *,
    accessible_project_ids: Sequence[int],
    has_global_access: bool,
    accounts: Sequence[RpcServiceAccount] = (),
) -> SeerWorkflowConfigsResponse:
    """``accounts`` override the cell replicas, which may lag a write in this request."""
    accessible = set(accessible_project_ids)
    service_accounts = get_config_service_accounts(configs, accessible_project_ids=accessible) | {
        account.id: SeerServiceAccountResponse(
            serviceAccountId=str(account.id),
            scopes=sorted(account.scope_list),
            projectIds=[
                project_id for project_id in account.project_ids if project_id in accessible
            ],
            allProjects=account.all_projects,
        )
        for account in accounts
    }
    monitor_configs = [
        config
        for config in configs
        if config.strategy == SeerWorkflowStrategy.BREACHED_METRIC_INVESTIGATION
    ]
    project_configs = [
        config
        for config in configs
        if config.strategy != SeerWorkflowStrategy.BREACHED_METRIC_INVESTIGATION
    ]
    selected_projects = get_config_projects_bulk(
        project_configs, accessible_project_ids=accessible_project_ids
    )
    connected_monitors = get_config_monitors_bulk(
        monitor_configs, project_filter=accessible_project_ids
    )
    last_runs = get_config_last_runs(
        configs,
        accessible_project_ids=accessible_project_ids,
        has_global_access=has_global_access,
    )
    last_runs_by_config_id = {run.config_id: run for run in last_runs}
    next_run_times = get_next_run_times(configs)
    return {
        "configs": [
            serialize_workflow_config(
                config,
                selected_project_ids=(
                    []
                    if config.strategy == SeerWorkflowStrategy.BREACHED_METRIC_INVESTIGATION
                    else selected_projects[config.id]
                ),
                connected_monitors=(
                    connected_monitors.get(config.id, [])
                    if config.strategy == SeerWorkflowStrategy.BREACHED_METRIC_INVESTIGATION
                    else []
                ),
                last_run=last_runs_by_config_id.get(config.id),
                service_account=(
                    service_accounts.get(config.service_account_id)
                    if config.service_account_id
                    else None
                ),
                next_run_at=next_run_times.get(config.id),
            )
            for config in configs
        ]
    }


def get_config_projects_bulk(
    configs: Sequence[SeerWorkflowConfig], *, accessible_project_ids: Sequence[int]
) -> defaultdict[int, list[int]]:
    """
    Return each config's selected project IDs from its project links. Only valid for
    project-based automations; monitor-based automations derive projects from their
    connected monitors and have no project links.
    """
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
    latest_run = runs.order_by("-date_added", "-id")
    last_runs = (
        SeerWorkflowConfig.objects.filter(id__in=[config.id for config in configs])
        .annotate(
            last_run_at=Subquery(latest_run.values("date_added")[:1]),
            last_run_status=Subquery(latest_run.values("status")[:1]),
        )
        .values_list("id", "last_run_at", "last_run_status")
    )
    return [
        WorkflowConfigLastRun(
            config_id=config_id, last_run_at=last_run_at, last_run_status=last_run_status
        )
        for config_id, last_run_at, last_run_status in last_runs
    ]


def get_next_run_times(configs: Sequence[SeerWorkflowConfig]) -> dict[int, datetime | None]:
    """When each config next runs on its schedule, keyed by config id."""
    by_organization: defaultdict[int, list[int]] = defaultdict(list)
    for config in configs:
        by_organization[config.organization_id].append(config.id)
    return {
        config_id: info.next_fire_at
        for organization_id, config_ids in by_organization.items()
        for config_id, info in get_schedules(
            organization_id=organization_id,
            trigger_type=ScheduledTriggerType.SEER_WORKFLOW,
            target_ids=config_ids,
        ).items()
    }


def serialize_workflow_config(
    config: SeerWorkflowConfig,
    *,
    selected_project_ids: list[int],
    connected_monitors: list[ConnectedMonitor],
    last_run: WorkflowConfigLastRun | None,
    service_account: SeerServiceAccountResponse | None,
    next_run_at: datetime | None,
) -> SeerWorkflowConfigResponse:
    """
    ``selected_project_ids`` is ignored for monitor-based automations, whose projects come
    from ``connected_monitors``. ``connected_monitors`` is ignored for project-based
    automations.
    """
    filters = SeerWorkflowFilters.parse_obj(config.filters)
    monitor_ids = [m.monitor_id for m in connected_monitors]
    if config.strategy == SeerWorkflowStrategy.BREACHED_METRIC_INVESTIGATION:
        # Metric automation projects come from their connected monitors.
        project_ids = sorted({m.project_id for m in connected_monitors})
    elif filters.all_projects:
        project_ids = [ALL_ACCESS_PROJECT_ID]
    else:
        project_ids = selected_project_ids
    result: SeerWorkflowConfigResponse = {
        "id": str(config.id),
        "strategy": config.strategy,
        "enabled": config.enabled,
        "schedule": config.schedule,
        "version": config.version,
        "projects": project_ids,
        "monitorIds": monitor_ids,
        "serviceAccount": service_account,
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
        "seededDefault": SeerWorkflowConfigExtras.parse_obj(config.extras).seeded_default,
        "nextRunAt": next_run_at,
        "dateAdded": config.date_added,
        "dateUpdated": config.date_updated,
    }
    if last_run is not None and last_run.last_run_at is not None:
        result["dateLastRun"] = last_run.last_run_at
        result["lastRunStatus"] = last_run.last_run_status
    extras = SeerWorkflowConfigExtras.parse_obj(config.extras)
    if extras.name is not None:
        result["name"] = extras.name
    if extras.created_by is not None:
        result["createdBy"] = str(extras.created_by)
    if extras.updated_by is not None:
        result["updatedBy"] = str(extras.updated_by)
    return result


def get_config_service_accounts(
    configs: Sequence[SeerWorkflowConfig], *, accessible_project_ids: Collection[int]
) -> dict[int, SeerServiceAccountResponse]:
    account_ids = {config.service_account_id for config in configs if config.service_account_id}
    if not account_ids:
        return {}
    project_ids: defaultdict[int, list[int]] = defaultdict(list)
    for account_id, project_id in ServiceAccountProjectReplica.objects.filter(
        service_account__service_account_id__in=account_ids,
        project_id__in=accessible_project_ids,
    ).values_list("service_account__service_account_id", "project_id"):
        project_ids[account_id].append(project_id)
    return {
        replica.service_account_id: {
            "serviceAccountId": str(replica.service_account_id),
            "scopes": sorted(replica.scope_list),
            "projectIds": sorted(project_ids[replica.service_account_id]),
            "allProjects": replica.all_projects,
        }
        for replica in ServiceAccountReplica.objects.filter(
            service_account_id__in=account_ids,
            organization_id__in={config.organization_id for config in configs},
        )
    }


def check_can_grant_service_account(
    grant: SeerServiceAccountGrant,
    request: Request,
    organization: Organization,
    endpoint: OrganizationEndpoint,
) -> None:
    if not features.has("organizations:service-accounts", organization, actor=request.user):
        raise NotFound
    # No service_account:write check: the automation owns the account, and requiring it
    # would stop Members from creating automations.
    if set(grant.scopes) - request.access.scopes:
        raise PermissionDenied("You can't give a service account scopes you don't have.")
    if grant.all_projects:
        _require_global_role(
            request,
            "Only a role with access to all projects can give a service account all projects.",
        )
    else:
        denied = _check_project_access(
            grant.project_ids, request=request, organization=organization, endpoint=endpoint
        )
        if denied is not None:
            raise PermissionDenied(denied)


def _require_global_role(request: Request, detail: str) -> None:
    role = request.access.role
    if role is None or not roles.get(role).is_global:
        raise PermissionDenied(detail)


def audit_service_account(
    endpoint: OrganizationEndpoint,
    request: Request,
    organization: Organization,
    account: RpcServiceAccount,
    event: ServiceAccountAuditEvent,
) -> None:
    endpoint.create_audit_entry(
        request,
        organization=organization,
        target_object=account.id,
        event=audit_log.get_event_id(event),
        data={
            "name": account.name,
            "scopes": sorted(account.scope_list),
            "project_ids": [str(project_id) for project_id in account.project_ids],
            "all_projects": account.all_projects,
            "is_active": account.is_active,
        },
    )
