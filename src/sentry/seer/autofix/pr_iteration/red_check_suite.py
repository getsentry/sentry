"""CI-failure handling for a Seer-authored PR: feed the failure back to Autofix.

``RedCheckSuite`` turns a failed check suite into PR-iteration feedback. When the
feedback is rejected because the run hit its iteration cap, the PR is handed to a
human instead so the run doesn't just go quiet.
"""

from __future__ import annotations

import logging
from dataclasses import dataclass

from sentry import features
from sentry.seer.autofix.constants import AutofixReferrer
from sentry.seer.autofix.pr_iteration.check_suites import ResolvedCheckSuite

logger = logging.getLogger(__name__)


@dataclass(frozen=True)
class RedCheckSuite(ResolvedCheckSuite):
    """CI failed: feed the failure back to Autofix so it iterates on the PR."""

    def is_relevant(self) -> bool:
        # Automated CI iteration is gated on `autofix-pr-iteration` alone. The
        # `-manual` flag covers human-triggered iteration only, so it must not
        # pull CI-driven iteration in with it.
        if not features.has("organizations:autofix-pr-iteration", self.organization):
            return False

        # Otherwise resolving to a red suite on an Autofix PR is itself the
        # relevance signal; whether to iterate is decided downstream by
        # `should_trigger`.
        return True

    def handle(self) -> None:
        # Lazy: tasks.seer.pr_iteration goes scm.factory → github → jira client,
        # which calls absolute_uri() at import time (needs the options cache);
        # stream.py is loaded in AppConfig.ready before options init. The rest
        # come along for the ride via feedback_sources.check_suite.
        from sentry.seer.autofix.pr_iteration.cap_exhausted import assign_user_for_exhausted_cap
        from sentry.seer.autofix.pr_iteration.feedback import Feedback
        from sentry.seer.autofix.pr_iteration.feedback_sources.check_suite import (
            CheckSuiteFeedbackSource,
        )
        from sentry.seer.autofix.pr_iteration.queue import try_enqueue_autofix_feedback
        from sentry.tasks.seer.pr_iteration import trigger_consume_pr_iteration_feedback

        autofix_run = self.autofix_run
        # Reuse the resolve result so we don't hit Seer again for the same PR.
        source = CheckSuiteFeedbackSource(event=self.event)
        source._autofix_run = autofix_run

        repo = autofix_run.repository
        organization_id = repo.organization_id
        agent_state = autofix_run.run_state
        feedback = Feedback(source=source)

        enqueued = try_enqueue_autofix_feedback(
            run_id=agent_state.run_id,
            organization_id=organization_id,
            group_id=autofix_run.group_id,
            feedback=feedback,
            referrer=AutofixReferrer.GITHUB_CHECK_SUITE,
            run_state=agent_state,
        )
        if not enqueued:
            # Feedback is rejected for a stale head or for the iteration hard cap.
            # In the cap case the run would otherwise just go quiet, so hand the PR
            # to a human instead (the handler re-checks which case applies).
            assign_user_for_exhausted_cap(source.event, autofix_run)
            return None

        # Defer Now/Later/skip to `should_trigger` (incomplete check runs schedule
        # a delayed consume rather than dropping the scheduled task entirely).
        logger.info(
            "autofix.pr_iteration.check_suite.trigger_consume",
            extra={
                "organization_id": organization_id,
                "repo_id": repo.id,
                "pr_id": autofix_run.pr_id,
                "run_id": agent_state.run_id,
            },
        )
        trigger_consume_pr_iteration_feedback(
            run_id=agent_state.run_id,
            organization_id=organization_id,
            feedback=feedback,
            run_state=agent_state,
        )
        return None
