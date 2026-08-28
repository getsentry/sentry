from typing import Any
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
from sentry.seer.autofix.pr_iteration.mention import handle_issue_comment_for_autofix_iteration
from sentry.seer.autofix.pr_iteration.pause import is_pr_iteration_paused
from sentry.seer.autofix.pr_iteration.queue import (
    _parse_queued_item,
    peek_queued_autofix_feedback,
    try_enqueue_autofix_feedback,
)
from sentry.testutils.cases import TestCase
from sentry.utils import json

CHECK_SUITE_SOURCE_PATH = "sentry.seer.autofix.pr_iteration.feedback_sources.check_suite"
QUEUE_PATH = "sentry.seer.autofix.pr_iteration.queue"
PAUSE_PATH = "sentry.seer.autofix.pr_iteration.pause"
TASK_PATH = "sentry.tasks.seer.pr_iteration"
STOP_RUN_ID = 4646


class _CommentScmStub:
    """Spec that lets the mock SCM pass the task's protocol checks."""

    def get_pull_request(self, *args: Any, **kwargs: Any) -> Any: ...

    def create_pull_request_comment(self, *args: Any, **kwargs: Any) -> Any: ...


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


class StopCommandEndToEndTest(TestCase):
    """Drive the webhook processor so the parser and both tasks run for real."""

    def setUp(self) -> None:
        super().setUp()
        self.repo = self.create_repo(
            project=self.project,
            provider="integrations:github",
            external_id="123",
            name="owner/repo",
        )
        self.create_seer_run(
            organization=self.organization, seer_run_state_id=STOP_RUN_ID, user_id=self.user.id
        )
        self.group = self.create_group(project=self.project)

    def _event(self, body: str) -> dict:
        return {
            "action": "created",
            "comment": {
                "id": 999,
                "body": body,
                "user": {"login": "octocat"},
                "html_url": "https://github.com/owner/repo/pull/7#issuecomment-999",
            },
            "issue": {"number": 7, "pull_request": {"url": "https://example.com/pulls/7"}},
        }

    def _agent_state(self) -> SeerRunState:
        return SeerRunState(
            run_id=STOP_RUN_ID,
            blocks=[],
            status="completed",
            updated_at="2024-01-01T00:00:00Z",
            repo_pr_states={
                "owner/repo": RepoPRState(
                    repo_name="owner/repo", pr_url="https://example.com/pull/7"
                )
            },
            metadata={"group_id": self.group.id},
        )

    def _handle(self, body: str) -> None:
        with self.feature("organizations:autofix-pr-iteration-manual"), self.tasks():
            handle_issue_comment_for_autofix_iteration(
                event=self._event(body),
                organization=self.organization,
                repo=self.repo,
                integration=MagicMock(id=42, provider="github"),
            )

    def test_iterate_comment_after_stop_comment_does_not_consume(self) -> None:
        with (
            patch(f"{TASK_PATH}.get_agent_state_from_pr_id", return_value=self._agent_state()),
            patch(f"{TASK_PATH}.make_scm", return_value=MagicMock(spec=_CommentScmStub)),
            patch(f"{TASK_PATH}.scm_actions") as mock_actions,
            patch(f"{TASK_PATH}._github_commenter_has_repo_write_access", return_value=True),
            patch(f"{TASK_PATH}._add_comment_reaction"),
            patch(f"{TASK_PATH}.consume_queued_autofix_feedback.apply_async") as mock_consume,
            patch(f"{PAUSE_PATH}.metrics") as mock_metrics,
        ):
            mock_actions.get_pull_request.return_value = {"data": {"internal_id": "555"}}
            self._handle("@sentry stop iterating")
            self._handle("@sentry fix the lint error")

        assert is_pr_iteration_paused(run_id=STOP_RUN_ID, organization_id=self.organization.id)
        mock_consume.assert_not_called()
        # The stop is enforced at the trigger task, before the feedback is
        # queued — the later `trigger_consume` and `consume` gates never see it.
        assert peek_queued_autofix_feedback(STOP_RUN_ID) == []
        mock_metrics.incr.assert_any_call(
            "autofix.pr_iteration.paused.blocked", tags={"gate": "comment_trigger"}
        )


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
