"""``GreenCheckSuite``: the green path's relevance gate and dispatch.

This module decides *whether* the green side effects are needed and confirms the
tip really is green; the side effects themselves live in ``ready_for_review`` and
``review_request``, each with its own lock and its own sticky ``SeerRun.extras``
marker so they succeed, fail, and retry independently of one another.
"""

from __future__ import annotations

import logging
from dataclasses import dataclass
from typing import Any

from scm import actions as scm_actions
from scm.types import GetPullRequestProtocol

from sentry import features
from sentry.seer.autofix.pr_iteration.check_suites import (
    CheckSuiteConclusionType,
    ResolvedCheckSuite,
    check_suite_matches_pr_head,
    sweep_check_runs,
)
from sentry.seer.autofix.pr_iteration.constants import REVIEW_REQUEST_FLAG
from sentry.seer.autofix.pr_iteration.green_check_suite.context import GreenCheckSuiteContext
from sentry.seer.autofix.pr_iteration.green_check_suite.ready_for_review import (
    mark_ready_for_review,
    ready_for_review_marker,
)
from sentry.seer.autofix.pr_iteration.green_check_suite.review_request import (
    request_review,
    review_request_marker,
)
from sentry.seer.autofix.pr_iteration.queue import peek_queued_autofix_feedback
from sentry.utils import metrics

logger = logging.getLogger(__name__)


@dataclass(frozen=True)
class GreenCheckSuite(ResolvedCheckSuite):
    """CI passed: undraft the PR and request a human review."""

    conclusion_type = CheckSuiteConclusionType.GREEN

    def _markers(self) -> tuple[dict[str, Any] | None, dict[str, Any] | None]:
        """The two sticky side-effect markers for this run+repo."""
        return (
            ready_for_review_marker(self.seer_run, self.repo_name),
            review_request_marker(self.seer_run, self.repo_name),
        )

    def _wants_review_side_effects(self) -> bool:
        """Whether undraft / request-review still have work to do."""
        if not features.has(REVIEW_REQUEST_FLAG, self.organization):
            return False

        ready_marker, review_marker = self._markers()
        return ready_marker is None or review_marker is None

    def _wants_deferred_iteration_recheck(self) -> bool:
        """Whether a red suite left feedback parked waiting on this suite.

        A failing suite whose sweep still saw incomplete runs defers its consume
        by an hour (``CheckSuiteFeedbackSource.should_trigger``). This suite
        completing may be the run it was waiting on, so the queue is worth
        rechecking — independently of ``REVIEW_REQUEST_FLAG``, which only gates
        the undraft / review-request side effects.
        """
        if not features.has("organizations:autofix-pr-iteration", self.organization):
            return False

        return bool(peek_queued_autofix_feedback(self.autofix_run.run_state.run_id))

    def is_relevant(self) -> bool:
        return self._wants_review_side_effects() or self._wants_deferred_iteration_recheck()

    def confirm_green(self) -> GreenCheckSuiteContext | None:
        """SCM live-head match + check-run sweep. Call only when a side effect is needed."""
        # Lazy: scm.factory pulls in the integration handlers, which cycle back
        # through notifications.platform.templates.seer (ImportError on a
        # partially initialized module if hoisted).
        from sentry.scm.factory import new as make_scm

        try:
            scm = make_scm(self.organization.id, self.autofix_run.repository.id, referrer="seer")
        except Exception:
            self._failed("scm_init_failed")
            return None

        if not isinstance(scm, GetPullRequestProtocol):
            self._skip("unsupported_provider")
            return None

        try:
            pull_request = scm_actions.get_pull_request(scm, str(self.pr_number))
        except Exception:
            self._failed("get_pull_request_failed", pr_number=self.pr_number)
            return None

        head_match = check_suite_matches_pr_head(
            self.event, pr_head_sha=pull_request["data"]["head"].get("sha")
        )
        if not head_match.matched or not head_match.head_sha:
            self._skip("stale_head", head_sha=head_match.head_sha)
            return None

        sweep = sweep_check_runs(scm, head_match.head_sha, log_extra=self.log_extra)
        if sweep is None:
            self._skip("sweep_failed")
            return None
        if not sweep.is_green:
            self._skip("not_green", incomplete_count=sweep.incomplete, failed_count=sweep.failed)
            return None

        metrics.incr("autofix.pr_iteration.green_check_suite.confirmed")
        return GreenCheckSuiteContext(
            resolved=self,
            scm=scm,
            pull_request=pull_request,
            head_sha=head_match.head_sha,
        )

    def handle(self) -> None:
        # The recheck runs off this suite completing, not off the PR being
        # green: a red suite's feedback is still parked when the PR as a whole
        # is failing, which is exactly the case that needs to iterate.
        #
        # It is also independent of undraft / review-request, so it gets its own
        # try: it reads Redis and re-resolves the run through ``should_trigger``,
        # and a failure there must not swallow the review side effects. The task
        # doesn't retry, so `_failed` is what keeps this visible.
        try:
            if self._wants_deferred_iteration_recheck():
                self._retrigger_deferred_iteration()
        except Exception:
            self._failed("deferred_recheck_failed")

        # Read markers once → skip SCM if both done → confirm green → run only
        # the missing side effects. Undraft before review-request: GitHub may
        # CODEOWNERS-request after undraft; see TODO in ``request_review``.
        if not self._wants_review_side_effects():
            return None

        ready_marker, review_marker = self._markers()

        ctx = self.confirm_green()
        if ctx is None:
            return None

        if ready_marker is None:
            mark_ready_for_review(ctx)

        if review_marker is None:
            request_review(ctx)

        return None

    def _retrigger_deferred_iteration(self) -> None:
        """Re-evaluate feedback a red suite parked behind still-running checks.

        ``should_trigger`` re-sweeps: if checks are *still* incomplete it defers
        again, so this only pulls the consume forward once the tip has settled.
        The consume task pops the queue under a lock and no-ops on an empty one,
        so racing an already-scheduled activation is safe.
        """
        # Lazy: tasks.seer.pr_iteration → scm.factory → github → jira client,
        # which calls absolute_uri() at import time (needs the options cache).
        from sentry.tasks.seer.pr_iteration import trigger_consume_pr_iteration_feedback

        run_state = self.autofix_run.run_state
        for item in peek_queued_autofix_feedback(run_state.run_id):
            logger.info(
                "autofix.pr_iteration.green_check_suite.retrigger_deferred_consume",
                extra={**self.log_extra, "referrer": str(item.referrer)},
            )
            trigger_consume_pr_iteration_feedback(
                run_id=run_state.run_id,
                organization_id=self.organization.id,
                feedback=item.feedback,
                run_state=run_state,
            )
