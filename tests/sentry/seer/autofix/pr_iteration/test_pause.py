from unittest.mock import MagicMock, patch

from sentry.seer.agent.client_models import SeerRunState
from sentry.seer.autofix.constants import AutofixReferrer
from sentry.seer.autofix.pr_iteration.feedback import Feedback
from sentry.seer.autofix.pr_iteration.feedback_sources.user_ui import UserUIFeedbackSource
from sentry.seer.autofix.pr_iteration.logs import PrIterationLogContext
from sentry.seer.autofix.pr_iteration.pause import (
    PAUSED_EXTRA,
    is_pr_iteration_paused,
    pause_pr_iteration,
)
from sentry.seer.autofix.pr_iteration.queue import (
    peek_queued_autofix_feedback,
    try_enqueue_autofix_feedback,
)
from sentry.testutils.cases import TestCase

RUN_ID = 67890
OTHER_RUN_ID = 67891


class PausePrIterationTest(TestCase):
    def setUp(self) -> None:
        super().setUp()
        self.seer_run = self.create_seer_run(
            organization=self.organization, seer_run_state_id=RUN_ID, user_id=self.user.id
        )

    def _enqueue(self, run_id: int = RUN_ID) -> bool:
        run_state = SeerRunState(
            run_id=run_id,
            blocks=[],
            status="completed",
            updated_at="2024-01-01T00:00:00Z",
            repo_pr_states={},
        )
        return try_enqueue_autofix_feedback(
            log_ctx=PrIterationLogContext(
                MagicMock(), run_state=run_state, organization_id=self.organization.id
            ),
            run_id=run_id,
            organization_id=self.organization.id,
            group_id=1,
            feedback=Feedback(source=UserUIFeedbackSource(user_id=1, user_feedback="fix it")),
            referrer=AutofixReferrer.GITHUB_PR_COMMENT,
            run_state=run_state,
        )

    def _marker(self) -> dict | None:
        self.seer_run.refresh_from_db()
        return (self.seer_run.extras or {}).get(PAUSED_EXTRA)

    def _is_paused(self, run_id: int = RUN_ID) -> bool:
        return is_pr_iteration_paused(run_id=run_id, organization_id=self.organization.id)

    def test_pause_writes_marker_and_empties_queue(self) -> None:
        assert self._enqueue() is True
        assert len(peek_queued_autofix_feedback(RUN_ID)) == 1

        assert (
            pause_pr_iteration(
                run_id=RUN_ID,
                organization_id=self.organization.id,
                actor_user_id=self.user.id,
            )
            is True
        )

        marker = self._marker()
        assert marker is not None
        assert marker["actor_user_id"] == self.user.id
        assert marker["paused_at"]
        assert peek_queued_autofix_feedback(RUN_ID) == []
        assert self._is_paused() is True

    def test_second_pause_changes_nothing(self) -> None:
        pause_pr_iteration(
            run_id=RUN_ID, organization_id=self.organization.id, actor_user_id=self.user.id
        )
        first_marker = self._marker()

        assert (
            pause_pr_iteration(
                run_id=RUN_ID, organization_id=self.organization.id, actor_user_id=99
            )
            is True
        )

        assert self._marker() == first_marker
        assert peek_queued_autofix_feedback(RUN_ID) == []

    def test_returns_false_without_seer_run_row(self) -> None:
        self.seer_run.delete()

        assert pause_pr_iteration(run_id=RUN_ID, organization_id=self.organization.id) is False
        assert self._is_paused() is False

    def test_returns_false_when_run_deleted_before_write(self) -> None:
        def delete_run(*args: object, **kwargs: object) -> None:
            self.seer_run.delete()

        assert self._enqueue() is True

        with patch("sentry.seer.autofix.pr_iteration.pause.get_run_extra", side_effect=delete_run):
            assert pause_pr_iteration(run_id=RUN_ID, organization_id=self.organization.id) is False

        # The queue survives a failed marker write, so the marker is written first.
        assert len(peek_queued_autofix_feedback(RUN_ID)) == 1

    def test_returns_false_for_another_organization(self) -> None:
        other_org = self.create_organization()

        assert pause_pr_iteration(run_id=RUN_ID, organization_id=other_org.id) is False

    def test_pause_leaves_other_run_alone(self) -> None:
        other_run = self.create_seer_run(
            organization=self.organization, seer_run_state_id=OTHER_RUN_ID, user_id=self.user.id
        )
        assert self._enqueue(OTHER_RUN_ID) is True

        pause_pr_iteration(run_id=RUN_ID, organization_id=self.organization.id)

        other_run.refresh_from_db()
        assert (other_run.extras or {}).get(PAUSED_EXTRA) is None
        assert len(peek_queued_autofix_feedback(OTHER_RUN_ID)) == 1
        assert self._is_paused(OTHER_RUN_ID) is False
