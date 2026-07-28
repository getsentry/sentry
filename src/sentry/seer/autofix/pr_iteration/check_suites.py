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
from typing import Any, NamedTuple

import orjson
import sentry_sdk
from pydantic import BaseModel, Field, ValidationError
from scm import actions as scm_actions
from scm.helpers import iter_all_pages
from scm.manager import SourceCodeManager
from scm.types import ActionResult, GetPullRequestProtocol, ListCheckRunsForRefProtocol, PullRequest

from sentry import features
from sentry.constants import ObjectStatus
from sentry.integrations.services.integration import integration_service
from sentry.integrations.types import IntegrationProviderSlug
from sentry.models.organization import Organization
from sentry.models.repository import Repository
from sentry.scm.types import CheckSuiteEvent
from sentry.seer.agent.client_models import SeerRunState
from sentry.seer.agent.client_utils import get_agent_state_from_pr_id
from sentry.seer.autofix.pr_iteration.constants import REVIEW_REQUEST_FLAG
from sentry.seer.autofix.pr_iteration.run_markers import get_run_marker
from sentry.seer.models import SeerApiError
from sentry.seer.models.run import SeerRun
from sentry.utils import metrics

logger = logging.getLogger(__name__)

SEER_GITHUB_PROVIDER = "integrations:github"

# SeerRun.extras keys for the green check-suite side effects (undraft +
# review-request). Owned here so bootstrap can short-circuit on DB markers
# without importing those modules (they import GreenCheckSuiteContext from us).
READY_FOR_REVIEW_EXTRA = "ready_for_review"
REVIEW_REQUESTS_EXTRA = "review_requests"

# Suite/run conclusions we treat as a failure. Values match scm BuildConclusion
# after GitHub normalization (startup_failure -> failure).
FAILURE_CONCLUSIONS = ("failure", "timed_out", "action_required")

# Suite conclusions that can complete a fully green head. The suite event is only
# the trigger — the check-runs sweep across all of the head's suites is what
# actually confirms the PR is green.
GREEN_CONCLUSIONS = ("success", "neutral", "skipped")


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
    """Whether the check suite ran on the run's last-known PR head commit.

    Used by the CI-failure iteration path, which keys off Seer's recorded
    ``repo_pr_states.commit_sha``. Prefer ``check_suite_matches_pr_head`` with
    the live PR head from SCM when the decision needs the PR's actual current
    head — run state can lag pushes.
    """
    head_sha = event.check_suite.head_sha
    repo_name = event.repository.full_name
    pr_state = run_state.repo_pr_states.get(repo_name) if repo_name else None
    matched = bool(head_sha and pr_state and pr_state.commit_sha == head_sha)
    return CheckSuiteHeadMatch(head_sha=head_sha, repo_name=repo_name, matched=matched)


def check_suite_matches_pr_head(
    event: GithubCheckSuiteEvent, *, pr_head_sha: str | None
) -> CheckSuiteHeadMatch:
    """Whether the check suite ran on ``pr_head_sha``.

    Pass the PR's live head from SCM — ``repo_pr_states.commit_sha`` can lag
    pushes and is the wrong source for "is this suite current?".
    """
    head_sha = event.check_suite.head_sha
    repo_name = event.repository.full_name
    matched = bool(head_sha and pr_head_sha and head_sha == pr_head_sha)
    return CheckSuiteHeadMatch(head_sha=head_sha, repo_name=repo_name, matched=matched)


@dataclass(frozen=True)
class ResolvedGreenCheckSuite:
    """Cheap half of green-path bootstrap: enough to read DB markers."""

    event: GithubCheckSuiteEvent
    organization: Organization
    autofix_run: CheckSuiteAutofixRun
    seer_run: SeerRun
    repo_name: str
    pr_number: int
    log_extra: dict[str, Any]


@dataclass(frozen=True)
class GreenCheckSuiteContext:
    """Confirmed-green tip after SCM live-head match + check-run sweep."""

    resolved: ResolvedGreenCheckSuite
    scm: SourceCodeManager
    pull_request: ActionResult[PullRequest]
    head_sha: str


def resolve_green_check_suite(
    check_suite_event: CheckSuiteEvent,
) -> ResolvedGreenCheckSuite | None:
    """Parse, flag-gate, and resolve the Autofix run (no SCM)."""
    try:
        raw = orjson.loads(check_suite_event.subscription_event["event"])
        event = GithubCheckSuiteEvent.parse_obj(raw)
    except (orjson.JSONDecodeError, ValidationError, TypeError, ValueError) as e:
        sentry_sdk.capture_exception(e)
        return None

    organizations: dict[int, Organization] = {}
    flagged_repos = []
    for repo in resolve_check_suite_repositories(event):
        organization = organizations.get(repo.organization_id)
        if organization is None:
            try:
                organization = Organization.objects.get_from_cache(id=repo.organization_id)
            except Organization.DoesNotExist:
                continue
            organizations[repo.organization_id] = organization
        if features.has(REVIEW_REQUEST_FLAG, organization):
            flagged_repos.append(repo)
    if not flagged_repos:
        return None

    autofix_run = resolve_check_suite_autofix_run(event, flagged_repos)
    metrics.incr(
        "autofix.pr_iteration.green_check_suite.run_resolved",
        tags={"found": str(autofix_run is not None).lower()},
    )
    if autofix_run is None:
        return None
    organization = organizations[autofix_run.repository.organization_id]

    log_extra: dict[str, Any] = {
        "organization_id": autofix_run.repository.organization_id,
        "repo_id": autofix_run.repository.id,
        "run_id": autofix_run.run_state.run_id,
        "pr_id": autofix_run.pr_id,
    }

    repo_name = event.repository.full_name
    pr_state = autofix_run.run_state.repo_pr_states.get(repo_name) if repo_name else None
    pr_number = pr_state.pr_number if pr_state else None
    if not repo_name or pr_number is None:
        _skip("no_pr_number", log_extra)
        return None

    seer_run = SeerRun.objects.filter(
        seer_run_state_id=autofix_run.run_state.run_id, organization=organization
    ).first()
    if seer_run is None:
        _skip("no_seer_run", log_extra)
        return None

    return ResolvedGreenCheckSuite(
        event=event,
        organization=organization,
        autofix_run=autofix_run,
        seer_run=seer_run,
        repo_name=repo_name,
        pr_number=pr_number,
        log_extra=log_extra,
    )


def confirm_green_check_suite(
    resolved: ResolvedGreenCheckSuite,
) -> GreenCheckSuiteContext | None:
    """SCM live-head match + check-run sweep. Call only when a side effect is needed."""
    # Importing the SCM factory while the check-suite listener module is
    # initialized pulls in integration handlers before options init.
    from sentry.scm.factory import new as make_scm

    try:
        scm = make_scm(
            resolved.organization.id, resolved.autofix_run.repository.id, referrer="seer"
        )
    except Exception:
        _failed("scm_init_failed", resolved.log_extra)
        return None

    if not isinstance(scm, GetPullRequestProtocol):
        _skip("unsupported_provider", resolved.log_extra)
        return None

    try:
        pull_request = scm_actions.get_pull_request(scm, str(resolved.pr_number))
    except Exception:
        _failed("get_pull_request_failed", {**resolved.log_extra, "pr_number": resolved.pr_number})
        return None

    head_match = check_suite_matches_pr_head(
        resolved.event, pr_head_sha=pull_request["data"]["head"].get("sha")
    )
    if not head_match.matched or not head_match.head_sha:
        _skip("stale_head", {**resolved.log_extra, "head_sha": head_match.head_sha})
        return None

    sweep = sweep_check_runs(scm, head_match.head_sha, log_extra=resolved.log_extra)
    if sweep is None:
        _skip("sweep_failed", resolved.log_extra)
        return None
    if not sweep.is_green:
        _skip(
            "not_green",
            {
                **resolved.log_extra,
                "incomplete_count": sweep.incomplete,
                "failed_count": sweep.failed,
            },
        )
        return None

    metrics.incr("autofix.pr_iteration.green_check_suite.confirmed")
    return GreenCheckSuiteContext(
        resolved=resolved,
        scm=scm,
        pull_request=pull_request,
        head_sha=head_match.head_sha,
    )


def bootstrap_green_check_suite(
    check_suite_event: CheckSuiteEvent,
) -> GreenCheckSuiteContext | None:
    """Resolve + confirm. Skips SCM when both green-path markers are already set."""
    resolved = resolve_green_check_suite(check_suite_event)
    if resolved is None:
        return None
    if (
        get_run_marker(resolved.seer_run, READY_FOR_REVIEW_EXTRA, resolved.repo_name) is not None
        and get_run_marker(resolved.seer_run, REVIEW_REQUESTS_EXTRA, resolved.repo_name) is not None
    ):
        _skip("already_complete", resolved.log_extra)
        return None
    return confirm_green_check_suite(resolved)


def _skip(reason: str, log_extra: dict[str, Any]) -> None:
    metrics.incr("autofix.pr_iteration.green_check_suite.skipped", tags={"reason": reason})
    logger.info(
        "autofix.pr_iteration.green_check_suite.skipped",
        extra={**log_extra, "reason": reason},
    )


def _failed(reason: str, log_extra: dict[str, Any]) -> None:
    metrics.incr("autofix.pr_iteration.green_check_suite.failed", tags={"reason": reason})
    logger.warning(
        "autofix.pr_iteration.green_check_suite.failed",
        extra={**log_extra, "reason": reason},
        exc_info=True,
    )


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
