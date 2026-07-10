from typing import Any, Literal
from unittest.mock import MagicMock, patch

from sentry.seer.agent.client_models import MemoryBlock, Message, RepoPRState, SeerRunState
from sentry.seer.autofix.autofix_agent import (
    PrIterationNoPullRequestException,
)
from sentry.seer.autofix.constants import AutofixReferrer
from sentry.seer.autofix.pr_iteration.feedback_queue import QueuedAutofixFeedback
from sentry.seer.autofix.pr_iteration.types import (
    Feedback,
    GithubPrCommentFeedbackSource,
    GithubPrReviewCommentFeedbackSource,
    UserUIFeedbackSource,
    serialize_feedback,
)
from sentry.seer.models import SeerApiError
from sentry.tasks.seer.pr_iteration import (
    consume_queued_autofix_feedback,
    trigger_consume_pr_iteration_feedback,
    trigger_pr_iteration_from_comment,
)
from sentry.testutils.cases import TestCase

TASK_PATH = "sentry.tasks.seer.pr_iteration"


class TriggerPrIterationFromCommentTest(TestCase):
    def setUp(self) -> None:
        super().setUp()
        self.group = self.create_group(project=self.project)
        self.repo = self.create_repo(
            project=self.project,
            provider="integrations:github",
            external_id="123",
            name="owner/repo",
        )
        self.comment = {"id": 999, "body": "@sentry fix it", "user": {"login": "octocat"}}
        self.feedback = Feedback(source=GithubPrCommentFeedbackSource(comment=self.comment))

    def _agent_state(self) -> SeerRunState:
        return SeerRunState(
            run_id=67890,
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

    def _mock_integration(self, pr_id: int | None = 555) -> MagicMock:
        mock_client = MagicMock()
        mock_client.get_pull_request.return_value = {"id": pr_id}
        mock_integration = MagicMock()
        mock_integration.get_installation.return_value.get_client.return_value = mock_client
        return mock_integration

    def _call(self) -> None:
        trigger_pr_iteration_from_comment(
            organization_id=self.organization.id,
            repo_id=self.repo.id,
            integration_id=42,
            pr_number=7,
            feedback=self.feedback.json(),
        )

    @patch(f"{TASK_PATH}._add_comment_eyes_reaction")
    @patch(f"{TASK_PATH}.make_scm")
    @patch(f"{TASK_PATH}._github_commenter_has_repo_write_access", return_value=True)
    @patch(f"{TASK_PATH}.trigger_consume_pr_iteration_feedback")
    @patch(f"{TASK_PATH}.try_enqueue_autofix_feedback", return_value=True)
    @patch(f"{TASK_PATH}.get_agent_state_from_pr_id")
    @patch(f"{TASK_PATH}.integration_service.get_integration")
    def test_triggers_agent_when_authorized(
        self,
        mock_get_integration: MagicMock,
        mock_get_state: MagicMock,
        mock_enqueue: MagicMock,
        mock_trigger_consume: MagicMock,
        mock_has_access: MagicMock,
        mock_make_scm: MagicMock,
        mock_reaction: MagicMock,
    ) -> None:
        mock_integration = self._mock_integration()
        mock_get_integration.return_value = mock_integration
        agent_state = self._agent_state()
        mock_get_state.return_value = agent_state

        self._call()

        mock_has_access.assert_called_once_with(
            mock_make_scm.return_value,
            "octocat",
        )
        mock_enqueue.assert_called_once()
        _, kwargs = mock_enqueue.call_args
        assert kwargs["run_id"] == 67890
        assert kwargs["organization_id"] == self.organization.id
        assert kwargs["group_id"] == self.group.id
        assert kwargs["referrer"] == AutofixReferrer.GITHUB_PR_COMMENT
        assert kwargs["run_state"] is agent_state
        assert kwargs["feedback"].text == "fix it"
        source = kwargs["feedback"].source
        assert isinstance(source, GithubPrCommentFeedbackSource)
        # The comment was parsed into feedback once at mention time and threaded
        # through, so the source stores it rather than re-parsing the body.
        assert source.comment_feedback == "fix it"

        mock_trigger_consume.assert_called_once()
        _, consume_kwargs = mock_trigger_consume.call_args
        assert consume_kwargs["run_id"] == 67890
        assert consume_kwargs["organization_id"] == self.organization.id
        assert consume_kwargs["run_state"] is agent_state

        mock_reaction.assert_called_once_with(
            mock_make_scm.return_value,
            source_type="github-pr-comment",
            pr_number=7,
            comment_id=999,
        )

    @patch(f"{TASK_PATH}.make_scm")
    @patch(f"{TASK_PATH}._github_commenter_has_repo_write_access", return_value=False)
    @patch(f"{TASK_PATH}.trigger_consume_pr_iteration_feedback")
    @patch(f"{TASK_PATH}.try_enqueue_autofix_feedback", return_value=True)
    @patch(f"{TASK_PATH}.get_agent_state_from_pr_id")
    @patch(f"{TASK_PATH}.integration_service.get_integration")
    def test_skips_when_no_write_access(
        self,
        mock_get_integration: MagicMock,
        mock_get_state: MagicMock,
        mock_enqueue: MagicMock,
        mock_trigger_consume: MagicMock,
        mock_has_access: MagicMock,
        mock_make_scm: MagicMock,
    ) -> None:
        mock_get_integration.return_value = self._mock_integration()
        mock_get_state.return_value = self._agent_state()

        self._call()

        mock_has_access.assert_called_once_with(mock_make_scm.return_value, "octocat")
        mock_enqueue.assert_not_called()
        mock_trigger_consume.assert_not_called()

    @patch(f"{TASK_PATH}._github_commenter_has_repo_write_access")
    @patch(f"{TASK_PATH}.trigger_consume_pr_iteration_feedback")
    @patch(f"{TASK_PATH}.try_enqueue_autofix_feedback", return_value=True)
    @patch(f"{TASK_PATH}.get_agent_state_from_pr_id")
    @patch(f"{TASK_PATH}.integration_service.get_integration")
    def test_skips_when_no_agent_state(
        self,
        mock_get_integration: MagicMock,
        mock_get_state: MagicMock,
        mock_enqueue: MagicMock,
        mock_trigger_consume: MagicMock,
        mock_has_access: MagicMock,
    ) -> None:
        mock_get_integration.return_value = self._mock_integration()
        mock_get_state.return_value = None

        self._call()

        mock_has_access.assert_not_called()
        mock_enqueue.assert_not_called()
        mock_trigger_consume.assert_not_called()

    @patch(f"{TASK_PATH}._add_comment_eyes_reaction")
    @patch(f"{TASK_PATH}.make_scm")
    @patch(f"{TASK_PATH}._github_commenter_has_repo_write_access", return_value=True)
    @patch(f"{TASK_PATH}.trigger_consume_pr_iteration_feedback")
    @patch(f"{TASK_PATH}.try_enqueue_autofix_feedback", return_value=True)
    @patch(f"{TASK_PATH}.get_agent_state_from_pr_id")
    @patch(f"{TASK_PATH}.integration_service.get_integration")
    def test_triggers_comment_reaction(
        self,
        mock_get_integration: MagicMock,
        mock_get_state: MagicMock,
        mock_enqueue: MagicMock,
        mock_trigger_consume: MagicMock,
        mock_has_access: MagicMock,
        mock_make_scm: MagicMock,
        mock_reaction: MagicMock,
    ) -> None:
        mock_integration = self._mock_integration()
        mock_get_integration.return_value = mock_integration
        mock_get_state.return_value = self._agent_state()

        self._call()

        mock_enqueue.assert_called_once()
        mock_reaction.assert_called_once_with(
            mock_make_scm.return_value,
            source_type="github-pr-comment",
            pr_number=7,
            comment_id=999,
        )


class ConsumeQueuedAutofixFeedbackTest(TestCase):
    def setUp(self) -> None:
        super().setUp()
        self.group = self.create_group(project=self.project)

    def _state(
        self,
        *,
        status: Literal["processing", "completed", "error", "awaiting_user_input"] = "completed",
        metadata: dict[str, Any] | None = None,
        blocks: list[MemoryBlock] | None = None,
    ) -> SeerRunState:
        return SeerRunState(
            run_id=67890,
            blocks=blocks or [],
            status=status,
            updated_at="2024-01-01T00:00:00Z",
            metadata={"group_id": self.group.id} if metadata is None else metadata,
        )

    def _queued(self, feedback: Feedback) -> QueuedAutofixFeedback:
        return QueuedAutofixFeedback(
            organization_id=self.organization.id,
            group_id=self.group.id,
            feedback=feedback,
            referrer=AutofixReferrer.GITHUB_PR_COMMENT,
        )

    def _review_feedback(self, comment_id: int) -> Feedback:
        return Feedback(
            source=GithubPrReviewCommentFeedbackSource(
                comment={
                    "id": comment_id,
                    "body": "@sentry fix it",
                    "path": "src/sentry/foo.py",
                    "line": 42,
                },
            )
        )

    def _call(self) -> None:
        consume_queued_autofix_feedback(run_id=67890, organization_id=self.organization.id)

    @patch(f"{TASK_PATH}.trigger_autofix_agent")
    @patch(f"{TASK_PATH}.pop_queued_autofix_feedback")
    @patch(f"{TASK_PATH}.fetch_run_status")
    def test_triggers_with_group_from_metadata(
        self,
        mock_fetch: MagicMock,
        mock_pop: MagicMock,
        mock_trigger: MagicMock,
    ) -> None:
        mock_fetch.return_value = self._state()
        mock_pop.return_value = [
            self._queued(Feedback(source=UserUIFeedbackSource(user_id=1, user_feedback="fix it")))
        ]

        self._call()

        mock_trigger.assert_called_once()
        _, kwargs = mock_trigger.call_args
        assert kwargs["group"].id == self.group.id
        assert [f.text for f in kwargs["feedback"]] == ["fix it"]

    @patch(f"{TASK_PATH}.trigger_autofix_agent")
    @patch(f"{TASK_PATH}.pop_queued_autofix_feedback")
    @patch(f"{TASK_PATH}.fetch_run_status")
    def test_returns_when_group_id_missing(
        self,
        mock_fetch: MagicMock,
        mock_pop: MagicMock,
        mock_trigger: MagicMock,
    ) -> None:
        mock_fetch.return_value = self._state(metadata={})

        self._call()

        mock_pop.assert_not_called()
        mock_trigger.assert_not_called()

    @patch(f"{TASK_PATH}.trigger_autofix_agent")
    @patch(f"{TASK_PATH}.pop_queued_autofix_feedback")
    @patch(f"{TASK_PATH}.fetch_run_status")
    def test_returns_when_processing(
        self,
        mock_fetch: MagicMock,
        mock_pop: MagicMock,
        mock_trigger: MagicMock,
    ) -> None:
        mock_fetch.return_value = self._state(status="processing")

        self._call()

        mock_pop.assert_not_called()
        mock_trigger.assert_not_called()

    @patch(f"{TASK_PATH}.trigger_autofix_agent")
    @patch(f"{TASK_PATH}.fetch_run_status", side_effect=SeerApiError("nope", 500))
    def test_returns_when_run_state_not_found(
        self,
        _mock_fetch: MagicMock,
        mock_trigger: MagicMock,
    ) -> None:
        self._call()

        mock_trigger.assert_not_called()

    @patch(f"{TASK_PATH}.trigger_autofix_agent")
    @patch(f"{TASK_PATH}.pop_queued_autofix_feedback")
    @patch(f"{TASK_PATH}.fetch_run_status")
    def test_filters_stale_feedback(
        self,
        mock_fetch: MagicMock,
        mock_pop: MagicMock,
        mock_trigger: MagicMock,
    ) -> None:
        stale = Feedback(
            source=GithubPrCommentFeedbackSource(comment={"id": 555, "body": "@sentry stale"})
        )
        block = MemoryBlock(
            id="b1",
            message=Message(role="assistant", metadata={"feedback": serialize_feedback([stale])}),
            timestamp="2024-01-01T00:00:00Z",
        )
        mock_fetch.return_value = self._state(blocks=[block])
        fresh = Feedback(
            source=GithubPrCommentFeedbackSource(comment={"id": 777, "body": "@sentry fresh"})
        )
        mock_pop.return_value = [self._queued(stale), self._queued(fresh)]

        self._call()

        mock_trigger.assert_called_once()
        _, kwargs = mock_trigger.call_args
        assert [f.text for f in kwargs["feedback"]] == ["fresh"]

    @patch(f"{TASK_PATH}.trigger_autofix_agent")
    @patch(f"{TASK_PATH}.pop_queued_autofix_feedback")
    @patch(f"{TASK_PATH}.fetch_run_status")
    def test_does_not_trigger_when_all_feedback_stale(
        self,
        mock_fetch: MagicMock,
        mock_pop: MagicMock,
        mock_trigger: MagicMock,
    ) -> None:
        stale = Feedback(
            source=GithubPrCommentFeedbackSource(comment={"id": 555, "body": "@sentry stale"})
        )
        block = MemoryBlock(
            id="b1",
            message=Message(role="assistant", metadata={"feedback": serialize_feedback([stale])}),
            timestamp="2024-01-01T00:00:00Z",
        )
        mock_fetch.return_value = self._state(blocks=[block])
        mock_pop.return_value = [self._queued(stale)]

        self._call()

        mock_trigger.assert_not_called()

    @patch(f"{TASK_PATH}.trigger_autofix_agent")
    @patch(f"{TASK_PATH}.pop_queued_autofix_feedback")
    @patch(f"{TASK_PATH}.fetch_run_status")
    def test_skips_review_comment_already_processed(
        self,
        mock_fetch: MagicMock,
        mock_pop: MagicMock,
        mock_trigger: MagicMock,
    ) -> None:
        feedback = self._review_feedback(555)
        block = MemoryBlock(
            id="b1",
            message=Message(
                role="assistant", metadata={"feedback": serialize_feedback([feedback])}
            ),
            timestamp="2024-01-01T00:00:00Z",
        )
        mock_fetch.return_value = self._state(blocks=[block])
        mock_pop.return_value = [self._queued(feedback)]

        self._call()

        mock_trigger.assert_not_called()

    @patch(f"{TASK_PATH}.trigger_autofix_agent")
    @patch(f"{TASK_PATH}.pop_queued_autofix_feedback")
    @patch(f"{TASK_PATH}.fetch_run_status")
    def test_collapses_duplicate_review_comment_ids_in_batch(
        self,
        mock_fetch: MagicMock,
        mock_pop: MagicMock,
        mock_trigger: MagicMock,
    ) -> None:
        mock_fetch.return_value = self._state()
        mock_pop.return_value = [
            self._queued(self._review_feedback(666)),
            self._queued(self._review_feedback(666)),
        ]

        self._call()

        mock_trigger.assert_called_once()
        assert len(mock_trigger.call_args.kwargs["feedback"]) == 1

    @patch(f"{TASK_PATH}.trigger_autofix_agent")
    @patch(f"{TASK_PATH}.pop_queued_autofix_feedback")
    @patch(f"{TASK_PATH}.fetch_run_status")
    def test_issue_and_review_comment_with_same_id_not_collapsed(
        self,
        mock_fetch: MagicMock,
        mock_pop: MagicMock,
        mock_trigger: MagicMock,
    ) -> None:
        issue_feedback = Feedback(
            source=GithubPrCommentFeedbackSource(comment={"id": 777, "body": "@sentry fix it"})
        )
        mock_fetch.return_value = self._state()
        mock_pop.return_value = [
            self._queued(issue_feedback),
            self._queued(self._review_feedback(777)),
        ]

        self._call()

        mock_trigger.assert_called_once()
        assert len(mock_trigger.call_args.kwargs["feedback"]) == 2

    @patch(f"{TASK_PATH}.trigger_autofix_agent", side_effect=PrIterationNoPullRequestException())
    @patch(f"{TASK_PATH}.pop_queued_autofix_feedback")
    @patch(f"{TASK_PATH}.fetch_run_status")
    def test_swallows_pr_iteration_exceptions(
        self,
        mock_fetch: MagicMock,
        mock_pop: MagicMock,
        _mock_trigger: MagicMock,
    ) -> None:
        mock_fetch.return_value = self._state()
        mock_pop.return_value = [
            self._queued(Feedback(source=UserUIFeedbackSource(user_id=1, user_feedback="fix it")))
        ]

        self._call()


class TriggerConsumePrIterationFeedbackTest(TestCase):
    def _feedback(self) -> Feedback:
        return Feedback(source=UserUIFeedbackSource(user_id=1, user_feedback="fix it"))

    def _state(self) -> SeerRunState:
        return SeerRunState(
            run_id=67890,
            blocks=[],
            status="completed",
            updated_at="2024-01-01T00:00:00Z",
        )

    @patch(f"{TASK_PATH}.consume_queued_autofix_feedback.apply_async")
    def test_triggers_when_should_trigger_true(self, mock_apply: MagicMock) -> None:
        trigger_consume_pr_iteration_feedback(
            run_id=67890,
            organization_id=self.organization.id,
            feedback=self._feedback(),
            run_state=self._state(),
        )

        mock_apply.assert_called_once_with(
            kwargs={"run_id": 67890, "organization_id": self.organization.id},
            countdown=None,
        )

    @patch(f"{TASK_PATH}.consume_queued_autofix_feedback.apply_async")
    def test_skips_when_should_trigger_false(self, mock_apply: MagicMock) -> None:
        feedback = self._feedback()
        with patch.object(type(feedback.source), "should_trigger", return_value=False):
            trigger_consume_pr_iteration_feedback(
                run_id=67890,
                organization_id=self.organization.id,
                feedback=feedback,
                run_state=self._state(),
            )

        mock_apply.assert_not_called()

    @patch(f"{TASK_PATH}.consume_queued_autofix_feedback.apply_async")
    def test_bypass_ignores_should_trigger(self, mock_apply: MagicMock) -> None:
        feedback = self._feedback()
        with patch.object(type(feedback.source), "should_trigger", return_value=False):
            trigger_consume_pr_iteration_feedback(
                run_id=67890,
                organization_id=self.organization.id,
                feedback=feedback,
                run_state=self._state(),
                bypass=True,
            )

        mock_apply.assert_called_once()

    @patch(f"{TASK_PATH}.consume_queued_autofix_feedback.apply_async")
    def test_passes_delay_as_countdown(self, mock_apply: MagicMock) -> None:
        trigger_consume_pr_iteration_feedback(
            run_id=67890,
            organization_id=self.organization.id,
            feedback=self._feedback(),
            run_state=self._state(),
            delay=30,
        )

        _, kwargs = mock_apply.call_args
        assert kwargs["countdown"] == 30
