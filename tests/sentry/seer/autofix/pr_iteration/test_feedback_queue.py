from unittest.mock import MagicMock

from sentry.seer.agent.client_models import RepoPRState, SeerRunState
from sentry.seer.autofix.constants import AutofixReferrer
from sentry.seer.autofix.pr_iteration.feedback import Feedback
from sentry.seer.autofix.pr_iteration.feedback_sources.check_suite import (
    CheckSuiteAutofixRun,
    CheckSuiteFeedbackSource,
)
from sentry.seer.autofix.pr_iteration.feedback_sources.user_ui import UserUIFeedbackSource
from sentry.seer.autofix.pr_iteration.queue import (
    peek_queued_autofix_feedback,
    try_enqueue_autofix_feedback,
)
from sentry.testutils.cases import TestCase


def _run_state(*, repo_pr_states=None) -> SeerRunState:
    return SeerRunState(
        run_id=1,
        blocks=[],
        status="completed",
        updated_at="2024-01-01T00:00:00Z",
        repo_pr_states=repo_pr_states or {},
    )


def _check_suite_event() -> dict:
    return {
        "check_suite": {
            "id": 1,
            "head_sha": "abc",
            "check_runs_url": "https://github.com/owner/repo/check-runs",
            "app": {"name": "CI"},
            "pull_requests": [{"id": 99}],
        },
        "repository": {
            "html_url": "https://github.com/owner/repo",
            "full_name": "owner/repo",
            "id": 123,
        },
    }


class TryEnqueueAutofixFeedbackTest(TestCase):
    def _enqueue(
        self, run_id: int, feedback: Feedback, *, run_state: SeerRunState | None = None
    ) -> bool:
        return try_enqueue_autofix_feedback(
            run_id=run_id,
            organization_id=self.organization.id,
            group_id=1,
            feedback=feedback,
            referrer=AutofixReferrer.GITHUB_PR_COMMENT,
            run_state=run_state or _run_state(),
        )

    def test_enqueues_when_should_queue(self) -> None:
        feedback = Feedback(source=UserUIFeedbackSource(user_id=1, user_feedback="fix it"))

        assert self._enqueue(run_id=4242, feedback=feedback) is True

        queued = peek_queued_autofix_feedback(4242)
        assert len(queued) == 1
        assert queued[0].feedback.text == "fix it"

    def test_skips_stale_feedback(self) -> None:
        feedback = Feedback(source=CheckSuiteFeedbackSource(event=_check_suite_event()))

        assert self._enqueue(run_id=4343, feedback=feedback) is False
        assert peek_queued_autofix_feedback(4343) == []

    def test_enqueues_check_suite_after_resolving_autofix_run(self) -> None:
        """Listener resolves autofix_run before enqueue; Django/Seer objects must
        not be included in the Redis JSON payload."""
        source = CheckSuiteFeedbackSource(event=_check_suite_event())
        run_state = _run_state(
            repo_pr_states={"owner/repo": RepoPRState(repo_name="owner/repo", commit_sha="abc")}
        )
        # Same PrivateAttr cache population as source.autofix_run / source.repositories.
        source._repositories = [MagicMock()]
        source._autofix_run = CheckSuiteAutofixRun(
            repository=MagicMock(),
            run_state=run_state,
            pr_id=99,
            group_id=1,
        )
        source._autofix_run_resolved = True
        feedback = Feedback(source=source)

        # Direct serialization paths used by Redis enqueue / feedback metadata.
        assert "repositories" not in source.dict()
        assert "autofix_run" not in source.dict()
        assert "_repositories" not in source.dict()
        assert "_autofix_run" not in source.dict()
        source.json()
        feedback.json()

        assert self._enqueue(run_id=4444, feedback=feedback, run_state=run_state) is True

        queued = peek_queued_autofix_feedback(4444)
        assert len(queued) == 1
        assert isinstance(queued[0].feedback.source, CheckSuiteFeedbackSource)
        assert queued[0].feedback.source.event.check_suite.id == 1
        # Round-trip must not rehydrate the lazy PrivateAttr caches.
        assert queued[0].feedback.source._repositories is None
        assert queued[0].feedback.source._autofix_run_resolved is False
