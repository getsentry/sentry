from unittest.mock import MagicMock, patch

from sentry.seer.agent.client_models import RepoPRState, SeerRunState
from sentry.seer.autofix.constants import AutofixReferrer
from sentry.seer.autofix.pr_iteration.check_suites import CheckSuiteAutofixRun
from sentry.seer.autofix.pr_iteration.feedback import Feedback
from sentry.seer.autofix.pr_iteration.feedback_sources.check_suite import (
    CheckSuiteFeedbackSource,
)
from sentry.seer.autofix.pr_iteration.feedback_sources.user_ui import UserUIFeedbackSource
from sentry.seer.autofix.pr_iteration.logs import PrIterationLogContext
from sentry.seer.autofix.pr_iteration.queue import (
    _parse_queued_item,
    clear_queued_autofix_feedback,
    peek_queued_autofix_feedback,
    pop_queued_autofix_feedback,
    try_enqueue_autofix_feedback,
)
from sentry.testutils.cases import TestCase
from sentry.utils import json
from sentry.utils.locking import UnableToAcquireLock

CHECK_SUITE_SOURCE_PATH = "sentry.seer.autofix.pr_iteration.feedback_sources.check_suite"
QUEUE_PATH = "sentry.seer.autofix.pr_iteration.queue"


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
    def setUp(self) -> None:
        super().setUp()
        self.log = MagicMock()

    def _enqueue(
        self, run_id: int, feedback: Feedback, *, run_state: SeerRunState | None = None
    ) -> bool:
        state = run_state or _run_state()
        return try_enqueue_autofix_feedback(
            log_ctx=PrIterationLogContext(
                self.log,
                run_state=state,
                organization_id=self.organization.id,
                group_id=1,
            ),
            run_id=run_id,
            organization_id=self.organization.id,
            group_id=1,
            feedback=feedback,
            referrer=AutofixReferrer.GITHUB_PR_COMMENT,
            run_state=state,
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

    def test_logs_the_decision_with_the_run_identity(self) -> None:
        run_state = _run_state(
            repo_pr_states={"owner/repo": RepoPRState(repo_name="owner/repo", commit_sha="abc")}
        )
        feedback = Feedback(source=_resolved_check_suite_source(run_state=run_state))

        assert self._enqueue(run_id=4545, feedback=feedback, run_state=run_state) is True

        assert self.log.info.call_args.args[0] == "autofix.pr_iteration.feedback.queue"
        extra = self.log.info.call_args.kwargs["extra"]
        assert extra["outcome"] == "queued"
        assert extra["reason"] == "head_matches"
        # Identity: what ties this line to the rest of the iteration.
        assert extra["run_id"] == 1
        assert extra["sentry_organization_id"] == self.organization.id
        assert extra["sentry_group_id"] == 1
        assert extra["scm_infos"] == [{"scm_repo_full_name": "owner/repo"}]
        # Which feedback item, and both sides of the head comparison.
        assert extra["feedback_source"] == "check-suite"
        assert extra["referrer"] == AutofixReferrer.GITHUB_PR_COMMENT.value
        assert extra["check_suite_id"] == 1
        assert extra["check_suite_head_sha"] == "abc"
        assert extra["run_pr_commit_sha"] == "abc"

    def test_a_rejection_shares_the_log_name_with_the_allow_path(self) -> None:
        # One name for both branches, so a search for the decision finds every
        # occurrence of it and ``outcome`` says which way each one went.
        feedback = Feedback(source=_resolved_check_suite_source())

        assert self._enqueue(run_id=4646, feedback=feedback) is False

        assert self.log.info.call_args.args[0] == "autofix.pr_iteration.feedback.queue"
        extra = self.log.info.call_args.kwargs["extra"]
        assert extra["outcome"] == "not_queued"
        assert extra["reason"] == "stale_head"

    def test_a_source_with_no_gate_says_so_rather_than_going_quiet(self) -> None:
        feedback = Feedback(source=UserUIFeedbackSource(user_id=1, user_feedback="fix it"))

        assert self._enqueue(run_id=4747, feedback=feedback) is True

        extra = self.log.info.call_args.kwargs["extra"]
        assert extra["outcome"] == "queued"
        assert extra["reason"] == "no_gate"
        assert extra["feedback_source"] == "user-ui"

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

    @patch("sentry.seer.autofix.pr_iteration.queue.emit_pr_iteration_details_started")
    def test_first_enqueue_emits_started(self, mock_started: MagicMock) -> None:
        feedback = Feedback(source=UserUIFeedbackSource(user_id=1, user_feedback="fix it"))

        assert self._enqueue(run_id=4545, feedback=feedback) is True

        mock_started.assert_called_once()
        kwargs = mock_started.call_args.kwargs
        queued = peek_queued_autofix_feedback(4545)
        assert kwargs["run_id"] == 4545
        assert kwargs["consume_id"] == queued[0].consume_id
        assert kwargs["referrer"] == AutofixReferrer.GITHUB_PR_COMMENT.value

    @patch("sentry.seer.autofix.pr_iteration.queue.emit_pr_iteration_details_started")
    def test_second_enqueue_does_not_emit_started(self, mock_started: MagicMock) -> None:
        first = Feedback(source=UserUIFeedbackSource(user_id=1, user_feedback="first"))
        second = Feedback(source=UserUIFeedbackSource(user_id=1, user_feedback="second"))

        assert self._enqueue(run_id=4646, feedback=first) is True
        assert self._enqueue(run_id=4646, feedback=second) is True

        mock_started.assert_called_once()
        assert peek_queued_autofix_feedback(4646)[0].consume_id != ""

    def test_queued_item_has_consume_id(self) -> None:
        feedback = Feedback(source=UserUIFeedbackSource(user_id=1, user_feedback="fix it"))

        assert self._enqueue(run_id=4747, feedback=feedback) is True

        queued = peek_queued_autofix_feedback(4747)
        assert len(queued[0].consume_id) == 32

    def test_pop_drains_the_queue(self) -> None:
        first = Feedback(source=UserUIFeedbackSource(user_id=1, user_feedback="first"))
        second = Feedback(source=UserUIFeedbackSource(user_id=1, user_feedback="second"))
        self._enqueue(run_id=4848, feedback=first)
        self._enqueue(run_id=4848, feedback=second)

        items = pop_queued_autofix_feedback(4848)

        assert [item.feedback.text for item in items] == ["first", "second"]
        assert peek_queued_autofix_feedback(4848) == []

    def test_clear_empties_the_queue(self) -> None:
        feedback = Feedback(source=UserUIFeedbackSource(user_id=1, user_feedback="fix it"))
        self._enqueue(run_id=4949, feedback=feedback)

        clear_queued_autofix_feedback(4949)

        assert peek_queued_autofix_feedback(4949) == []

    @patch("sentry.seer.autofix.pr_iteration.queue.emit_pr_iteration_details_started")
    def test_enqueue_still_pushes_when_queue_lock_times_out(self, mock_started: MagicMock) -> None:
        feedback = Feedback(source=UserUIFeedbackSource(user_id=1, user_feedback="fix it"))

        with patch(
            "sentry.seer.autofix.pr_iteration.queue._holding_queue_lock",
            side_effect=UnableToAcquireLock("timeout"),
        ):
            assert self._enqueue(run_id=5050, feedback=feedback) is True

        queued = peek_queued_autofix_feedback(5050)
        assert len(queued) == 1
        assert queued[0].feedback.text == "fix it"
        mock_started.assert_called_once()


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
