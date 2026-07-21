from unittest.mock import MagicMock, patch

import orjson

from sentry.scm.types import CheckSuiteEvent
from sentry.seer.agent.client_models import MemoryBlock, Message, RepoPRState, SeerRunState
from sentry.seer.autofix.constants import AutofixReferrer
from sentry.seer.autofix.pr_iteration.check_suites import (
    CheckSuiteAutofixRun,
    GithubCheckSuiteEvent,
    resolve_check_suite_autofix_run,
)
from sentry.seer.autofix.pr_iteration.feedback import Feedback, serialize_feedback
from sentry.seer.autofix.pr_iteration.feedback_sources.base import ConsumeTask
from sentry.seer.autofix.pr_iteration.feedback_sources.check_suite import CheckSuiteFeedbackSource
from sentry.seer.autofix.pr_iteration.feedback_sources.github_comment import (
    GithubPrReviewCommentFeedbackSource,
    GithubPullRequestReviewComment,
)
from sentry.seer.autofix.pr_iteration.feedback_sources.user_ui import UserUIFeedbackSource
from sentry.seer.autofix.pr_iteration.listeners.check_suite import (
    pr_iteration_from_check_suite_listener,
)
from sentry.testutils.cases import TestCase

CHECK_PATH = "sentry.seer.autofix.pr_iteration.listeners.check_suite"
CHECK_SUITE_SOURCE_PATH = "sentry.seer.autofix.pr_iteration.feedback_sources.check_suite"
CHECK_SUITES_PATH = "sentry.seer.autofix.pr_iteration.check_suites"
# Lazy-imported inside the listener (must not load at AppConfig.ready).
TRIGGER_CONSUME_PATH = "sentry.tasks.seer.pr_iteration.trigger_consume_pr_iteration_feedback"


class PrIterationFromCheckSuiteListenerTest(TestCase):
    def setUp(self) -> None:
        super().setUp()
        self.group = self.create_group(project=self.project)

    def _event(
        self, raw: dict | None = None, *, action="completed", conclusion="failure"
    ) -> CheckSuiteEvent:
        return CheckSuiteEvent(
            action=action,
            check_suite={
                "id": "1",
                "status": "completed",
                "conclusion": conclusion,
                "html_url": "",
                "pull_request_ids": [],
            },
            subscription_event={
                "event": orjson.dumps(raw or {}).decode(),
                "event_type_hint": "check_suite",
                "extra": {},
                "received_at": 0,
                "sentry_meta": None,
                "type": "github",
            },
        )

    def _raw(self, *, pull_requests: list[dict] | None = None) -> dict:
        return {
            "check_suite": {
                "id": 1,
                "head_sha": "abc",
                "check_runs_url": "https://github.com/owner/repo/check-runs",
                "app": {"name": "CI"},
                "updated_at": "2024-01-01T00:00:00Z",
                "pull_requests": pull_requests or [],
            },
            "repository": {"html_url": "https://github.com/owner/repo"},
        }

    def _agent_state(self) -> SeerRunState:
        return SeerRunState(
            run_id=67890,
            blocks=[],
            status="completed",
            updated_at="2024-01-01T00:00:00Z",
            repo_pr_states={"owner/repo": RepoPRState(repo_name="owner/repo", commit_sha="abc")},
            metadata={"group_id": self.group.id},
        )

    @patch(f"{CHECK_SUITES_PATH}.get_agent_state_from_pr_id")
    def test_skips_non_completed_action(self, mock_get_state: MagicMock) -> None:
        pr_iteration_from_check_suite_listener(self._event(action="requested"))
        mock_get_state.assert_not_called()

    @patch(f"{CHECK_SUITES_PATH}.get_agent_state_from_pr_id")
    def test_skips_uninteresting_conclusion(self, mock_get_state: MagicMock) -> None:
        pr_iteration_from_check_suite_listener(self._event(conclusion="cancelled"))
        mock_get_state.assert_not_called()

    @patch(f"{CHECK_PATH}.request_review_for_green_check_suite")
    @patch(f"{CHECK_SUITES_PATH}.get_agent_state_from_pr_id")
    def test_green_conclusion_routes_to_review_request(
        self, mock_get_state: MagicMock, mock_request_review: MagicMock
    ) -> None:
        event = self._event(self._raw(), conclusion="success")

        pr_iteration_from_check_suite_listener(event)

        mock_request_review.assert_called_once_with(event)
        mock_get_state.assert_not_called()

    @patch(f"{CHECK_SUITES_PATH}.resolve_check_suite_repositories", return_value=[])
    @patch(f"{CHECK_SUITES_PATH}.get_agent_state_from_pr_id")
    def test_no_repository(self, mock_get_state: MagicMock, _mock_resolve: MagicMock) -> None:
        pr_iteration_from_check_suite_listener(self._event(self._raw()))
        mock_get_state.assert_not_called()

    @patch(f"{CHECK_PATH}.sentry_sdk.capture_exception")
    @patch(f"{CHECK_SUITES_PATH}.get_agent_state_from_pr_id")
    def test_invalid_payload_captures_and_returns(
        self, mock_get_state: MagicMock, mock_capture: MagicMock
    ) -> None:
        # Missing required check_suite fields (head_sha, check_runs_url, app).
        raw = {"check_suite": {"id": 1}, "repository": {"html_url": "https://github.com/o/r"}}
        pr_iteration_from_check_suite_listener(self._event(raw))
        mock_capture.assert_called_once()
        mock_get_state.assert_not_called()

    @patch(f"{CHECK_PATH}.sentry_sdk.capture_exception")
    @patch(f"{CHECK_SUITES_PATH}.get_agent_state_from_pr_id")
    def test_invalid_json_captures_and_returns(
        self, mock_get_state: MagicMock, mock_capture: MagicMock
    ) -> None:
        event = self._event()
        event.subscription_event["event"] = "not-json"
        pr_iteration_from_check_suite_listener(event)
        mock_capture.assert_called_once()
        mock_get_state.assert_not_called()

    @patch(f"{CHECK_PATH}.try_enqueue_autofix_feedback")
    @patch(f"{CHECK_SUITES_PATH}.get_agent_state_from_pr_id", return_value=None)
    @patch(f"{CHECK_SUITES_PATH}.resolve_check_suite_repositories")
    def test_skips_pr_without_run(
        self,
        mock_resolve: MagicMock,
        _mock_get_state: MagicMock,
        mock_enqueue: MagicMock,
    ) -> None:
        mock_resolve.return_value = [MagicMock(organization_id=self.organization.id)]
        raw = self._raw(pull_requests=[{"id": 555}])

        pr_iteration_from_check_suite_listener(self._event(raw))

        mock_enqueue.assert_not_called()

    @patch(f"{CHECK_PATH}.try_enqueue_autofix_feedback")
    @patch(f"{CHECK_SUITES_PATH}.get_agent_state_from_pr_id")
    @patch(f"{CHECK_SUITES_PATH}.resolve_check_suite_repositories")
    def test_skips_run_missing_group_id(
        self,
        mock_resolve: MagicMock,
        mock_get_state: MagicMock,
        mock_enqueue: MagicMock,
    ) -> None:
        mock_resolve.return_value = [MagicMock(organization_id=self.organization.id)]
        state = self._agent_state()
        state.metadata = {}
        mock_get_state.return_value = state
        raw = self._raw(pull_requests=[{"id": 555}])

        pr_iteration_from_check_suite_listener(self._event(raw))

        mock_enqueue.assert_not_called()

    @patch(TRIGGER_CONSUME_PATH)
    @patch(f"{CHECK_PATH}.try_enqueue_autofix_feedback", return_value=False)
    @patch(f"{CHECK_SUITES_PATH}.get_agent_state_from_pr_id")
    @patch(f"{CHECK_SUITES_PATH}.resolve_check_suite_repositories")
    def test_does_not_trigger_when_not_enqueued(
        self,
        mock_resolve: MagicMock,
        mock_get_state: MagicMock,
        _mock_enqueue: MagicMock,
        mock_trigger_consume: MagicMock,
    ) -> None:
        mock_resolve.return_value = [MagicMock(organization_id=self.organization.id, id=2)]
        mock_get_state.return_value = self._agent_state()
        raw = self._raw(pull_requests=[{"id": 555}])

        pr_iteration_from_check_suite_listener(self._event(raw))

        mock_trigger_consume.assert_not_called()

    @patch(TRIGGER_CONSUME_PATH)
    @patch(f"{CHECK_PATH}.try_enqueue_autofix_feedback", return_value=True)
    @patch(f"{CHECK_SUITES_PATH}.get_agent_state_from_pr_id")
    @patch(f"{CHECK_SUITES_PATH}.resolve_check_suite_repositories")
    def test_enqueues_and_triggers_for_matched_run(
        self,
        mock_resolve: MagicMock,
        mock_get_state: MagicMock,
        mock_enqueue: MagicMock,
        mock_trigger_consume: MagicMock,
    ) -> None:
        mock_resolve.return_value = [MagicMock(organization_id=self.organization.id, id=2)]
        mock_get_state.return_value = self._agent_state()
        raw = self._raw(pull_requests=[{"id": 555}])

        pr_iteration_from_check_suite_listener(self._event(raw))

        mock_enqueue.assert_called_once()
        _, kwargs = mock_enqueue.call_args
        assert kwargs["run_id"] == 67890
        assert kwargs["referrer"] == AutofixReferrer.GITHUB_CHECK_SUITE
        assert isinstance(kwargs["feedback"], Feedback)
        assert isinstance(kwargs["feedback"].source, CheckSuiteFeedbackSource)
        assert kwargs["feedback"].source.updated_at == "2024-01-01T00:00:00Z"
        assert kwargs["feedback"].source.event.check_suite.updated_at == "2024-01-01T00:00:00Z"
        autofix = kwargs["feedback"].source.autofix_run
        assert autofix is not None
        assert autofix.repository.organization_id == self.organization.id
        assert autofix.repository.id == 2
        assert autofix.run_state is not None
        mock_trigger_consume.assert_called_once()

    @patch(f"{CHECK_SUITES_PATH}.sentry_sdk.capture_exception")
    @patch(TRIGGER_CONSUME_PATH)
    @patch(f"{CHECK_PATH}.try_enqueue_autofix_feedback", return_value=True)
    @patch(f"{CHECK_SUITES_PATH}.get_agent_state_from_pr_id")
    @patch(f"{CHECK_SUITES_PATH}.resolve_check_suite_repositories")
    def test_seer_error_on_one_pr_continues_to_remaining(
        self,
        mock_resolve: MagicMock,
        mock_get_state: MagicMock,
        mock_enqueue: MagicMock,
        mock_trigger_consume: MagicMock,
        mock_capture: MagicMock,
    ) -> None:
        from sentry.seer.models import SeerApiError

        mock_resolve.return_value = [MagicMock(organization_id=self.organization.id, id=2)]
        error = SeerApiError("transient", 500)
        mock_get_state.side_effect = [error, self._agent_state()]
        raw = self._raw(pull_requests=[{"id": 111}, {"id": 222}])

        pr_iteration_from_check_suite_listener(self._event(raw))

        assert mock_get_state.call_count == 2
        mock_capture.assert_called_once_with(error)
        mock_enqueue.assert_called_once()
        mock_trigger_consume.assert_called_once()

    @patch(TRIGGER_CONSUME_PATH)
    @patch(f"{CHECK_PATH}.try_enqueue_autofix_feedback", return_value=True)
    @patch(f"{CHECK_SUITES_PATH}.get_agent_state_from_pr_id")
    @patch(f"{CHECK_SUITES_PATH}.resolve_check_suite_repositories")
    def test_tries_each_org_until_agent_state_found(
        self,
        mock_resolve: MagicMock,
        mock_get_state: MagicMock,
        mock_enqueue: MagicMock,
        mock_trigger_consume: MagicMock,
    ) -> None:
        wrong_org_repo = MagicMock(organization_id=111, id=1)
        right_org_repo = MagicMock(organization_id=self.organization.id, id=2)
        mock_resolve.return_value = [wrong_org_repo, right_org_repo]
        mock_get_state.side_effect = [None, self._agent_state()]
        raw = self._raw(pull_requests=[{"id": 555}])

        pr_iteration_from_check_suite_listener(self._event(raw))

        assert mock_get_state.call_count == 2
        mock_get_state.assert_any_call(111, "integrations:github", 555)
        mock_get_state.assert_any_call(self.organization.id, "integrations:github", 555)
        _, kwargs = mock_enqueue.call_args
        assert kwargs["organization_id"] == self.organization.id
        mock_trigger_consume.assert_called_once()


class ResolveCheckSuiteAutofixRunTest(TestCase):
    def _event(self, *, pull_requests: list[dict]) -> GithubCheckSuiteEvent:
        return GithubCheckSuiteEvent.parse_obj(
            {
                "check_suite": {
                    "id": 1,
                    "head_sha": "abc",
                    "check_runs_url": "https://github.com/owner/repo/check-runs",
                    "app": {"name": "CI"},
                    "updated_at": "2024-01-01T00:00:00Z",
                    "pull_requests": pull_requests,
                },
                "repository": {"html_url": "https://github.com/owner/repo"},
            }
        )

    def _agent_state(self, *, run_id: int) -> SeerRunState:
        return SeerRunState(
            run_id=run_id,
            blocks=[],
            status="completed",
            updated_at="2024-01-01T00:00:00Z",
            repo_pr_states={"owner/repo": RepoPRState(repo_name="owner/repo", commit_sha="abc")},
            metadata={"group_id": 1},
        )

    @patch(f"{CHECK_SUITES_PATH}.logger")
    @patch(f"{CHECK_SUITES_PATH}.get_agent_state_from_pr_id")
    @patch(f"{CHECK_SUITES_PATH}.resolve_check_suite_repositories")
    def test_warns_and_returns_first_when_multiple_matches(
        self,
        mock_resolve: MagicMock,
        mock_get_state: MagicMock,
        mock_logger: MagicMock,
    ) -> None:
        repo = MagicMock(organization_id=self.organization.id, id=2)
        mock_resolve.return_value = [repo]
        first = self._agent_state(run_id=111)
        second = self._agent_state(run_id=222)
        mock_get_state.side_effect = [first, second]

        result = resolve_check_suite_autofix_run(
            self._event(pull_requests=[{"id": 111}, {"id": 222}])
        )

        assert result is not None
        assert result.run_state.run_id == 111
        assert result.pr_id == 111
        mock_logger.warning.assert_any_call(
            "autofix.pr_iteration.check_suite.multiple_autofix_runs",
            extra={
                "match_count": 2,
                "pr_ids": [111, 222],
                "run_ids": [111, 222],
                "organization_ids": [self.organization.id, self.organization.id],
            },
        )


def _run_state(*, blocks: list[MemoryBlock] | None = None) -> SeerRunState:
    return SeerRunState(
        run_id=1,
        blocks=blocks or [],
        status="completed",
        updated_at="2024-01-01T00:00:00Z",
    )


def _autofix_run(*, blocks: list[MemoryBlock] | None = None) -> CheckSuiteAutofixRun:
    return CheckSuiteAutofixRun(
        repository=MagicMock(organization_id=1, id=2),
        run_state=_run_state(blocks=blocks or []),
        pr_id=1,
        group_id=1,
    )


def _check_suite_source() -> CheckSuiteFeedbackSource:
    source = CheckSuiteFeedbackSource(
        event={
            "check_suite": {
                "id": 1,
                "head_sha": "abc",
                "check_runs_url": "https://github.com/owner/repo/check-runs",
                "app": {"name": "CI"},
                "updated_at": "2024-01-01T00:00:00Z",
            },
            "repository": {
                "html_url": "https://github.com/owner/repo",
                "full_name": "owner/repo",
            },
        },
    )
    with patch(
        f"{CHECK_SUITE_SOURCE_PATH}.resolve_check_suite_autofix_run", return_value=_autofix_run()
    ):
        _ = source.autofix_run
    return source


def _check_suite_feedback() -> Feedback:
    return Feedback(source=_check_suite_source())


def _review_comment_feedback(*, author_is_bot: bool) -> Feedback:
    """An inline review-comment feedback item, from a bot or a human reviewer.

    Bot reviews are automated (they share the streak with check suites); human
    reviews break it.
    """
    return Feedback(
        source=GithubPrReviewCommentFeedbackSource(
            comment=GithubPullRequestReviewComment(id=1, body="fix this"),
            author_is_bot=author_is_bot,
        )
    )


def _iteration_block(index: int, *feedbacks: Feedback) -> MemoryBlock:
    return MemoryBlock(
        id=f"iter-{index}",
        message=Message(
            role="assistant",
            metadata={
                "step": "pr_iteration",
                "iteration_index": str(index),
                "feedback": serialize_feedback(feedbacks),
            },
        ),
        timestamp="2024-01-01T00:00:00Z",
    )


def _empty_feedback_iteration_block(index: int) -> MemoryBlock:
    """PR_ITERATION whose feedback metadata parses to no items."""
    return MemoryBlock(
        id=f"iter-{index}",
        message=Message(
            role="assistant",
            metadata={
                "step": "pr_iteration",
                "iteration_index": str(index),
                "feedback": "[]",
            },
        ),
        timestamp="2024-01-01T00:00:00Z",
    )


class CheckSuiteHardCapTest(TestCase):
    # Consecutive-automated-iteration streak cap, shared with the review path and
    # backed by ``autofix.pr-iteration.max-iterations``. Set small so a few blocks
    # trip it.
    CAP = 3

    def setUp(self) -> None:
        super().setUp()
        self._options_ctx = self.options({"autofix.pr-iteration.max-iterations": self.CAP})
        self._options_ctx.__enter__()
        self.addCleanup(lambda: self._options_ctx.__exit__(None, None, None))

    def _source(self) -> CheckSuiteFeedbackSource:
        return _check_suite_source()

    def _run_state_on_head(self, *, blocks: list[MemoryBlock]) -> SeerRunState:
        state = _run_state(blocks=blocks)
        state.repo_pr_states = {"owner/repo": RepoPRState(repo_name="owner/repo", commit_sha="abc")}
        return state

    def test_none_when_cap_reached(self) -> None:
        blocks = [_iteration_block(i, _check_suite_feedback()) for i in range(self.CAP)]

        assert self._source().should_trigger(_run_state(blocks=blocks)) is None

    def test_should_queue_false_when_cap_reached(self) -> None:
        blocks = [_iteration_block(i, _check_suite_feedback()) for i in range(self.CAP)]

        assert not self._source().should_queue(self._run_state_on_head(blocks=blocks))

    @patch(f"{CHECK_SUITES_PATH}.iter_all_pages", return_value=[{"data": []}])
    @patch(f"{CHECK_SUITES_PATH}.ListCheckRunsForRefProtocol", object)
    @patch("sentry.scm.factory.new")
    def test_not_capped_when_fewer_than_cap_iterations(self, mock_new: MagicMock, _pages) -> None:
        mock_new.return_value = MagicMock()
        blocks = [_iteration_block(i, _check_suite_feedback()) for i in range(self.CAP - 1)]

        assert self._source().should_trigger(_run_state(blocks=blocks)) == ConsumeTask.Now

    @patch(f"{CHECK_SUITES_PATH}.iter_all_pages", return_value=[{"data": []}])
    @patch(f"{CHECK_SUITES_PATH}.ListCheckRunsForRefProtocol", object)
    @patch("sentry.scm.factory.new")
    def test_not_capped_when_one_iteration_has_human_feedback(
        self, mock_new: MagicMock, _pages
    ) -> None:
        # A human UI iteration mixed into the last N breaks the automated streak.
        mock_new.return_value = MagicMock()
        blocks = [_iteration_block(i, _check_suite_feedback()) for i in range(self.CAP - 1)]
        blocks.append(
            _iteration_block(
                self.CAP,
                _check_suite_feedback(),
                Feedback(source=UserUIFeedbackSource(user_id=1, user_feedback="fix it")),
            )
        )

        assert self._source().should_trigger(_run_state(blocks=blocks)) == ConsumeTask.Now

    def test_only_last_n_iterations_considered(self) -> None:
        blocks = [_iteration_block(0, Feedback(source=UserUIFeedbackSource(user_id=1)))]
        blocks += [_iteration_block(i, _check_suite_feedback()) for i in range(1, self.CAP + 1)]

        assert self._source().should_trigger(_run_state(blocks=blocks)) is None

    def test_none_when_mixed_automated_streak_reaches_cap(self) -> None:
        # Check suites and bot reviews share one streak: a mix of the two that
        # totals CAP consecutive automated iterations trips the cap.
        assert self.CAP >= 2
        blocks = [_iteration_block(i, _check_suite_feedback()) for i in range(self.CAP - 1)]
        blocks.append(_iteration_block(self.CAP - 1, _review_comment_feedback(author_is_bot=True)))

        assert self._source().should_trigger(_run_state(blocks=blocks)) is None

    @patch(f"{CHECK_SUITES_PATH}.iter_all_pages", return_value=[{"data": []}])
    @patch(f"{CHECK_SUITES_PATH}.ListCheckRunsForRefProtocol", object)
    @patch("sentry.scm.factory.new")
    def test_not_capped_when_human_review_breaks_mixed_streak(
        self, mock_new: MagicMock, _pages
    ) -> None:
        # A human review mixed into the automated (check-suite + bot-review) streak
        # resets it, so check-suite iteration resumes even at CAP iterations.
        mock_new.return_value = MagicMock()
        blocks = [_iteration_block(0, _check_suite_feedback())]
        blocks.append(_iteration_block(1, _review_comment_feedback(author_is_bot=False)))
        blocks += [
            _iteration_block(i, _review_comment_feedback(author_is_bot=True))
            for i in range(2, self.CAP + 1)
        ]

        assert self._source().should_trigger(_run_state(blocks=blocks)) == ConsumeTask.Now

    @patch(f"{CHECK_SUITES_PATH}.iter_all_pages", return_value=[{"data": []}])
    @patch(f"{CHECK_SUITES_PATH}.ListCheckRunsForRefProtocol", object)
    @patch("sentry.scm.factory.new")
    def test_cap_disabled_when_zero(self, mock_new: MagicMock, _pages) -> None:
        mock_new.return_value = MagicMock()
        blocks = [_iteration_block(i, _check_suite_feedback()) for i in range(10)]

        with self.options({"autofix.pr-iteration.max-iterations": 0}):
            assert self._source().should_trigger(_run_state(blocks=blocks)) == ConsumeTask.Now

    @patch(f"{CHECK_SUITES_PATH}.iter_all_pages", return_value=[{"data": []}])
    @patch(f"{CHECK_SUITES_PATH}.ListCheckRunsForRefProtocol", object)
    @patch("sentry.scm.factory.new")
    def test_empty_after_parse_iteration_counts_as_automated(
        self, mock_new: MagicMock, _pages
    ) -> None:
        mock_new.return_value = MagicMock()
        # An iteration whose feedback parses to [] is a metadata gap, not human
        # input: it must not reset the automated streak (``iteration_is_automated``
        # treats no-feedback as automated), so a full window still trips the cap.
        blocks = [_iteration_block(i, _check_suite_feedback()) for i in range(self.CAP - 1)]
        blocks.append(_empty_feedback_iteration_block(self.CAP - 1))

        assert self._source().should_trigger(_run_state(blocks=blocks)) is None
