from __future__ import annotations

import logging
from collections import defaultdict
from collections.abc import Collection, Sequence
from dataclasses import dataclass, field
from datetime import datetime
from typing import NamedTuple, cast

from django.db.models import Exists, OuterRef, Q
from pydantic import ValidationError
from rest_framework.request import Request
from rest_framework.response import Response

from sentry import search
from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import cell_silo_endpoint
from sentry.api.bases.organization import OrganizationEndpoint, OrganizationPermission
from sentry.api.event_search import SearchFilter, SearchKey, SearchValue
from sentry.api.serializers import serialize
from sentry.api.serializers.models.group_stream import StreamGroupSerializerSnuba
from sentry.api.serializers.models.pullrequest import (
    PullRequestStatus,
    get_stored_pull_request_status,
)
from sentry.api.utils import get_date_range_from_stats_period
from sentry.constants import ObjectStatus
from sentry.integrations.source_code_management.pull_request_status_batch import (
    get_checks_and_review,
)
from sentry.integrations.source_code_management.status_check import PullRequestStatusResult
from sentry.models.environment import Environment
from sentry.models.group import Group
from sentry.models.organization import Organization
from sentry.models.project import Project
from sentry.models.pullrequest import PullRequest, PullRequestLifecycleState
from sentry.models.repository import Repository
from sentry.plugins.base import bindings
from sentry.plugins.providers.integration_repository import IntegrationRepositoryProvider
from sentry.seer.agent.client_models import AgentFilePatch, FilePatch
from sentry.seer.agent.client_utils import fetch_run_statuses
from sentry.seer.constants import SEER_GITHUB_SCM_PROVIDERS
from sentry.seer.endpoints.organization_seer_autofix_overview_types import (
    CodeChangeFilePayload,
    IssuePayload,
    IssueProjectPayload,
    OverviewResponse,
    ProjectConfigPayload,
    ProposedFixPayload,
    PullRequestPayload,
    RootCausePayload,
    RunPayload,
)
from sentry.seer.models.project_repository import SeerProjectRepository
from sentry.seer.models.run import (
    CodeChangesArtifactExtras,
    RootCauseArtifactExtras,
    SeerRun,
    SeerRunMilestone,
    SeerRunMilestoneExtras,
    SeerRunMilestoneType,
    SeerRunPullRequest,
    SolutionArtifactExtras,
)
from sentry.seer.seer_setup import get_supported_scm_providers

logger = logging.getLogger(__name__)

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

_HIDDEN_PULL_REQUEST_STATES = (PullRequestLifecycleState.CLOSED,)

# `.exclude(state__in=...)` drops NULL states via SQL three-valued logic; NULL means unenriched (open), so keep it.
_VISIBLE_PULL_REQUEST_FILTER = Q(pull_request__state__isnull=True) | ~Q(
    pull_request__state__in=_HIDDEN_PULL_REQUEST_STATES
)

# The three issue-based sort params, mapped to their search-backend names.
# Any other value (seer default, empty, unknown) keeps the default order.
_ISSUE_SORT_TO_SEARCH = {"issue": "date", "events": "freq", "users": "user"}


@dataclass
class _RunMilestones:
    seer_run: SeerRun
    group_id: int
    has_pull_request_link: bool = False
    has_unclosed_pull_request: bool = False
    extras_by_milestone: dict[str, SeerRunMilestoneExtras] = field(default_factory=dict)

    @property
    def has_only_closed_pull_requests(self) -> bool:
        return self.has_pull_request_link and not self.has_unclosed_pull_request

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

    @property
    def code_changes_artifact(self) -> CodeChangesArtifactExtras | None:
        extras = self.extras_by_milestone.get(SeerRunMilestoneType.CODE_CHANGES, {})
        return extras.get("code_changes_artifact")


def _serialize_pull_request(
    pull_request_id: str,
    number: int,
    url: str | None,
    status: PullRequestStatus | None,
    repo_name: str | None,
    checks_and_review: PullRequestStatusResult,
) -> PullRequestPayload:
    return {
        "id": pull_request_id,
        "number": number,
        "url": url,
        "status": status,
        "checksStatus": checks_and_review.checks.value if checks_and_review.checks else None,
        "reviewStatus": checks_and_review.review.value if checks_and_review.review else None,
        "repoName": repo_name,
        "files": [
            {
                "path": file.path,
                "additions": file.additions,
                "deletions": file.deletions,
                "changeType": file.change_type,
            }
            for file in checks_and_review.files
        ],
        "failedCheckDetails": [
            {"name": check.name, "url": check.url} for check in checks_and_review.failed_checks
        ],
    }


def _pull_requests_by_seer_run_id(
    seer_run_ids: list[int], *, include_scm_info: bool
) -> dict[int, list[PullRequestPayload]]:
    by_run: dict[int, list[PullRequestPayload]] = defaultdict(list)
    links = list(
        SeerRunPullRequest.objects.filter(seer_run_id__in=seer_run_ids)
        .filter(_VISIBLE_PULL_REQUEST_FILTER)
        .select_related("pull_request")
        .order_by("date_added")
    )
    if not links:
        return by_run

    repos_by_id = Repository.objects.filter(
        organization_id__in={link.pull_request.organization_id for link in links},
        id__in={link.pull_request.repository_id for link in links},
        status=ObjectStatus.ACTIVE,
    ).in_bulk()
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
            try:
                provider = registry.get(provider_id)(provider_id)
            except KeyError:
                # `integrations:` is a shape check, not a registry-membership one;
                # stale/unregistered providers exist in repo data.
                return None
            providers[provider_id] = provider
        return provider.pull_request_url(repo, pr)

    pull_requests = [link.pull_request for link in links]
    status_by_pr_id: dict[int, PullRequestStatus | None] = {
        pr.id: get_stored_pull_request_status(pr) for pr in pull_requests
    }
    checks_and_review_by_pr_id: dict[int, PullRequestStatusResult] = {}
    if include_scm_info:
        checks_and_review_by_pr_id = get_checks_and_review(
            pull_requests, repos_by_id, status_by_pr_id, include_files=True
        )

    for link in links:
        pr = link.pull_request
        try:
            number = int(pr.key)
        except (TypeError, ValueError):
            continue
        repo = repos_by_id.get(pr.repository_id)
        by_run[link.seer_run_id].append(
            _serialize_pull_request(
                pull_request_id=str(pr.id),
                number=number,
                url=_external_url(pr),
                status=status_by_pr_id[pr.id],
                repo_name=repo.name if repo else None,
                checks_and_review=checks_and_review_by_pr_id.get(pr.id, PullRequestStatusResult()),
            )
        )
    return by_run


class _RepoEligibility(NamedTuple):
    has_repos_connected: bool
    has_non_github_repo: bool


def _coding_agent_repo_eligibility(
    organization: Organization, project_ids: Collection[int]
) -> dict[int, _RepoEligibility]:
    github_providers = set(SEER_GITHUB_SCM_PROVIDERS)
    eligibility = {pid: _RepoEligibility(False, False) for pid in project_ids}
    rows = (
        SeerProjectRepository.objects.filter(
            project_repository__project_id__in=project_ids,
            project_repository__repository__status=ObjectStatus.ACTIVE,
            project_repository__repository__provider__in=get_supported_scm_providers(organization),
        )
        .values_list("project_repository__project_id", "project_repository__repository__provider")
        .distinct()
    )
    for project_id, provider in rows:
        prev = eligibility[project_id]
        eligibility[project_id] = _RepoEligibility(
            True, prev.has_non_github_repo or provider not in github_providers
        )
    return eligibility


def _serialize_issue(
    group: Group, serialized_group: dict, repo_eligibility: dict[int, _RepoEligibility] | None
) -> IssuePayload:
    project: IssueProjectPayload = {
        "id": str(group.project_id),
        "slug": group.project.slug,
        "platform": group.project.platform,
    }
    if repo_eligibility is not None:
        flags = repo_eligibility[group.project_id]
        project["hasReposConnected"] = flags.has_repos_connected
        project["hasNonGithubRepo"] = flags.has_non_github_repo
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
        "project": project,
    }


def _serialize_code_changes(artifact: CodeChangesArtifactExtras) -> list[CodeChangeFilePayload]:
    files: list[CodeChangeFilePayload] = []
    for patches in artifact.get("diffs_by_repo", {}).values():
        for raw in patches:
            try:
                file_patch = AgentFilePatch.parse_obj(raw)
            except ValidationError:
                logger.warning("seer.autofix_overview.invalid_code_change", exc_info=True)
                continue
            files.append(
                {
                    "repoName": file_patch.repo_name,
                    "patch": cast(FilePatch, file_patch.patch.dict()),
                }
            )
    return files


def _serialize_run(
    group: Group,
    run: _RunMilestones,
    serialized_group: dict,
    pull_requests: list[PullRequestPayload],
    status: str | None,
    repo_eligibility: dict[int, _RepoEligibility] | None,
) -> RunPayload:
    root_cause_artifact = run.root_cause_artifact
    root_cause: RootCausePayload | None = (
        {"oneLineDescription": root_cause_artifact.get("one_line_description")}
        if root_cause_artifact
        else None
    )

    solution_artifact = run.solution_artifact
    proposed_fix: ProposedFixPayload | None = (
        {"oneLineSummary": solution_artifact.get("one_line_summary")} if solution_artifact else None
    )

    code_changes: list[CodeChangeFilePayload] = []
    if run.furthest_milestone == SeerRunMilestoneType.CODE_CHANGES and run.code_changes_artifact:
        code_changes = _serialize_code_changes(run.code_changes_artifact)

    return {
        "groupId": str(group.id),
        "shortId": group.qualified_short_id,
        "title": group.title,
        "rootCause": root_cause,
        "proposedFix": proposed_fix,
        "seerRunId": str(run.seer_run.uuid),
        "lastTriggeredAt": run.seer_run.last_triggered_at,
        "pullRequests": pull_requests,
        "codeChanges": code_changes,
        "issue": _serialize_issue(group, serialized_group, repo_eligibility),
        "status": status,
    }


class OrganizationSeerAutofixOverviewPermission(OrganizationPermission):
    scope_map = {"GET": ["org:read"]}


@cell_silo_endpoint
class OrganizationSeerAutofixOverviewEndpoint(OrganizationEndpoint):
    publish_status = {"GET": ApiPublishStatus.PRIVATE}
    owner = ApiOwner.ML_AI
    permission_classes = (OrganizationSeerAutofixOverviewPermission,)

    def get(self, request: Request, organization: Organization) -> Response:
        projects = self.get_projects(request, organization)
        project_ids = [p.id for p in projects]

        start, end = get_date_range_from_stats_period(request.GET)
        expand = request.GET.getlist("expand")
        include_scm_info = "scmInfo" in expand
        include_issue_stats = "issueStats" in expand
        include_status = "status" in expand
        include_project_config = "projectConfig" in expand
        environments = self.get_environments(request, organization)

        sort = request.GET.get("sort")

        latest_run_per_group = self._latest_run_per_group(organization, project_ids, start, end)
        if sort in _ISSUE_SORT_TO_SEARCH:
            latest_run_per_group = self._reorder_by_issue_sort(
                latest_run_per_group,
                _ISSUE_SORT_TO_SEARCH[sort],
                projects,
                environments,
                start,
                end,
            )

        # Classify into milestones and cap before the expensive serialize, so the
        # Snuba/Postgres work is bounded by the cap rather than the org's history.
        capped_runs_by_milestone: dict[str, list[tuple[int, _RunMilestones]]] = {
            milestone: [] for milestone in _PIPELINE
        }
        for group_id, run in latest_run_per_group.items():
            milestone = run.furthest_milestone
            if (
                milestone == SeerRunMilestoneType.HAS_PULL_REQUEST
                and run.has_only_closed_pull_requests
            ):
                continue
            capped_runs_by_milestone[milestone].append((group_id, run))
        truncated_milestones = [
            milestone
            for milestone, pairs in capped_runs_by_milestone.items()
            if len(pairs) > _MAX_RUNS_PER_MILESTONE
        ]
        for pairs in capped_runs_by_milestone.values():
            del pairs[_MAX_RUNS_PER_MILESTONE:]

        capped = [pair for pairs in capped_runs_by_milestone.values() for pair in pairs]
        groups = (
            Group.objects.filter(id__in=[group_id for group_id, _ in capped])
            .select_related("project")
            .in_bulk()
        )

        collapse = ["lifetime", "filtered", "unhandled"]
        if not include_issue_stats:
            collapse.append("stats")
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
                    collapse=collapse,
                    organization_id=organization.id,
                    project_ids=project_ids,
                ),
                request=request,
            )
        }

        pull_requests_by_seer_run_id = _pull_requests_by_seer_run_id(
            [run.seer_run.id for _, run in capped], include_scm_info=include_scm_info
        )

        repo_eligibility_by_project: dict[int, _RepoEligibility] = {}
        if include_project_config:
            eligibility_project_ids: Collection[int] = project_ids
        elif include_scm_info:
            eligibility_project_ids = {group.project_id for group in groups.values()}
        else:
            eligibility_project_ids = ()
        if eligibility_project_ids:
            repo_eligibility_by_project = _coding_agent_repo_eligibility(
                organization, eligibility_project_ids
            )
        issue_repo_eligibility = repo_eligibility_by_project if include_scm_info else None

        project_config: list[ProjectConfigPayload] = []
        if include_project_config:
            project_config = [
                {
                    "id": str(project.id),
                    "slug": project.slug,
                    "hasReposConnected": repo_eligibility_by_project[
                        project.id
                    ].has_repos_connected,
                }
                for project in projects
            ]

        status_by_state_id: dict[int, str] = {}
        if include_status:
            state_ids = [
                run.seer_run.seer_run_state_id
                for _, run in capped
                if run.seer_run.seer_run_state_id is not None
            ]
            status_by_state_id = fetch_run_statuses(state_ids, organization)

        runs_by_milestone: dict[str, list[RunPayload]] = {milestone: [] for milestone in _PIPELINE}
        for milestone, pairs in capped_runs_by_milestone.items():
            for group_id, run in pairs:
                group = groups.get(group_id)
                if group is None:
                    continue
                runs_by_milestone[milestone].append(
                    _serialize_run(
                        group,
                        run,
                        serialized_by_id[str(group_id)],
                        pull_requests_by_seer_run_id.get(run.seer_run.id, []),
                        status_by_state_id.get(run.seer_run.seer_run_state_id),
                        issue_repo_eligibility,
                    )
                )

        response: OverviewResponse = {
            "runsByMilestone": runs_by_milestone,
            "truncatedMilestones": truncated_milestones,
        }
        if include_project_config:
            response["projectConfig"] = project_config
        return Response(response)

    def _latest_run_per_group(
        self,
        organization: Organization,
        project_ids: list[int],
        start: datetime,
        end: datetime,
    ) -> dict[int, _RunMilestones]:
        pr_links = SeerRunPullRequest.objects.filter(seer_run_id=OuterRef("seer_run_id"))
        milestone_rows = (
            # writes for autofix_rca no longer happen, we should be able to remove this from the query by 11/11/2026 latest (data retention)
            SeerRunMilestone.objects.filter(
                seer_run__organization=organization,
                seer_run__agent__source__in=("autofix", "autofix_rca"),
                seer_run__agent__group_id__isnull=False,
                seer_run__agent__project_id__in=project_ids,
                seer_run__last_triggered_at__range=(start, end),
            )
            .select_related("seer_run", "seer_run__agent")
            .annotate(
                has_pull_request_link=Exists(pr_links),
                has_unclosed_pull_request=Exists(pr_links.filter(_VISIBLE_PULL_REQUEST_FILTER)),
            )
            .order_by("-seer_run__last_triggered_at")
        )

        runs_by_id: dict[int, _RunMilestones] = {}
        for row in milestone_rows:
            if row.seer_run_id not in runs_by_id:
                runs_by_id[row.seer_run_id] = _RunMilestones(
                    seer_run=row.seer_run,
                    group_id=row.seer_run.agent.group_id,
                    has_pull_request_link=row.has_pull_request_link,
                    has_unclosed_pull_request=row.has_unclosed_pull_request,
                )
            runs_by_id[row.seer_run_id].extras_by_milestone[row.milestone] = row.extras

        # Rows are ordered by last_triggered_at desc, so the first run seen for a
        # group is its latest; keep that one and drop the group's older runs.
        latest_per_group: dict[int, _RunMilestones] = {}
        for run in runs_by_id.values():
            if run.group_id not in latest_per_group:
                latest_per_group[run.group_id] = run
        return latest_per_group

    def _reorder_by_issue_sort(
        self,
        latest_run_per_group: dict[int, _RunMilestones],
        sort_by: str,
        projects: Sequence[Project],
        environments: Sequence[Environment],
        start: datetime,
        end: datetime,
    ) -> dict[int, _RunMilestones]:
        candidate_ids = list(latest_run_per_group)
        if not candidate_ids:
            return latest_run_per_group

        results = search.backend.query(
            projects=projects,
            environments=list(environments) or None,
            sort_by=sort_by,
            limit=len(candidate_ids),
            paginator_options={"max_limit": len(candidate_ids)},
            search_filters=[SearchFilter(SearchKey("issue.id"), "IN", SearchValue(candidate_ids))],
            date_from=start,
            date_to=end,
            referrer="seer.autofix-overview",
        )

        ordered_ids = [group.id for group in results.results]
        seen = set(ordered_ids)
        # Candidates with no in-window events are absent from Snuba; keep them, sorted last.
        ordered_ids.extend(gid for gid in latest_run_per_group if gid not in seen)
        return {gid: latest_run_per_group[gid] for gid in ordered_ids}
