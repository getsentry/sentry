from collections.abc import Sequence
from unittest.mock import MagicMock, patch

from sentry.seer.agent.client_models import MemoryBlock, Message, SeerRunState
from sentry.seer.autofix.constants import AutofixReferrer
from sentry.seer.autofix.pr_iteration.feedback_queue import QueuedAutofixFeedback
from sentry.seer.autofix.pr_iteration.types import Feedback, serialize_feedback
from sentry.tasks.seer.pr_iteration import consume_queued_autofix_feedback
from sentry.testutils.cases import TestCase as SentryTestCase


@patch("sentry.tasks.seer.pr_iteration.trigger_autofix_agent")
@patch("sentry.tasks.seer.pr_iteration.pop_queued_autofix_feedback")
@patch("sentry.tasks.seer.pr_iteration.get_autofix_run_state")
class TestConsumeQueuedAutofixFeedbackDedup(SentryTestCase):
    def setUp(self) -> None:
        super().setUp()
        self.group = self.create_group()
        self.run_id = 123

    def _gh_item(self, comment_id: int, message: str = "fix it") -> QueuedAutofixFeedback:
        return QueuedAutofixFeedback(
            organization_id=self.organization.id,
            group_id=self.group.id,
            feedback=Feedback(
                text=message,
                source={"type": "github-pr-comment", "comment": {"id": comment_id}},
            ),
            referrer=AutofixReferrer.GITHUB_PR_COMMENT,
        )

    def _review_item(self, comment_id: int, message: str = "fix it") -> QueuedAutofixFeedback:
        return QueuedAutofixFeedback(
            organization_id=self.organization.id,
            group_id=self.group.id,
            feedback=Feedback(
                text=message,
                source={
                    "type": "github-pr-review-comment",
                    "comment": {"id": comment_id},
                    "file_path": "src/sentry/foo.py",
                    "line": 42,
                },
            ),
            referrer=AutofixReferrer.GITHUB_PR_COMMENT,
        )

    def _ui_item(self, message: str = "ui feedback") -> QueuedAutofixFeedback:
        return QueuedAutofixFeedback(
            organization_id=self.organization.id,
            group_id=self.group.id,
            feedback=Feedback(text=message, source={"type": "user-ui", "user_id": 1, "user": None}),
            referrer=AutofixReferrer.GROUP_AUTOFIX_ENDPOINT,
        )

    def _state(self, processed_feedback: Sequence[Feedback] = ()) -> SeerRunState:
        blocks = []
        if processed_feedback:
            blocks = [
                MemoryBlock(
                    id="b1",
                    timestamp="2024-01-01T00:00:00Z",
                    message=Message(
                        role="user",
                        metadata={"feedback": serialize_feedback(processed_feedback)},
                    ),
                )
            ]
        return SeerRunState(
            run_id=self.run_id,
            blocks=blocks,
            status="completed",
            updated_at="2024-01-01T00:00:00Z",
            metadata={"group_id": self.group.id},
        )

    def _consume(self) -> None:
        consume_queued_autofix_feedback(
            run_id=self.run_id,
            organization_id=self.organization.id,
            group_id=self.group.id,
        )

    def test_skips_comment_already_processed(
        self, mock_state: MagicMock, mock_pop: MagicMock, mock_trigger: MagicMock
    ) -> None:
        mock_state.return_value = self._state([self._gh_item(111).feedback])
        mock_pop.return_value = [self._gh_item(111)]

        self._consume()

        mock_trigger.assert_not_called()

    def test_collapses_duplicate_comment_ids_in_batch(
        self, mock_state: MagicMock, mock_pop: MagicMock, mock_trigger: MagicMock
    ) -> None:
        mock_state.return_value = self._state()
        mock_pop.return_value = [self._gh_item(222), self._gh_item(222)]

        self._consume()

        mock_trigger.assert_called_once()
        assert len(mock_trigger.call_args.kwargs["feedback"]) == 1

    def test_keeps_distinct_and_ui_feedback(
        self, mock_state: MagicMock, mock_pop: MagicMock, mock_trigger: MagicMock
    ) -> None:
        mock_state.return_value = self._state([self._gh_item(333).feedback])
        mock_pop.return_value = [
            self._gh_item(333),
            self._gh_item(444),
            self._ui_item(),
        ]

        self._consume()

        mock_trigger.assert_called_once()
        assert len(mock_trigger.call_args.kwargs["feedback"]) == 2

    def test_skips_review_comment_already_processed(
        self, mock_state: MagicMock, mock_pop: MagicMock, mock_trigger: MagicMock
    ) -> None:
        mock_state.return_value = self._state([self._review_item(555).feedback])
        mock_pop.return_value = [self._review_item(555)]

        self._consume()

        mock_trigger.assert_not_called()

    def test_collapses_duplicate_review_comment_ids_in_batch(
        self, mock_state: MagicMock, mock_pop: MagicMock, mock_trigger: MagicMock
    ) -> None:
        mock_state.return_value = self._state()
        mock_pop.return_value = [self._review_item(666), self._review_item(666)]

        self._consume()

        mock_trigger.assert_called_once()
        assert len(mock_trigger.call_args.kwargs["feedback"]) == 1

    def test_issue_and_review_comment_with_same_id_not_collapsed(
        self, mock_state: MagicMock, mock_pop: MagicMock, mock_trigger: MagicMock
    ) -> None:
        # issue-comment and review-comment ids are separate namespaces: a shared
        # numeric id must not cause one to dedupe away the other.
        mock_state.return_value = self._state()
        mock_pop.return_value = [self._gh_item(777), self._review_item(777)]

        self._consume()

        mock_trigger.assert_called_once()
        assert len(mock_trigger.call_args.kwargs["feedback"]) == 2
