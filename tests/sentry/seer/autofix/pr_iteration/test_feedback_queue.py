from unittest.mock import MagicMock, patch

from sentry.seer.agent.client_models import RepoPRState, SeerRunState
from sentry.seer.autofix.constants import AutofixReferrer
from sentry.seer.autofix.pr_iteration.feedback import Feedback
from sentry.seer.autofix.pr_iteration.feedback_sources.check_suite import (
    CheckSuiteAutofixRun,
    CheckSuiteFeedbackSource,
)
from sentry.seer.autofix.pr_iteration.feedback_sources.user_ui import UserUIFeedbackSource
from sentry.seer.autofix.pr_iteration.queue import (
    _parse_queued_item,
    peek_queued_autofix_feedback,
    try_enqueue_autofix_feedback,
)
from sentry.testutils.cases import TestCase
from sentry.utils import json

CHECK_SUITE_SOURCE_PATH = "sentry.seer.autofix.pr_iteration.feedback_sources.check_suite"


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
            "updated_at": "2024-01-01T00:00:00Z",
            "pull_requests": [{"id": 99}],
        },
        "repository": {
            "html_url": "https://github.com/owner/repo",
            "full_name": "owner/repo",
            "id": 123,
        },
    }


def _autofix_run(*, run_state: SeerRunState | None = None) -> CheckSuiteAutofixRun:
    return CheckSuiteAutofixRun(
        repository=MagicMock(organization_id=1, id=2),
        run_state=run_state or _run_state(),
        pr_id=99,
        group_id=1,
    )


def _resolved_check_suite_source(
    *, run_state: SeerRunState | None = None
) -> CheckSuiteFeedbackSource:
    autofix_run = _autofix_run(run_state=run_state)
    source = CheckSuiteFeedbackSource(event=_check_suite_event())
    with patch(
        f"{CHECK_SUITE_SOURCE_PATH}.resolve_check_suite_autofix_run",
        return_value=autofix_run,
    ):
        assert source.autofix_run is autofix_run
    return source


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
        feedback = Feedback(source=_resolved_check_suite_source())

        assert self._enqueue(run_id=4343, feedback=feedback) is False
        assert peek_queued_autofix_feedback(4343) == []

    def test_enqueues_check_suite_without_serializing_autofix_run(self) -> None:
        """Django/Seer objects on autofix_run must not appear in the Redis JSON."""
        run_state = _run_state(
            repo_pr_states={"owner/repo": RepoPRState(repo_name="owner/repo", commit_sha="abc")}
        )
        source = _resolved_check_suite_source(run_state=run_state)
        feedback = Feedback(source=source)
        autofix_run = source.autofix_run

        assert "autofix_run" not in source.dict()
        assert "updated_at" not in source.dict()
        assert source.updated_at == "2024-01-01T00:00:00Z"
        assert source.event.check_suite.updated_at == "2024-01-01T00:00:00Z"
        # Same-request transient (for should_trigger) — not serialized.
        assert source.autofix_run is autofix_run
        source.json()
        feedback.json()

        assert self._enqueue(run_id=4444, feedback=feedback, run_state=run_state) is True

        with patch(f"{CHECK_SUITE_SOURCE_PATH}.resolve_check_suite_autofix_run") as mock_resolve:
            queued = peek_queued_autofix_feedback(4444)

        assert len(queued) == 1
        assert isinstance(queued[0].feedback.source, CheckSuiteFeedbackSource)
        assert queued[0].feedback.source.event.check_suite.id == 1
        assert queued[0].feedback.source.updated_at == "2024-01-01T00:00:00Z"
        assert queued[0].feedback.source.event.check_suite.updated_at == "2024-01-01T00:00:00Z"
        # After Redis re-parse: cache unset, no Seer re-resolve during parse.
        assert queued[0].feedback.source._autofix_run is None
        assert "autofix_run" not in queued[0].feedback.source.dict()
        mock_resolve.assert_not_called()


class ParseQueuedItemTest(TestCase):
    def test_deserializes_check_suite_without_resolve(self) -> None:
        raw = json.dumps(
            {
                "organization_id": self.organization.id,
                "group_id": 1,
                "feedback": {
                    "source": {
                        "type": "check-suite",
                        "event": _check_suite_event(),
                    }
                },
                "referrer": AutofixReferrer.GITHUB_CHECK_SUITE.value,
            }
        )

        with patch(f"{CHECK_SUITE_SOURCE_PATH}.resolve_check_suite_autofix_run") as mock_resolve:
            item = _parse_queued_item(raw)

        assert item is not None
        assert isinstance(item.feedback.source, CheckSuiteFeedbackSource)
        assert item.feedback.source._autofix_run is None
        mock_resolve.assert_not_called()

    def test_skips_unparseable_item(self) -> None:
        assert _parse_queued_item("not-json") is None
