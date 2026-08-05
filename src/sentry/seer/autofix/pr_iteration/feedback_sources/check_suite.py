from __future__ import annotations

import logging
from datetime import timedelta
from typing import Any, Literal

from pydantic import Field, PrivateAttr, root_validator

from sentry.seer.agent.client_models import SeerRunState
from sentry.seer.autofix.pr_iteration.check_suites import (
    CheckSuiteAutofixRun,
    CheckSuiteHeadMatch,
    GithubCheckSuiteEvent,
    check_suite_head_match,
    get_check_suite_url,
    resolve_check_suite_autofix_run,
    sweep_check_runs,
)
from sentry.seer.autofix.pr_iteration.feedback_sources.base import ConsumeTask, FeedbackSourceBase

logger = logging.getLogger(__name__)


class MissingCheckSuiteAutofixRun(Exception):
    """No Autofix run for this check suite's PR(s).

    Raised from ``CheckSuiteFeedbackSource.autofix_run`` (not a ``ValueError``)
    so callers can catch it without colliding with pydantic ``ValidationError``.
    """


def _processed_check_suite_attempts(run_state: SeerRunState) -> set[tuple[int, str] | int]:
    """Attempt keys already turned into feedback on this run (for consume dedupe)."""
    from sentry.seer.autofix.autofix_agent import get_iterations
    from sentry.seer.autofix.pr_iteration.feedback_sources.github_comment import _blocks_feedback

    keys: set[tuple[int, str] | int] = set()
    for iteration in get_iterations(run_state):
        for item in _blocks_feedback(iteration.blocks):
            if isinstance(item.source, CheckSuiteFeedbackSource):
                keys.add(item.source.check_suite_attempt_key())
    return keys


class CheckSuiteFeedbackSource(FeedbackSourceBase):
    type: Literal["check-suite"] = "check-suite"
    event: GithubCheckSuiteEvent
    # Derived scalars set in ``_populate_event_fields`` (same pattern as
    # ``GithubPrCommentFeedbackSource.comment_feedback``).
    app_name: str = ""
    check_suite_url: str = ""
    # From ``event.check_suite.updated_at``; excluded so we don't duplicate the
    # nested event field in Redis / feedback metadata. Recomputed on parse.
    updated_at: str | None = Field(default=None, exclude=True)
    # Transient cache for the Seer/Django resolve result. PrivateAttr so it is
    # never serialized and cannot be injected from Redis / feedback JSON.
    _autofix_run: Any = PrivateAttr(default=None)

    @root_validator
    def _populate_event_fields(cls, values: dict[str, object]) -> dict[str, object]:
        event = values.get("event")
        if event is None:
            return values
        assert isinstance(event, GithubCheckSuiteEvent)
        values["app_name"] = event.check_suite.app.name
        values["check_suite_url"] = get_check_suite_url(event)
        values["updated_at"] = event.check_suite.updated_at
        return values

    @property
    def autofix_run(self) -> CheckSuiteAutofixRun:
        """Cached Autofix run. Lazy-resolves via Seer on first access.

        Not serialized (``_autofix_run`` is a PrivateAttr). Raises
        ``MissingCheckSuiteAutofixRun`` when no run is found.
        """
        if self._autofix_run is not None:
            return self._autofix_run

        autofix_run = resolve_check_suite_autofix_run(self.event)
        if autofix_run is None:
            raise MissingCheckSuiteAutofixRun
        self._autofix_run = autofix_run
        return autofix_run

    def check_suite_attempt_key(self) -> tuple[int, str] | int:
        """Stable attempt key for check-suite consume / batch dedupe.

        Prefer ``(suite_id, updated_at)``: webhook retries share both; Actions
        re-runs keep the suite id but bump ``updated_at``. Legacy feedback without
        ``updated_at`` falls back to suite-id-only.
        """
        if self.updated_at:
            return (self.event.check_suite.id, self.updated_at)
        return self.event.check_suite.id

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

    @property
    def is_automated(self) -> bool:
        return True

    def _matches_current_head(self, run_state: SeerRunState) -> CheckSuiteHeadMatch:
        return check_suite_head_match(self.event, run_state)

    def should_queue(self, run_state: SeerRunState) -> bool:
        from sentry.seer.autofix.pr_iteration.feedback import automated_iteration_cap_reached

        head_sha, repo_name, matched = self._matches_current_head(run_state)
        cap_reached = matched and automated_iteration_cap_reached(run_state)
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
        attempt_key = self.check_suite_attempt_key()
        already_processed = attempt_key in _processed_check_suite_attempts(run_state)
        logger.info(
            "autofix.pr_iteration.check_suite.should_consume.evaluated",
            extra={
                "run_id": run_state.run_id,
                "head_sha": head_sha,
                "repo_name": repo_name,
                "matched": matched,
                "check_suite_id": self.event.check_suite.id,
                "updated_at": self.updated_at,
                "already_processed": already_processed,
                "repo_pr_state_count": len(run_state.repo_pr_states),
            },
        )
        # Dedupe against prior check-suite feedback so webhook retries of the same
        # suite attempt can't burn iterations when the PR head is unchanged.
        return matched and not already_processed

    def should_trigger(self, run_state: SeerRunState) -> ConsumeTask | None:
        from sentry.seer.autofix.pr_iteration.feedback import automated_iteration_cap_reached

        if automated_iteration_cap_reached(run_state):
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

        organization_id = self.autofix_run.repository.organization_id
        repo_id = self.autofix_run.repository.id

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

        sweep = sweep_check_runs(
            scm,
            head_sha,
            log_extra={
                "run_id": run_state.run_id,
                "organization_id": organization_id,
                "repo_id": repo_id,
            },
        )
        if sweep is not None and sweep.incomplete:
            return ConsumeTask.Later(timedelta(hours=1))

        return ConsumeTask.Now


__all__ = ("CheckSuiteFeedbackSource", "MissingCheckSuiteAutofixRun")
