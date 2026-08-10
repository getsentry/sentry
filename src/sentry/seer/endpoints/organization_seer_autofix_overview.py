from __future__ import annotations

from collections import defaultdict
from dataclasses import dataclass, field
from datetime import datetime

from rest_framework.exceptions import NotFound
from rest_framework.request import Request
from rest_framework.response import Response

from sentry import features
from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import cell_silo_endpoint
from sentry.api.bases.organization import OrganizationEndpoint, OrganizationPermission
from sentry.api.serializers import serialize
from sentry.api.serializers.models.group_stream import StreamGroupSerializerSnuba
from sentry.api.serializers.models.pullrequest import (
    PullRequestStatus,
    get_stored_pull_request_status,
)
from sentry.api.utils import get_date_range_from_stats_period
from sentry.integrations.source_code_management.pull_request_status_batch import (
    get_checks_and_review,
)
from sentry.integrations.source_code_management.status_check import PullRequestStatusResult
from sentry.models.group import Group
from sentry.models.organization import Organization
from sentry.models.pullrequest import PullRequest
from sentry.models.repository import Repository
from sentry.plugins.base import bindings
from sentry.plugins.providers.integration_repository import IntegrationRepositoryProvider
from sentry.seer.models.run import (
    RootCauseArtifactExtras,
    SeerRun,
    SeerRunMilestone,
    SeerRunMilestoneExtras,
    SeerRunMilestoneType,
    SeerRunPullRequest,
    SolutionArtifactExtras,
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

_MAX_RUNS_PER_MILESTONE = 100


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
    def root_cause_artifact(self) -> RootCauseArtifactExtras | None:
        extras = self.extras_by_milestone.get(SeerRunMilestoneType.ROOT_CAUSE, {})
        return extras.get("root_cause_artifact")

    @property
    def solution_artifact(self) -> SolutionArtifactExtras | None:
        extras = self.extras_by_milestone.get(SeerRunMilestoneType.SOLUTION, {})
        return extras.get("solution_artifact")


def _pull_requests_by_run_pk(run_pks: list[int]) -> dict[int, list[dict]]:
    by_run: dict[int, list[dict]] = defaultdict(list)
    links = list(
        SeerRunPullRequest.objects.filter(seer_run_id__in=run_pks)
        .select_related("pull_request")
        .order_by("date_added")
    )
    if not links:
        return by_run

    repos_by_id = Repository.objects.in_bulk({link.pull_request.repository_id for link in links})
    registry = bindings.get("integration-repository.provider")
    providers: dict[str, IntegrationRepositoryProvider] = {}

    def _external_url(pr: PullRequest) -> str | None:
        repo = repos_by_id.get(pr.repository_id)
        if repo is None:
            return None
        provider_id = repo.provider
        if not provider_id or not provider_id.startswith("integrations:"):
            return None
        provider = providers.get(provider_id)
        if provider is None:
            provider = providers[provider_id] = registry.get(provider_id)(provider_id)
        return provider.pull_request_url(repo, pr)

    pull_requests = [link.pull_request for link in links]
    status_by_pr_id: dict[int, PullRequestStatus | None] = {
        pr.id: get_stored_pull_request_status(pr) for pr in pull_requests
    }
    # TODO: this hits the provider (GitHub GraphQL) on every page load. If latency
    # bites, gate it behind an `expand=checksAndReview` param like the issues endpoint.
    checks_and_review_by_pr_id = get_checks_and_review(pull_requests, repos_by_id, status_by_pr_id)

    for link in links:
        pr = link.pull_request
        try:
            number = int(pr.key)
        except (TypeError, ValueError):
            continue
        checks_and_review = checks_and_review_by_pr_id.get(pr.id, PullRequestStatusResult())
        by_run[link.seer_run_id].append(
            {
                "number": number,
                "url": _external_url(pr),
                "status": status_by_pr_id[pr.id],
                "checksStatus": (
                    checks_and_review.checks.value if checks_and_review.checks else None
                ),
                "reviewStatus": (
                    checks_and_review.review.value if checks_and_review.review else None
                ),
                "files": [
                    {
                        "path": file.path,
                        "additions": file.additions,
                        "deletions": file.deletions,
                        "changeType": file.change_type,
                    }
                    for file in checks_and_review.files
                ],
            }
        )
    return by_run


def _serialize_issue(group: Group, serialized_group: dict) -> dict:
    return {
        "count": serialized_group.get("count"),
        "userCount": serialized_group.get("userCount"),
        "lastSeen": serialized_group.get("lastSeen"),
        "level": serialized_group.get("level"),
        "substatus": serialized_group.get("substatus"),
        "priority": serialized_group.get("priority"),
        "priorityLockedAt": serialized_group.get("priorityLockedAt"),
        "issueType": serialized_group.get("issueType"),
        "issueCategory": serialized_group.get("issueCategory"),
        "assignedTo": serialized_group.get("assignedTo"),
        "owners": serialized_group.get("owners") or [],
        "project": {
            "id": str(group.project_id),
            "slug": group.project.slug,
            "platform": group.project.platform,
        },
    }


def _serialize_run(
    group: Group, run: _RunMilestones, serialized_group: dict, pull_requests: list[dict]
) -> dict:
    result = {
        "groupId": str(group.id),
        "shortId": group.qualified_short_id,
        "title": group.title,
        "rootCause": None,
        "proposedFix": None,
        "seerRunId": str(run.seer_run.uuid),
        "lastTriggeredAt": run.seer_run.last_triggered_at,
        "pullRequests": pull_requests,
        "issue": _serialize_issue(group, serialized_group),
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
        project_ids = [p.id for p in projects]

        start, end = get_date_range_from_stats_period(request.GET)
        latest_run_per_group = self._latest_run_per_group(organization, project_ids, start, end)

        # Classify into sections and cap before the expensive serialize, so the
        # Snuba/Postgres work is bounded by the cap rather than the org's history.
        runs_by_section: dict[str, list[tuple[int, _RunMilestones]]] = {
            milestone: [] for milestone in _PIPELINE
        }
        for group_id, run in latest_run_per_group.items():
            runs_by_section[run.furthest_milestone].append((group_id, run))
        for pairs in runs_by_section.values():
            del pairs[_MAX_RUNS_PER_MILESTONE:]

        capped = [pair for pairs in runs_by_section.values() for pair in pairs]
        groups = (
            Group.objects.filter(id__in=[group_id for group_id, _ in capped])
            .select_related("project")
            .in_bulk()
        )

        environments = self.get_environments(request, organization)
        serialized_by_id = {
            sg["id"]: sg
            for sg in serialize(
                list(groups.values()),
                request.user,
                StreamGroupSerializerSnuba(
                    environment_ids=[e.id for e in environments],
                    start=start,
                    end=end,
                    expand=["owners"],
                    collapse=["lifetime", "filtered", "unhandled"],
                    organization_id=organization.id,
                    project_ids=project_ids,
                ),
                request=request,
            )
        }

        pull_requests_by_run_pk = _pull_requests_by_run_pk([run.seer_run.id for _, run in capped])

        runs_by_milestone: dict[str, list[dict]] = {milestone: [] for milestone in _PIPELINE}
        for milestone, pairs in runs_by_section.items():
            for group_id, run in pairs:
                group = groups.get(group_id)
                if group is None:
                    continue
                runs_by_milestone[milestone].append(
                    _serialize_run(
                        group,
                        run,
                        serialized_by_id[str(group_id)],
                        pull_requests_by_run_pk.get(run.seer_run.id, []),
                    )
                )

        return Response({"runsByMilestone": runs_by_milestone})

    def _latest_run_per_group(
        self,
        organization: Organization,
        project_ids: list[int],
        start: datetime,
        end: datetime,
    ) -> dict[int, _RunMilestones]:
        milestone_rows = (
            SeerRunMilestone.objects.filter(
                seer_run__organization=organization,
                seer_run__agent__source="autofix",
                seer_run__agent__group_id__isnull=False,
                seer_run__agent__project_id__in=project_ids,
                seer_run__last_triggered_at__range=(start, end),
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
