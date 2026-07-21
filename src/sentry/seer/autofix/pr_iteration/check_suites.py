"""Shared helpers for reacting to GitHub ``check_suite`` webhooks on Seer PRs.

Both the PR-iteration feedback path (CI failed -> iterate) and the
review-request path (CI green -> ask a human to review) consume the same
events and need the same repository/run resolution, head matching, and
check-run sweeping. This module keeps that logic independent of the feedback
machinery in ``feedback_sources/check_suite.py``.
"""

from __future__ import annotations

import logging
from collections.abc import Mapping, Sequence
from dataclasses import dataclass
from typing import NamedTuple

import sentry_sdk
from pydantic import BaseModel, Field
from scm import actions as scm_actions
from scm.helpers import iter_all_pages
from scm.manager import SourceCodeManager
from scm.types import ListCheckRunsForRefProtocol

from sentry.constants import ObjectStatus
from sentry.integrations.services.integration import integration_service
from sentry.integrations.types import IntegrationProviderSlug
from sentry.models.repository import Repository
from sentry.seer.agent.client_models import SeerRunState
from sentry.seer.agent.client_utils import get_agent_state_from_pr_id
from sentry.seer.models import SeerApiError

logger = logging.getLogger(__name__)

SEER_GITHUB_PROVIDER = "integrations:github"

# Suite/run conclusions we treat as a failure. Values match scm BuildConclusion
# after GitHub normalization (startup_failure -> failure).
FAILURE_CONCLUSIONS = ("failure", "timed_out", "action_required")


class GithubCheckSuiteApp(BaseModel):
    name: str

    class Config:
        extra = "allow"


class GithubCheckSuitePullRequest(BaseModel):
    id: int

    class Config:
        extra = "allow"


class GithubCheckSuite(BaseModel):
    id: int
    head_sha: str
    check_runs_url: str
    app: GithubCheckSuiteApp
    conclusion: str | None = None
    # GitHub bumps this on Actions re-runs while keeping the same suite id.
    # Optional so legacy serialized feedback (pre-updated_at) still parses.
    updated_at: str | None = None
    pull_requests: list[GithubCheckSuitePullRequest] = Field(default_factory=list)

    class Config:
        extra = "allow"


class GithubCheckSuiteRepository(BaseModel):
    html_url: str
    id: int | None = None
    full_name: str | None = None

    class Config:
        extra = "allow"


class GithubCheckSuiteInstallation(BaseModel):
    id: int

    class Config:
        extra = "allow"


class GithubCheckSuiteEvent(BaseModel):
    check_suite: GithubCheckSuite
    repository: GithubCheckSuiteRepository
    installation: GithubCheckSuiteInstallation | None = None

    class Config:
        extra = "allow"


def get_check_suite_url(event: GithubCheckSuiteEvent) -> str:
    return (
        f"{event.repository.html_url}/commit/{event.check_suite.head_sha}/checks"
        f"?check_suite_id={event.check_suite.id}"
    )


def resolve_check_suite_repositories(event: GithubCheckSuiteEvent) -> list[Repository]:
    """All Sentry repos matching this GitHub check-suite installation + external id.

    A single GitHub App installation can be linked to multiple Sentry orgs, each
    with its own ``Repository`` row. Callers that need an org-scoped Seer run
    should try each candidate rather than assuming ``.first()`` is correct.
    """
    installation_id = event.installation.id if event.installation else None
    repository_id = event.repository.id
    if installation_id is None or repository_id is None:
        logger.info(
            "autofix.pr_iteration.check_suite.repository.missing_ids",
            extra={"installation_id": installation_id, "repository_id": repository_id},
        )
        return []

    contexts = integration_service.organization_contexts(
        provider=IntegrationProviderSlug.GITHUB.value,
        external_id=str(installation_id),
    )
    if contexts.integration is None or not contexts.organization_integrations:
        logger.info(
            "autofix.pr_iteration.check_suite.repository.missing_integration",
            extra={
                "installation_id": installation_id,
                "repository_id": repository_id,
                "has_integration": contexts.integration is not None,
                "organization_integration_count": len(contexts.organization_integrations),
            },
        )
        return []

    organization_ids = [oi.organization_id for oi in contexts.organization_integrations]
    repos = list(
        Repository.objects.filter(
            organization_id__in=organization_ids,
            provider=SEER_GITHUB_PROVIDER,
            external_id=str(repository_id),
        ).exclude(status=ObjectStatus.HIDDEN)
    )
    logger.info(
        "autofix.pr_iteration.check_suite.repository.resolved",
        extra={
            "installation_id": installation_id,
            "repository_id": repository_id,
            "organization_ids": organization_ids,
            "repo_ids": [repo.id for repo in repos],
            "repo_organization_ids": [repo.organization_id for repo in repos],
        },
    )
    return repos


@dataclass(frozen=True)
class CheckSuiteAutofixRun:
    """The Autofix run tied to a check-suite PR, plus the Sentry repo used to find it."""

    repository: Repository
    run_state: SeerRunState
    pr_id: int
    group_id: int


def resolve_check_suite_autofix_run(
    event: GithubCheckSuiteEvent, repositories: Sequence[Repository] | None = None
) -> CheckSuiteAutofixRun | None:
    """Find the Autofix run for this check suite's PR(s).

    Assumes one Autofix run <-> PR in Sentry. Tries each PR x candidate org until
    Seer returns a run with ``repo_pr_states`` and a ``group_id``; if several
    match, logs a warning and returns the first. Callers that already resolved
    (or filtered) the candidate repos can pass ``repositories`` to restrict the
    search.
    """
    repos = (
        list(repositories) if repositories is not None else resolve_check_suite_repositories(event)
    )
    if not repos:
        return None

    pull_requests = event.check_suite.pull_requests
    if not pull_requests:
        return None

    matches: list[CheckSuiteAutofixRun] = []
    for pr_id in (pr.id for pr in pull_requests):
        for candidate in repos:
            try:
                state = get_agent_state_from_pr_id(
                    candidate.organization_id, SEER_GITHUB_PROVIDER, pr_id
                )
            except SeerApiError as e:
                sentry_sdk.capture_exception(e)
                continue

            if state is None or not state.repo_pr_states:
                continue

            group_id = state.metadata.get("group_id") if state.metadata else None
            if not group_id:
                logger.warning(
                    "autofix.pr_iteration.check_suite.missing_group_id",
                    extra={
                        "organization_id": candidate.organization_id,
                        "pr_id": pr_id,
                        "run_id": state.run_id,
                    },
                )
                continue

            matches.append(
                CheckSuiteAutofixRun(
                    repository=candidate,
                    run_state=state,
                    pr_id=pr_id,
                    group_id=group_id,
                )
            )

    if not matches:
        return None

    if len(matches) > 1:
        logger.warning(
            "autofix.pr_iteration.check_suite.multiple_autofix_runs",
            extra={
                "match_count": len(matches),
                "pr_ids": [m.pr_id for m in matches],
                "run_ids": [m.run_state.run_id for m in matches],
                "organization_ids": [m.repository.organization_id for m in matches],
            },
        )

    return matches[0]


class CheckSuiteHeadMatch(NamedTuple):
    head_sha: str | None
    repo_name: str | None
    matched: bool


def check_suite_head_match(
    event: GithubCheckSuiteEvent, run_state: SeerRunState
) -> CheckSuiteHeadMatch:
    """Whether the check suite ran on the PR's *current* head commit.

    A ``check_suite`` webhook fires for any commit on the PR (including
    commits a human pushed or commits Seer made earlier in the run). We only
    act on results for the commit that is currently the PR head for this
    run: if Seer has since pushed a newer commit, the CI result is out of
    date and reacting to it would act on stale code.
    """
    head_sha = event.check_suite.head_sha
    repo_name = event.repository.full_name
    pr_state = run_state.repo_pr_states.get(repo_name) if repo_name else None
    matched = bool(head_sha and pr_state and pr_state.commit_sha == head_sha)
    return CheckSuiteHeadMatch(head_sha=head_sha, repo_name=repo_name, matched=matched)


@dataclass(frozen=True)
class CheckRunsSweep:
    """Aggregate state of every check run on a commit, across all check suites."""

    total: int
    incomplete: int
    failed: int

    @property
    def is_green(self) -> bool:
        return self.incomplete == 0 and self.failed == 0


def sweep_check_runs(
    scm: SourceCodeManager, head_sha: str, *, log_extra: Mapping[str, object]
) -> CheckRunsSweep | None:
    """Count incomplete and failed check runs for ``head_sha`` across all suites.

    Returns ``None`` when the provider doesn't support listing check runs or the
    listing fails; callers decide their own fallback.
    """
    if not isinstance(scm, ListCheckRunsForRefProtocol):
        logger.warning(
            "autofix.pr_iteration.check_runs_sweep.unsupported_provider", extra=dict(log_extra)
        )
        return None

    total = incomplete = failed = 0
    try:
        for page in iter_all_pages(
            lambda pagination: scm_actions.list_check_runs_for_ref(
                scm, head_sha, pagination=pagination
            )
        ):
            total += len(page["data"])
            incomplete += sum(1 for run in page["data"] if run["status"] != "completed")
            failed += sum(1 for run in page["data"] if run.get("conclusion") in FAILURE_CONCLUSIONS)
    except Exception:
        logger.warning(
            "autofix.pr_iteration.check_runs_sweep.list_check_runs_failed",
            extra={**log_extra, "head_sha": head_sha},
            exc_info=True,
        )
        return None

    sweep = CheckRunsSweep(total=total, incomplete=incomplete, failed=failed)
    logger.info(
        "autofix.pr_iteration.check_runs_sweep.swept",
        extra={
            **log_extra,
            "head_sha": head_sha,
            "check_run_count": sweep.total,
            "incomplete_count": sweep.incomplete,
            "failed_count": sweep.failed,
        },
    )
    return sweep
