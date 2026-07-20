from __future__ import annotations

import logging
from dataclasses import dataclass
from datetime import timedelta
from functools import cached_property
from typing import Literal

import sentry_sdk
from pydantic import BaseModel, Field, root_validator
from scm import actions as scm_actions
from scm.helpers import iter_all_pages
from scm.types import ListCheckRunsForRefProtocol

from sentry.constants import ObjectStatus
from sentry.integrations.services.integration import integration_service
from sentry.integrations.types import IntegrationProviderSlug
from sentry.models.repository import Repository
from sentry.seer.agent.client_models import SeerRunState
from sentry.seer.agent.client_utils import get_agent_state_from_pr_id
from sentry.seer.autofix.pr_iteration.feedback_sources.base import ConsumeTask, FeedbackSourceBase
from sentry.seer.models import SeerApiError

logger = logging.getLogger(__name__)

_SEER_GITHUB_PROVIDER = "integrations:github"
# Hard cap on consecutive PR iterations driven solely by automated check-suite
# feedback. Once the last N iterations were all check-suite-only, stop triggering
# further check-suite iterations (they'd loop forever without human input).
CHECK_SUITE_ITERATION_HARD_CAP = 3


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
            provider=_SEER_GITHUB_PROVIDER,
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


def _check_suite_iteration_cap_reached(run_state: SeerRunState) -> bool:
    """Whether the last N PR iterations used only automated check-suite feedback."""
    from sentry.seer.autofix.autofix_agent import get_iterations
    from sentry.seer.autofix.pr_iteration.feedback import parse_feedback

    cap = CHECK_SUITE_ITERATION_HARD_CAP
    if cap <= 0:
        return False

    last_iterations = get_iterations(run_state)[-cap:]
    if len(last_iterations) < cap:
        return False

    for iteration in last_iterations:
        feedbacks = [
            feedback
            for block in iteration.blocks
            for feedback in parse_feedback((block.message.metadata or {}).get("feedback", ""))
        ]
        if any(not isinstance(feedback.source, CheckSuiteFeedbackSource) for feedback in feedbacks):
            return False

    return True


def _processed_check_suite_ids(run_state: SeerRunState) -> set[int]:
    """Check suite ids already turned into feedback on this run (for consume dedupe)."""
    from sentry.seer.autofix.autofix_agent import get_iterations
    from sentry.seer.autofix.pr_iteration.feedback_sources.github_comment import _blocks_feedback

    ids: set[int] = set()
    for iteration in get_iterations(run_state):
        for item in _blocks_feedback(iteration.blocks):
            if isinstance(item.source, CheckSuiteFeedbackSource):
                ids.add(item.source.event.check_suite.id)
    return ids


class CheckSuiteFeedbackSource(FeedbackSourceBase):
    type: Literal["check-suite"] = "check-suite"
    event: GithubCheckSuiteEvent
    app_name: str = ""
    check_suite_url: str = ""

    @root_validator
    def _populate_event_fields(cls, values: dict[str, object]) -> dict[str, object]:
        event = values.get("event")
        if event is None:
            return values
        assert isinstance(event, GithubCheckSuiteEvent)
        values["app_name"] = event.check_suite.app.name
        values["check_suite_url"] = get_check_suite_url(event)
        return values

    @property
    def text(self) -> str:
        check_suite = self.event.check_suite
        details = [
            f"conclusion: {check_suite.conclusion}",
            f"app: {self.app_name}",
            f"check suite: {self.check_suite_url}",
            f"check runs: {check_suite.check_runs_url}",
        ]
        return "\n".join(
            [
                "A GitHub check suite on the pull request failed",
                "\n".join(details),
                "Fetch the failing check runs to see which checks failed and why, ",
                "then update the pull request to fix the failure.",
                "Assume the failure is caused by the code changes you made, not by a "
                "problem with CI itself. Investigate and fix your code first. "
                "Only if you are certain the failure is genuinely in the CI setup "
                "(e.g. the workflow configuration) and cannot be fixed by changing "
                "the code, make no code change at all.",
            ]
        )

    @property
    def ui_text(self) -> str | None:
        return f"check suite for app {self.app_name} failed"

    @cached_property
    def repositories(self) -> list[Repository]:
        return resolve_check_suite_repositories(self.event)

    @cached_property
    def autofix_run(self) -> CheckSuiteAutofixRun | None:
        """Find the single Autofix run for this check suite's PR(s).

        Assumes one Autofix run ↔ PR in Sentry. Tries each PR × candidate org until
        Seer returns a run with ``repo_pr_states`` and a ``group_id``.
        """
        repos = self.repositories
        if not repos:
            return None

        for pr_id in (pr.id for pr in self.event.check_suite.pull_requests):
            for candidate in repos:
                try:
                    state = get_agent_state_from_pr_id(
                        candidate.organization_id, _SEER_GITHUB_PROVIDER, pr_id
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

                return CheckSuiteAutofixRun(
                    repository=candidate,
                    run_state=state,
                    pr_id=pr_id,
                    group_id=group_id,
                )

        return None

    def _matches_current_head(self, run_state: SeerRunState) -> tuple[str | None, str | None, bool]:
        """Whether the check suite ran on the PR's *current* head commit.

        A ``check_suite`` webhook fires for any commit on the PR (including
        commits a human pushed or commits Seer made earlier in the run). We only
        act on failures for the commit that is currently the PR head for this
        run: if Seer has since pushed a newer commit, the CI failure is out of
        date and reacting to it would waste an iteration on stale code.
        """
        head_sha = self.event.check_suite.head_sha
        repo_name = self.event.repository.full_name
        pr_state = run_state.repo_pr_states.get(repo_name) if repo_name else None
        matched = bool(head_sha and pr_state and pr_state.commit_sha == head_sha)
        return head_sha, repo_name, matched

    def should_queue(self, run_state: SeerRunState) -> bool:
        head_sha, repo_name, matched = self._matches_current_head(run_state)
        cap_reached = matched and _check_suite_iteration_cap_reached(run_state)
        logger.info(
            "autofix.pr_iteration.check_suite.should_queue.evaluated",
            extra={
                "run_id": run_state.run_id,
                "head_sha": head_sha,
                "repo_name": repo_name,
                "matched": matched,
                "hard_cap_reached": cap_reached,
                "repo_pr_state_count": len(run_state.repo_pr_states),
            },
        )
        # Hard cap also blocks enqueue so failed suites don't pile up in Redis
        # with no check-suite consume path to drain them.
        return matched and not cap_reached

    def should_consume(self, run_state: SeerRunState) -> bool:
        head_sha, repo_name, matched = self._matches_current_head(run_state)
        suite_id = self.event.check_suite.id
        already_processed = suite_id in _processed_check_suite_ids(run_state)
        logger.info(
            "autofix.pr_iteration.check_suite.should_consume.evaluated",
            extra={
                "run_id": run_state.run_id,
                "head_sha": head_sha,
                "repo_name": repo_name,
                "matched": matched,
                "check_suite_id": suite_id,
                "already_processed": already_processed,
                "repo_pr_state_count": len(run_state.repo_pr_states),
            },
        )
        # Dedupe against prior check-suite feedback so webhook retries of the same
        # suite can't burn iterations when the PR head is unchanged.
        return matched and not already_processed

    def should_trigger(self, run_state: SeerRunState) -> ConsumeTask | None:
        if _check_suite_iteration_cap_reached(run_state):
            logger.info(
                "autofix.pr_iteration.check_suite.should_trigger.hard_cap_reached",
                extra={"run_id": run_state.run_id},
            )
            return None

        # Otherwise queue a consume task for this run: immediately once every check
        # run has completed, or after a delay while some are still pending (they
        # can get stuck, so we trigger anyway rather than wait forever).
        head_sha = self.event.check_suite.head_sha
        if not head_sha:
            logger.info(
                "autofix.pr_iteration.check_suite.should_trigger.missing_head_sha",
                extra={"run_id": run_state.run_id},
            )
            return ConsumeTask.Now

        resolved = self.autofix_run
        if resolved is None:
            # Listener only calls should_trigger after resolving a run; missing
            # here means a bug or a test that skipped resolution.
            logger.error(
                "autofix.pr_iteration.check_suite.should_trigger.missing_autofix_run",
                extra={"run_id": run_state.run_id, "head_sha": head_sha},
            )
            return ConsumeTask.Now

        organization_id = resolved.repository.organization_id
        repo_id = resolved.repository.id

        # Importing the SCM factory while feedback models are initialized pulls
        # in integration handlers before Django finishes registering apps.
        from sentry.scm.factory import new as make_scm

        try:
            scm = make_scm(organization_id, repo_id, referrer="seer")
        except Exception:
            logger.warning(
                "autofix.pr_iteration.should_trigger.scm_init_failed",
                extra={"organization_id": organization_id, "repo_id": repo_id},
                exc_info=True,
            )
            return ConsumeTask.Now

        if not isinstance(scm, ListCheckRunsForRefProtocol):
            logger.warning(
                "autofix.pr_iteration.should_trigger.unsupported_provider",
                extra={"organization_id": organization_id, "repo_id": repo_id},
            )
            return ConsumeTask.Now

        try:
            for page in iter_all_pages(
                lambda pagination: scm_actions.list_check_runs_for_ref(
                    scm, head_sha, pagination=pagination
                )
            ):
                incomplete_count = sum(1 for run in page["data"] if run["status"] != "completed")
                logger.info(
                    "autofix.pr_iteration.check_suite.should_trigger.check_runs_page",
                    extra={
                        "run_id": run_state.run_id,
                        "organization_id": organization_id,
                        "repo_id": repo_id,
                        "head_sha": head_sha,
                        "check_run_count": len(page["data"]),
                        "incomplete_count": incomplete_count,
                    },
                )
                if incomplete_count:
                    return ConsumeTask.Later(timedelta(hours=1))

        except Exception:
            logger.warning(
                "autofix.pr_iteration.should_trigger.list_check_runs_failed",
                extra={
                    "organization_id": organization_id,
                    "repo_id": repo_id,
                    "head_sha": head_sha,
                },
                exc_info=True,
            )

        return ConsumeTask.Now


__all__ = (
    "CheckSuiteAutofixRun",
    "CheckSuiteFeedbackSource",
    "GithubCheckSuite",
    "GithubCheckSuiteApp",
    "GithubCheckSuiteEvent",
    "GithubCheckSuiteInstallation",
    "GithubCheckSuitePullRequest",
    "GithubCheckSuiteRepository",
    "get_check_suite_url",
    "resolve_check_suite_repositories",
)
