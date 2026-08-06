from __future__ import annotations

from dataclasses import dataclass, field

from rest_framework.exceptions import NotFound
from rest_framework.request import Request
from rest_framework.response import Response

from sentry import features
from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import cell_silo_endpoint
from sentry.api.bases.organization import OrganizationEndpoint, OrganizationPermission
from sentry.models.group import Group
from sentry.models.organization import Organization
from sentry.seer.models.run import (
    SeerRun,
    SeerRunMilestone,
    SeerRunMilestoneExtras,
    SeerRunMilestoneType,
)

# The autofix pipeline in order. A run is grouped under its furthest-reached
# milestone; the frontend owns section labels, ordering, and layout.
_PIPELINE: tuple[str, ...] = (
    SeerRunMilestoneType.ROOT_CAUSE,
    SeerRunMilestoneType.SOLUTION,
    SeerRunMilestoneType.CODE_CHANGES,
    SeerRunMilestoneType.HAS_PULL_REQUEST,
    SeerRunMilestoneType.PULL_REQUESTS_MERGED,
)


@dataclass
class _RunMilestones:
    seer_run: SeerRun
    group_id: int
    extras_by_milestone: dict[str, SeerRunMilestoneExtras] = field(default_factory=dict)

    @property
    def furthest_milestone(self) -> str:
        for milestone in reversed(_PIPELINE):
            if milestone in self.extras_by_milestone:
                return milestone
        raise ValueError("run reached no milestones")

    @property
    def root_cause_artifact(self) -> dict | None:
        extras = self.extras_by_milestone.get(SeerRunMilestoneType.ROOT_CAUSE, {})
        return extras.get("root_cause_artifact")

    @property
    def solution_artifact(self) -> dict | None:
        extras = self.extras_by_milestone.get(SeerRunMilestoneType.SOLUTION, {})
        return extras.get("solution_artifact")


def _serialize_run(group: Group, run: _RunMilestones) -> dict:
    result = {
        "groupId": str(group.id),
        "shortId": group.qualified_short_id,
        "title": group.title,
        "rootCause": None,
        "proposedFix": None,
        "seerRunId": str(run.seer_run.uuid),
        "lastTriggeredAt": run.seer_run.last_triggered_at,
    }

    root_cause_artifact = run.root_cause_artifact
    if root_cause_artifact:
        result["rootCause"] = {
            "oneLineDescription": root_cause_artifact.get("one_line_description")
        }

    solution_artifact = run.solution_artifact
    if solution_artifact:
        result["proposedFix"] = {"oneLineSummary": solution_artifact.get("one_line_summary")}

    return result


class OrganizationSeerAutofixOverviewPermission(OrganizationPermission):
    scope_map = {"GET": ["org:read"]}


@cell_silo_endpoint
class OrganizationSeerAutofixOverviewEndpoint(OrganizationEndpoint):
    publish_status = {"GET": ApiPublishStatus.PRIVATE}
    owner = ApiOwner.ML_AI
    permission_classes = (OrganizationSeerAutofixOverviewPermission,)

    def get(self, request: Request, organization: Organization) -> Response:
        if not features.has("organizations:seer-night-shift-ui", organization):
            raise NotFound

        projects = self.get_projects(request, organization, include_all_accessible=True)
        latest_run_per_group = self._latest_run_per_group(organization, [p.id for p in projects])

        groups = (
            Group.objects.filter(id__in=list(latest_run_per_group))
            .select_related("project")
            .in_bulk()
        )

        runs_by_milestone: dict[str, list[dict]] = {milestone: [] for milestone in _PIPELINE}
        for group_id, run in latest_run_per_group.items():
            group = groups.get(group_id)
            if group is None:
                continue
            runs_by_milestone[run.furthest_milestone].append(_serialize_run(group, run))

        return Response({"runsByMilestone": runs_by_milestone})

    def _latest_run_per_group(
        self, organization: Organization, project_ids: list[int]
    ) -> dict[int, _RunMilestones]:
        milestone_rows = (
            SeerRunMilestone.objects.filter(
                seer_run__organization=organization,
                seer_run__agent__source="autofix",
                seer_run__agent__group_id__isnull=False,
                seer_run__agent__project_id__in=project_ids,
            )
            .select_related("seer_run", "seer_run__agent")
            .order_by("-seer_run__last_triggered_at")
        )

        runs_by_id: dict[int, _RunMilestones] = {}
        for row in milestone_rows:
            if row.seer_run_id not in runs_by_id:
                runs_by_id[row.seer_run_id] = _RunMilestones(
                    seer_run=row.seer_run,
                    group_id=row.seer_run.agent.group_id,
                )
            runs_by_id[row.seer_run_id].extras_by_milestone[row.milestone] = row.extras

        # Rows are ordered by last_triggered_at desc, so the first run seen for a
        # group is its latest; keep that one and drop the group's older runs.
        latest_per_group: dict[int, _RunMilestones] = {}
        for run in runs_by_id.values():
            if run.group_id not in latest_per_group:
                latest_per_group[run.group_id] = run
        return latest_per_group
