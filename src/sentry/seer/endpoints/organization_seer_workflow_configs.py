from collections import defaultdict
from collections.abc import Sequence
from datetime import datetime
from functools import partial
from typing import Any, TypedDict

from drf_spectacular.utils import extend_schema
from rest_framework.exceptions import NotFound
from rest_framework.request import Request
from rest_framework.response import Response

from sentry import features
from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import cell_silo_endpoint
from sentry.api.bases.organization import OrganizationEndpoint, OrganizationPermission
from sentry.api.paginator import OffsetPaginator
from sentry.api.serializers.rest_framework.base import convert_dict_key_case, snake_to_camel_case
from sentry.apidocs.parameters import CursorQueryParam, GlobalParams
from sentry.constants import ALL_ACCESS_PROJECT_ID
from sentry.models.organization import Organization
from sentry.seer.models.workflow import (
    SEER_CONFIGURABLE_WORKFLOW_STRATEGIES,
    SeerWorkflowConfig,
    SeerWorkflowConfigProject,
    SeerWorkflowRun,
    SeerWorkflowTriggerBinding,
)
from sentry.seer.workflows.workflow import SeerWorkflow
from sentry.workflow_engine.models import DataConditionGroupAction


class SeerWorkflowTriggerResponse(TypedDict):
    actionId: str
    workflowId: str | None
    workflowName: str | None


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
    lastRun: datetime | None
    lastRunStatus: str | None
    triggers: list[SeerWorkflowTriggerResponse]
    dateAdded: datetime
    dateUpdated: datetime


class SeerWorkflowConfigsResponse(TypedDict):
    configs: list[SeerWorkflowConfigResponse]


@cell_silo_endpoint
@extend_schema(tags=["Seer"])
class OrganizationSeerWorkflowConfigsEndpoint(OrganizationEndpoint):
    owner = ApiOwner.ML_AI
    publish_status = {"GET": ApiPublishStatus.PRIVATE}
    permission_classes = (OrganizationPermission,)

    @extend_schema(
        operation_id="List Seer automation workflows",
        parameters=[GlobalParams.ORG_ID_OR_SLUG, CursorQueryParam],
        responses={200: SeerWorkflowConfigsResponse},
    )
    def get(self, request: Request, organization: Organization) -> Response:
        """List saved Seer automation workflows.

        The ``configs`` list contains the current page; pagination links are in headers.
        ``projects`` is ``[-1]`` for all projects, ``[]`` for no projects, or a list
        of selected active project IDs accessible to the caller. An empty
        ``environments`` list means all environments; otherwise it contains names.
        ``filters`` contains strategy-specific filters. ``seededDefault`` records
        the seeded strategy even after edits.
        ``outputPolicy`` is the saved, opaque policy document.
        ``lastRun`` and ``lastRunStatus`` describe the most recent run, or are null if the
        workflow has never run. ``triggers`` lists the alert actions that start the
        workflow; an empty list means it only runs on its schedule.
        """
        if not features.has("organizations:seer-automations", organization, actor=request.user):
            raise NotFound

        projects = self.get_projects(request, organization, include_all_accessible=True)
        configs = SeerWorkflowConfig.objects.filter(
            organization=organization, strategy__in=SEER_CONFIGURABLE_WORKFLOW_STRATEGIES
        )
        return self.paginate(
            request=request,
            queryset=configs,
            order_by="id",
            paginator_cls=OffsetPaginator,
            on_results=partial(
                serialize_workflow_configs, accessible_project_ids=[p.id for p in projects]
            ),
        )


@cell_silo_endpoint
@extend_schema(tags=["Seer"])
class OrganizationSeerWorkflowConfigDetailsEndpoint(OrganizationEndpoint):
    owner = ApiOwner.ML_AI
    publish_status = {"GET": ApiPublishStatus.PRIVATE}
    permission_classes = (OrganizationPermission,)

    @extend_schema(
        operation_id="Retrieve a Seer automation workflow",
        parameters=[GlobalParams.ORG_ID_OR_SLUG],
        responses={200: SeerWorkflowConfigResponse},
    )
    def get(self, request: Request, organization: Organization, config_id: str) -> Response:
        """Retrieve a saved Seer automation workflow by ID.

        The response has the same shape as an item in the list endpoint's ``configs``.
        """
        if not features.has("organizations:seer-automations", organization, actor=request.user):
            raise NotFound

        try:
            config = SeerWorkflowConfig.objects.get(
                id=int(config_id),
                organization=organization,
                strategy__in=SEER_CONFIGURABLE_WORKFLOW_STRATEGIES,
            )
        except (ValueError, SeerWorkflowConfig.DoesNotExist) as e:
            raise NotFound from e

        projects = self.get_projects(request, organization, include_all_accessible=True)
        return Response(
            serialize_workflow_configs([config], accessible_project_ids=[p.id for p in projects])[
                "configs"
            ][0]
        )


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


def get_last_runs(configs: Sequence[SeerWorkflowConfig]) -> dict[int, SeerWorkflowRun]:
    runs = (
        SeerWorkflowRun.objects.filter(workflow_config__in=configs)
        .order_by("workflow_config_id", "-date_added", "-id")
        .distinct("workflow_config_id")
    )
    return {run.workflow_config_id: run for run in runs if run.workflow_config_id is not None}


def get_triggers(
    configs: Sequence[SeerWorkflowConfig],
) -> defaultdict[int, list[SeerWorkflowTriggerResponse]]:
    bindings = list(
        SeerWorkflowTriggerBinding.objects.filter(workflow_config__in=configs)
        .order_by("trigger_action_id")
        .values_list("workflow_config_id", "trigger_action_id")
    )
    # The alert workflow whose action starts the automation, limited to the configs' orgs.
    workflows_by_action: dict[int, tuple[int, str]] = {}
    for action_id, workflow_id, workflow_name in (
        DataConditionGroupAction.objects.filter(
            action_id__in=[action_id for _, action_id in bindings],
            condition_group__workflowdataconditiongroup__workflow__organization_id__in={
                config.organization_id for config in configs
            },
        )
        .order_by("id")
        .values_list(
            "action_id",
            "condition_group__workflowdataconditiongroup__workflow_id",
            "condition_group__workflowdataconditiongroup__workflow__name",
        )
    ):
        workflows_by_action.setdefault(action_id, (workflow_id, workflow_name))

    triggers: defaultdict[int, list[SeerWorkflowTriggerResponse]] = defaultdict(list)
    for config_id, action_id in bindings:
        workflow = workflows_by_action.get(action_id)
        triggers[config_id].append(
            {
                "actionId": str(action_id),
                "workflowId": str(workflow[0]) if workflow else None,
                "workflowName": workflow[1] if workflow else None,
            }
        )
    return triggers


def serialize_workflow_config(
    config: SeerWorkflowConfig,
    *,
    selected_project_ids: list[int],
    last_run: SeerWorkflowRun | None,
    triggers: list[SeerWorkflowTriggerResponse],
) -> SeerWorkflowConfigResponse:
    workflow = SeerWorkflow(config)
    filters = workflow.filters
    return {
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
        "lastRun": last_run.date_added if last_run else None,
        "lastRunStatus": last_run.status if last_run else None,
        "triggers": triggers,
        "dateAdded": config.date_added,
        "dateUpdated": config.date_updated,
    }


def serialize_workflow_configs(
    configs: Sequence[SeerWorkflowConfig], *, accessible_project_ids: Sequence[int]
) -> SeerWorkflowConfigsResponse:
    selected_projects = get_selected_project_ids(
        configs, accessible_project_ids=accessible_project_ids
    )
    last_runs = get_last_runs(configs)
    triggers = get_triggers(configs)
    return {
        "configs": [
            serialize_workflow_config(
                config,
                selected_project_ids=selected_projects[config.id],
                last_run=last_runs.get(config.id),
                triggers=triggers[config.id],
            )
            for config in configs
        ]
    }
