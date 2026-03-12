from unittest.mock import MagicMock, patch

from sentry.seer.entrypoints.slack.tasks import (
    EntrypointSetupError,
    ProcessMentionHaltReason,
    process_mention_for_slack,
)
from sentry.testutils.cases import TestCase

TASK_KWARGS = {
    "integration_id": 123,
    "channel_id": "C1234567890",
    "thread_ts": None,
    "message_ts": "1234567890.123456",
    "text": "<@U0BOT> What is causing this issue?",
    "slack_user_id": "U1234567890",
    "bot_user_id": "U0BOT",
}


class ProcessMentionForSlackTest(TestCase):
    def _run_task(self, **overrides):
        kwargs = {
            **TASK_KWARGS,
            "organization_id": self.organization.id,
            **overrides,
        }
        process_mention_for_slack(**kwargs)

    @patch("sentry.seer.entrypoints.operator.SeerExplorerOperator")
    @patch("sentry.seer.entrypoints.slack.entrypoint.SlackExplorerEntrypoint")
    def test_happy_path(self, mock_explorer_cls, mock_operator_cls):
        mock_explorer_cls.has_access.return_value = True
        mock_entrypoint = MagicMock()
        mock_entrypoint.thread_ts = "1234567890.123456"
        mock_explorer_cls.return_value = mock_entrypoint

        mock_operator = MagicMock()
        mock_operator_cls.return_value = mock_operator

        self._run_task()

        mock_entrypoint.install.set_thread_status.assert_called_once_with(
            channel_id="C1234567890",
            thread_ts="1234567890.123456",
            status="Thinking...",
        )
        mock_operator.trigger_explorer.assert_called_once()
        call_kwargs = mock_operator.trigger_explorer.call_args[1]
        assert call_kwargs["organization"] == self.organization
        assert call_kwargs["user"] is None
        assert call_kwargs["prompt"] == "What is causing this issue?"
        assert call_kwargs["on_page_context"] is None
        assert call_kwargs["category_key"] == "slack_thread"
        assert call_kwargs["category_value"] == "C1234567890:1234567890.123456"

    @patch("sentry.integrations.utils.metrics.EventLifecycle.record_halt")
    @patch("sentry.seer.entrypoints.operator.SeerExplorerOperator")
    @patch("sentry.seer.entrypoints.slack.entrypoint.SlackExplorerEntrypoint")
    def test_org_not_found(self, mock_explorer_cls, mock_operator_cls, mock_record_halt):
        self._run_task(organization_id=999999999)

        mock_explorer_cls.has_access.assert_not_called()
        mock_explorer_cls.assert_not_called()
        mock_operator_cls.assert_not_called()
        mock_record_halt.assert_called_once_with(halt_reason=ProcessMentionHaltReason.ORG_NOT_FOUND)

    @patch("sentry.integrations.utils.metrics.EventLifecycle.record_halt")
    @patch("sentry.seer.entrypoints.operator.SeerExplorerOperator")
    @patch("sentry.seer.entrypoints.slack.entrypoint.SlackExplorerEntrypoint")
    def test_no_explorer_access(self, mock_explorer_cls, mock_operator_cls, mock_record_halt):
        mock_explorer_cls.has_access.return_value = False

        self._run_task()

        mock_explorer_cls.assert_not_called()
        mock_operator_cls.assert_not_called()
        mock_record_halt.assert_called_once_with(
            halt_reason=ProcessMentionHaltReason.NO_EXPLORER_ACCESS
        )

    @patch("sentry.integrations.utils.metrics.EventLifecycle.record_halt")
    @patch("sentry.seer.entrypoints.operator.SeerExplorerOperator")
    @patch("sentry.seer.entrypoints.slack.entrypoint.SlackExplorerEntrypoint")
    def test_integration_not_found(self, mock_explorer_cls, mock_operator_cls, mock_record_halt):
        mock_explorer_cls.has_access.return_value = True
        mock_explorer_cls.side_effect = EntrypointSetupError("not found")

        self._run_task()

        mock_operator_cls.assert_not_called()
        mock_record_halt.assert_called_once_with(
            halt_reason=ProcessMentionHaltReason.INTEGRATION_NOT_FOUND
        )

    @patch("sentry.seer.entrypoints.operator.SeerExplorerOperator")
    @patch("sentry.seer.entrypoints.slack.entrypoint.SlackExplorerEntrypoint")
    def test_with_thread_context(self, mock_explorer_cls, mock_operator_cls):
        mock_explorer_cls.has_access.return_value = True
        mock_entrypoint = MagicMock()
        mock_entrypoint.thread_ts = "1234567890.000001"
        mock_entrypoint.install.get_thread_history.return_value = [
            {"user": "U111", "text": "help me debug this"},
            {"user": "U222", "text": "sure, what's the error?"},
        ]
        mock_explorer_cls.return_value = mock_entrypoint

        mock_operator = MagicMock()
        mock_operator_cls.return_value = mock_operator

        self._run_task(thread_ts="1234567890.000001")

        mock_entrypoint.install.get_thread_history.assert_called_once_with(
            channel_id="C1234567890",
            thread_ts="1234567890.000001",
        )
        call_kwargs = mock_operator.trigger_explorer.call_args[1]
        assert call_kwargs["on_page_context"] is not None
        assert "<@U111>: help me debug this" in call_kwargs["on_page_context"]
        assert "<@U222>: sure, what's the error?" in call_kwargs["on_page_context"]

    @patch("sentry.seer.entrypoints.operator.SeerExplorerOperator")
    @patch("sentry.seer.entrypoints.slack.entrypoint.SlackExplorerEntrypoint")
    def test_without_thread_context(self, mock_explorer_cls, mock_operator_cls):
        mock_explorer_cls.has_access.return_value = True
        mock_entrypoint = MagicMock()
        mock_entrypoint.thread_ts = "1234567890.123456"
        mock_explorer_cls.return_value = mock_entrypoint

        mock_operator = MagicMock()
        mock_operator_cls.return_value = mock_operator

        self._run_task(thread_ts=None)

        mock_entrypoint.install.get_thread_history.assert_not_called()
        call_kwargs = mock_operator.trigger_explorer.call_args[1]
        assert call_kwargs["on_page_context"] is None
