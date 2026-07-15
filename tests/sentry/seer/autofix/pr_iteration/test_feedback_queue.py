from sentry.seer.agent.client_models import SeerRunState
from sentry.seer.autofix.constants import AutofixReferrer
from sentry.seer.autofix.pr_iteration.feedback import Feedback
from sentry.seer.autofix.pr_iteration.feedback_sources.user_ui import UserUIFeedbackSource
from sentry.seer.autofix.pr_iteration.queue import (
    peek_queued_autofix_feedback,
    try_enqueue_autofix_feedback,
)
from sentry.testutils.cases import TestCase


def _run_state() -> SeerRunState:
    return SeerRunState(
        run_id=1,
        blocks=[],
        status="completed",
        updated_at="2024-01-01T00:00:00Z",
    )


class TryEnqueueAutofixFeedbackTest(TestCase):
    def _enqueue(self, run_id: int, feedback: Feedback) -> bool:
        return try_enqueue_autofix_feedback(
            run_id=run_id,
            organization_id=self.organization.id,
            group_id=1,
            feedback=feedback,
            referrer=AutofixReferrer.GITHUB_PR_COMMENT,
            run_state=_run_state(),
        )

    def test_enqueues_when_should_queue(self) -> None:
        feedback = Feedback(source=UserUIFeedbackSource(user_id=1, user_feedback="fix it"))

        assert self._enqueue(run_id=4242, feedback=feedback) is True

        queued = peek_queued_autofix_feedback(4242)
        assert len(queued) == 1
        assert queued[0].feedback.text == "fix it"
