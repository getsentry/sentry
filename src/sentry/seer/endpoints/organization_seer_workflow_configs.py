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
from sentry.models.organization import Organization
from sentry.seer.models.workflow import (
    SEER_CONFIGURABLE_WORKFLOW_STRATEGIES,
    SeerWorkflowConfig,
    SeerWorkflowConfigProject,
)
from sentry.seer.workflows.workflow import SeerWorkflow


class SeerWorkflowFiltersResponse(TypedDict):
    allProjects: bool
    environments: list[str]


class SeerWorkflowConfigResponse(TypedDict):
    id: str
    strategy: str
    enabled: bool
    schedule: str
    version: int
    filters: SeerWorkflowFiltersResponse
    projectIds: list[str]
    outputPolicy: dict[str, Any]
    seededDefault: str | None
    dateAdded: datetime
    dateUpdated: datetime


@cell_silo_endpoint
@extend_schema(tags=["Seer"])
class OrganizationSeerWorkflowConfigsEndpoint(OrganizationEndpoint):
    owner = ApiOwner.ML_AI
    publish_status = {"GET": ApiPublishStatus.PRIVATE}
    permission_classes = (OrganizationPermission,)

    @extend_schema(
        operation_id="List Seer workflow configurations",
        parameters=[GlobalParams.ORG_ID_OR_SLUG, CursorQueryParam],
        responses={200: list[SeerWorkflowConfigResponse]},
    )
    def get(self, request: Request, organization: Organization) -> Response:
        """List non-legacy configurations, seeding missing defaults on first access.

        ``projectIds`` resolves the scope to active projects accessible to the caller.
        ``filters.allProjects`` distinguishes all projects from an empty selection;
        an empty ``filters.environments`` means all environments. ``seededDefault``
        identifies defaults, including defaults whose configuration has been changed.
        ``outputPolicy`` is the saved, opaque policy document.
        """
        if not features.has("organizations:seer-automations", organization, actor=request.user):
            raise NotFound

        projects = self.get_projects(request, organization, include_all_accessible=True)
        SeerWorkflow.ensure_defaults(organization.id)
        configs = SeerWorkflowConfig.objects.filter(
            organization=organization, strategy__in=SEER_CONFIGURABLE_WORKFLOW_STRATEGIES
        )
        return self.paginate(
            request=request,
            queryset=configs,
            order_by="id",
            paginator_cls=OffsetPaginator,
            on_results=partial(
                serialize_workflow_configs, accessible_project_ids=sorted(p.id for p in projects)
            ),
        )


def serialize_workflow_configs(
    configs: Sequence[SeerWorkflowConfig], *, accessible_project_ids: Sequence[int]
) -> list[SeerWorkflowConfigResponse]:
    selected_projects: dict[int, list[str]] = defaultdict(list)
    links = SeerWorkflowConfigProject.objects.filter(
        config__in=configs, project_id__in=accessible_project_ids
    ).order_by("project_id")
    for config_id, project_id in links.values_list("config_id", "project_id"):
        selected_projects[config_id].append(str(project_id))

    results: list[SeerWorkflowConfigResponse] = []
    for config in configs:
        workflow = SeerWorkflow(config)
        filters = workflow.filters
        results.append(
            {
                "id": str(config.id),
                "strategy": config.strategy,
                "enabled": config.enabled,
                "schedule": config.schedule,
                "version": config.version,
                "filters": convert_dict_key_case(
                    config.filters | filters.dict(), snake_to_camel_case
                ),
                "projectIds": (
                    [str(p) for p in accessible_project_ids]
                    if filters.all_projects
                    else selected_projects[config.id]
                ),
                "outputPolicy": config.output_policy,
                "seededDefault": workflow.extras.seeded_default,
                "dateAdded": config.date_added,
                "dateUpdated": config.date_updated,
            }
        )
    return results
