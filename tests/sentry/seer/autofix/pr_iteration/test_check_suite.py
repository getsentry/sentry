from unittest.mock import MagicMock, patch

import orjson

from sentry.scm.types import CheckSuiteEvent
from sentry.seer.agent.client_models import RepoPRState, SeerRunState
from sentry.seer.autofix.constants import AutofixReferrer
from sentry.seer.autofix.pr_iteration.feedback import Feedback
from sentry.seer.autofix.pr_iteration.feedback_sources.check_suite import CheckSuiteFeedbackSource
from sentry.seer.autofix.pr_iteration.listeners.check_suite import (
    pr_iteration_from_check_suite_listener,
)
from sentry.testutils.cases import TestCase

CHECK_PATH = "sentry.seer.autofix.pr_iteration.listeners.check_suite"
CHECK_SUITE_SOURCE_PATH = "sentry.seer.autofix.pr_iteration.feedback_sources.check_suite"


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
            subscription_event={"event": orjson.dumps(raw or {}).decode()},
        )

    def _raw(self, *, pull_requests: list[dict] | None = None) -> dict:
        return {
            "check_suite": {
                "id": 1,
                "head_sha": "abc",
                "check_runs_url": "https://github.com/owner/repo/check-runs",
                "app": {"name": "CI"},
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

    @patch(f"{CHECK_PATH}.get_agent_state_from_pr_id")
    def test_skips_non_completed_action(self, mock_get_state: MagicMock) -> None:
        pr_iteration_from_check_suite_listener(self._event(action="requested"))
        mock_get_state.assert_not_called()

    @patch(f"{CHECK_PATH}.get_agent_state_from_pr_id")
    def test_skips_uninteresting_conclusion(self, mock_get_state: MagicMock) -> None:
        pr_iteration_from_check_suite_listener(self._event(conclusion="success"))
        mock_get_state.assert_not_called()

    @patch(f"{CHECK_SUITE_SOURCE_PATH}.resolve_check_suite_repository", return_value=None)
    @patch(f"{CHECK_PATH}.get_agent_state_from_pr_id")
    def test_no_repository(self, mock_get_state: MagicMock, _mock_resolve: MagicMock) -> None:
        pr_iteration_from_check_suite_listener(self._event(self._raw()))
        mock_get_state.assert_not_called()

    @patch(f"{CHECK_PATH}.try_enqueue_autofix_feedback")
    @patch(f"{CHECK_PATH}.get_agent_state_from_pr_id", return_value=None)
    @patch(f"{CHECK_SUITE_SOURCE_PATH}.resolve_check_suite_repository")
    def test_skips_pr_without_run(
        self,
        mock_resolve: MagicMock,
        _mock_get_state: MagicMock,
        mock_enqueue: MagicMock,
    ) -> None:
        mock_resolve.return_value = MagicMock(organization_id=self.organization.id)
        raw = self._raw(pull_requests=[{"id": 555}])

        pr_iteration_from_check_suite_listener(self._event(raw))

        mock_enqueue.assert_not_called()

    @patch(f"{CHECK_PATH}.try_enqueue_autofix_feedback")
    @patch(f"{CHECK_PATH}.get_agent_state_from_pr_id")
    @patch(f"{CHECK_SUITE_SOURCE_PATH}.resolve_check_suite_repository")
    def test_skips_run_missing_group_id(
        self,
        mock_resolve: MagicMock,
        mock_get_state: MagicMock,
        mock_enqueue: MagicMock,
    ) -> None:
        mock_resolve.return_value = MagicMock(organization_id=self.organization.id)
        state = self._agent_state()
        state.metadata = {}
        mock_get_state.return_value = state
        raw = self._raw(pull_requests=[{"id": 555}])

        pr_iteration_from_check_suite_listener(self._event(raw))

        mock_enqueue.assert_not_called()

    @patch(f"{CHECK_PATH}.trigger_consume_pr_iteration_feedback")
    @patch(f"{CHECK_PATH}.try_enqueue_autofix_feedback", return_value=False)
    @patch(f"{CHECK_PATH}.get_agent_state_from_pr_id")
    @patch(f"{CHECK_SUITE_SOURCE_PATH}.resolve_check_suite_repository")
    def test_does_not_trigger_when_not_enqueued(
        self,
        mock_resolve: MagicMock,
        mock_get_state: MagicMock,
        _mock_enqueue: MagicMock,
        mock_trigger_consume: MagicMock,
    ) -> None:
        mock_resolve.return_value = MagicMock(organization_id=self.organization.id)
        mock_get_state.return_value = self._agent_state()
        raw = self._raw(pull_requests=[{"id": 555}])

        pr_iteration_from_check_suite_listener(self._event(raw))

        mock_trigger_consume.assert_not_called()

    @patch(f"{CHECK_PATH}.trigger_consume_pr_iteration_feedback")
    @patch(f"{CHECK_PATH}.make_scm")
    @patch(f"{CHECK_PATH}.try_enqueue_autofix_feedback", return_value=True)
    @patch(f"{CHECK_PATH}.get_agent_state_from_pr_id")
    @patch(f"{CHECK_SUITE_SOURCE_PATH}.resolve_check_suite_repository")
    def test_enqueues_and_triggers_for_matched_run(
        self,
        mock_resolve: MagicMock,
        mock_get_state: MagicMock,
        mock_enqueue: MagicMock,
        _mock_make_scm: MagicMock,
        mock_trigger_consume: MagicMock,
    ) -> None:
        mock_resolve.return_value = MagicMock(organization_id=self.organization.id)
        mock_get_state.return_value = self._agent_state()
        raw = self._raw(pull_requests=[{"id": 555}])

        pr_iteration_from_check_suite_listener(self._event(raw))

        mock_enqueue.assert_called_once()
        _, kwargs = mock_enqueue.call_args
        assert kwargs["run_id"] == 67890
        assert kwargs["referrer"] == AutofixReferrer.GITHUB_CHECK_SUITE
        assert isinstance(kwargs["feedback"], Feedback)
        assert isinstance(kwargs["feedback"].source, CheckSuiteFeedbackSource)
        mock_trigger_consume.assert_called_once()
