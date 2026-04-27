from unittest.mock import MagicMock, patch

from sentry.seer.entrypoints.slack.analytics import (
    SlackSeerAgentConversation,
    SlackSeerAgentResponded,
)
from sentry.seer.entrypoints.slack.entrypoint import EntrypointSetupError
from sentry.seer.entrypoints.slack.metrics import (
    ProcessMentionFailureReason,
    ProcessMentionHaltReason,
)
from sentry.seer.entrypoints.slack.tasks import process_mention_for_slack
from sentry.testutils.asserts import assert_failure_metric, assert_halt_metric
from sentry.testutils.cases import TestCase
from sentry.testutils.helpers.analytics import (
    assert_last_analytics_event,
    assert_not_analytics_event,
)

TASK_KWARGS = {
    "integration_id": 123,
    "channel_id": "C1234567890",
    "ts": "1234567890.654321",
    "thread_ts": "1234567890.123456",
    "text": "<@U0BOT> What is causing this issue?",
    "slack_user_id": "U1234567890",
    "bot_user_id": "U0BOT",
    "conversation_type": SlackSeerAgentConversation.APP_MENTION,
}


class ProcessMentionForSlackTest(TestCase):
    def _run_task(self, **overrides):
        kwargs = {
            **TASK_KWARGS,
            "organization_id": self.organization.id,
            **overrides,
        }
        process_mention_for_slack(**kwargs)

    @patch("sentry.analytics.record")
    @patch("sentry.seer.entrypoints.slack.tasks._count_linked_users")
    @patch("sentry.seer.entrypoints.slack.tasks.SeerAgentOperator")
    @patch("sentry.seer.entrypoints.slack.tasks.SlackAgentEntrypoint")
    @patch("sentry.seer.entrypoints.slack.tasks._resolve_user")
    def test_happy_path(
        self,
        mock_resolve_user,
        mock_agent_cls,
        mock_operator_cls,
        mock_count_linked,
        mock_record,
    ):
        mock_user = MagicMock(id=self.user.id, username="alice")
        mock_resolve_user.return_value = mock_user

        mock_agent_cls.has_access.return_value = True
        mock_entrypoint = MagicMock()
        mock_entrypoint.thread_ts = "1234567890.123456"
        mock_entrypoint.install.get_thread_history.return_value = []
        mock_agent_cls.return_value = mock_entrypoint

        mock_operator = MagicMock()
        mock_operator.trigger_agent.return_value = 42
        mock_operator_cls.return_value = mock_operator

        mock_count_linked.return_value = 0

        self._run_task()

        mock_operator.trigger_agent.assert_called_once()
        call_kwargs = mock_operator.trigger_agent.call_args[1]
        assert call_kwargs["organization"] == self.organization
        assert call_kwargs["user"] is mock_user
        assert call_kwargs["prompt"] == "What is causing this issue?"
        assert call_kwargs["on_page_context"] is None
        assert call_kwargs["category_key"] == "slack_thread"
        assert call_kwargs["category_value"] == "C1234567890:1234567890.123456"

        assert_last_analytics_event(
            mock_record,
            SlackSeerAgentResponded(
                organization_id=self.organization.id,
                org_slug=self.organization.slug,
                user_id=self.user.id,
                username="alice",
                thread_ts="1234567890.123456",
                prompt_length=len("What is causing this issue?"),
                run_id=42,
                integration_id=123,
                messages_in_thread=1,
                seer_msgs_in_thread=0,
                unique_users_in_thread=1,
                linked_users_in_thread=0,
                conversation_type=SlackSeerAgentConversation.APP_MENTION,
            ),
        )

    @patch("sentry.integrations.utils.metrics.EventLifecycle.record_event")
    @patch("sentry.seer.entrypoints.slack.tasks.SeerAgentOperator")
    @patch("sentry.seer.entrypoints.slack.tasks.SlackAgentEntrypoint")
    def test_org_not_found(self, mock_agent_cls, mock_operator_cls, mock_record):
        self._run_task(organization_id=999999999)

        mock_agent_cls.has_access.assert_not_called()
        mock_agent_cls.assert_not_called()
        mock_operator_cls.assert_not_called()
        assert_failure_metric(mock_record, ProcessMentionFailureReason.ORG_NOT_FOUND)

    @patch("sentry.integrations.utils.metrics.EventLifecycle.record_event")
    @patch("sentry.seer.entrypoints.slack.tasks.SeerAgentOperator")
    @patch("sentry.seer.entrypoints.slack.tasks.SlackAgentEntrypoint")
    def test_no_agent_access(self, mock_agent_cls, mock_operator_cls, mock_record):
        mock_agent_cls.has_access.return_value = False

        self._run_task()

        mock_agent_cls.assert_not_called()
        mock_operator_cls.assert_not_called()
        assert_failure_metric(mock_record, ProcessMentionFailureReason.NO_AGENT_ACCESS)

    @patch("sentry.integrations.utils.metrics.EventLifecycle.record_event")
    @patch("sentry.seer.entrypoints.slack.tasks.SeerAgentOperator")
    @patch("sentry.seer.entrypoints.slack.tasks.SlackAgentEntrypoint")
    def test_integration_not_found(self, mock_agent_cls, mock_operator_cls, mock_record):
        mock_agent_cls.has_access.return_value = True
        mock_agent_cls.side_effect = EntrypointSetupError("not found")

        self._run_task()

        mock_operator_cls.assert_not_called()
        assert_failure_metric(mock_record, EntrypointSetupError("not found"))

    @patch("sentry.integrations.utils.metrics.EventLifecycle.record_event")
    @patch("sentry.seer.entrypoints.slack.tasks._send_link_identity_prompt")
    @patch("sentry.seer.entrypoints.slack.tasks.SeerAgentOperator")
    @patch("sentry.seer.entrypoints.slack.tasks.SlackAgentEntrypoint")
    @patch("sentry.seer.entrypoints.slack.tasks._resolve_user")
    def test_identity_not_linked(
        self,
        mock_resolve_user,
        mock_agent_cls,
        mock_operator_cls,
        mock_send_link,
        mock_record,
    ):
        mock_resolve_user.return_value = None

        mock_agent_cls.has_access.return_value = True
        mock_entrypoint = MagicMock()
        mock_entrypoint.thread_ts = "1234567890.123456"
        mock_agent_cls.return_value = mock_entrypoint

        self._run_task()

        mock_send_link.assert_called_once_with(
            entrypoint=mock_entrypoint, thread_ts="1234567890.123456"
        )
        mock_operator_cls.assert_not_called()
        assert_halt_metric(mock_record, ProcessMentionHaltReason.IDENTITY_NOT_LINKED)

    @patch("sentry.integrations.utils.metrics.EventLifecycle.record_event")
    @patch("sentry.seer.entrypoints.slack.tasks._send_not_org_member_message")
    @patch("sentry.seer.entrypoints.slack.tasks.SeerAgentOperator")
    @patch("sentry.seer.entrypoints.slack.tasks.SlackAgentEntrypoint")
    @patch("sentry.seer.entrypoints.slack.tasks._resolve_user")
    def test_user_not_org_member(
        self,
        mock_resolve_user,
        mock_agent_cls,
        mock_operator_cls,
        mock_send_not_member,
        mock_record,
    ):
        other_org = self.create_organization(name="Other Org")
        mock_user = MagicMock(id=self.create_user().id)
        mock_resolve_user.return_value = mock_user

        mock_agent_cls.has_access.return_value = True
        mock_entrypoint = MagicMock()
        mock_agent_cls.return_value = mock_entrypoint

        self._run_task(organization_id=other_org.id)

        mock_operator_cls.assert_not_called()
        mock_send_not_member.assert_called_once_with(
            entrypoint=mock_entrypoint,
            thread_ts="1234567890.123456",
            org_name="Other Org",
        )
        mock_entrypoint.install.set_thread_status.assert_called_once_with(
            channel_id="C1234567890",
            thread_ts="1234567890.123456",
            status="",
        )
        assert_halt_metric(mock_record, ProcessMentionHaltReason.USER_NOT_ORG_MEMBER)

    @patch("sentry.analytics.record")
    @patch("sentry.seer.entrypoints.slack.tasks._count_linked_users")
    @patch("sentry.seer.entrypoints.slack.tasks.SeerAgentOperator")
    @patch("sentry.seer.entrypoints.slack.tasks.SlackAgentEntrypoint")
    @patch("sentry.seer.entrypoints.slack.tasks._resolve_user")
    def test_with_thread_context(
        self,
        mock_resolve_user,
        mock_agent_cls,
        mock_operator_cls,
        mock_count_linked,
        mock_record,
    ):
        mock_resolve_user.return_value = MagicMock(id=self.user.id, username="alice")

        mock_agent_cls.has_access.return_value = True
        mock_entrypoint = MagicMock()
        mock_entrypoint.thread_ts = "1234567890.000001"
        mock_entrypoint.install.get_thread_history.return_value = [
            {"user": "U111", "text": "help me debug this"},
            {"user": "U0BOT", "text": "let me take a look"},
            {"user": "U222", "text": "sure, what's the error?"},
            {"user": "U0BOT", "text": "I'm on it"},
            {"user": "U1234567890", "text": "<@U0BOT> What is causing this issue?"},
        ]
        mock_agent_cls.return_value = mock_entrypoint

        mock_operator = MagicMock()
        mock_operator.trigger_agent.return_value = 99
        mock_operator_cls.return_value = mock_operator

        mock_count_linked.return_value = 1

        self._run_task(
            thread_ts="1234567890.000001",
            conversation_type=SlackSeerAgentConversation.DIRECT_MESSAGE,
        )

        mock_entrypoint.install.get_thread_history.assert_called_once_with(
            channel_id="C1234567890",
            thread_ts="1234567890.000001",
        )
        call_kwargs = mock_operator.trigger_agent.call_args[1]
        assert call_kwargs["on_page_context"] is not None
        assert "<@U111>: help me debug this" in call_kwargs["on_page_context"]
        assert "<@U222>: sure, what's the error?" in call_kwargs["on_page_context"]

        mock_count_linked.assert_called_once()
        assert mock_count_linked.call_args.kwargs["slack_user_ids"] == {
            "U111",
            "U222",
            "U1234567890",
        }

        assert_last_analytics_event(
            mock_record,
            SlackSeerAgentResponded(
                organization_id=self.organization.id,
                org_slug=self.organization.slug,
                user_id=self.user.id,
                username="alice",
                thread_ts="1234567890.000001",
                prompt_length=len("What is causing this issue?"),
                run_id=99,
                integration_id=123,
                messages_in_thread=5,
                seer_msgs_in_thread=2,
                unique_users_in_thread=3,
                linked_users_in_thread=1,
                conversation_type=SlackSeerAgentConversation.DIRECT_MESSAGE,
            ),
        )

    @patch("sentry.seer.entrypoints.slack.tasks.SeerAgentOperator")
    @patch("sentry.seer.entrypoints.slack.tasks.SlackAgentEntrypoint")
    @patch("sentry.seer.entrypoints.slack.tasks._resolve_user")
    def test_without_thread_context(self, mock_resolve_user, mock_agent_cls, mock_operator_cls):
        mock_resolve_user.return_value = MagicMock(id=self.user.id)

        mock_agent_cls.has_access.return_value = True
        mock_entrypoint = MagicMock()
        mock_entrypoint.thread_ts = "1234567890.123456"
        mock_agent_cls.return_value = mock_entrypoint

        mock_operator = MagicMock()
        mock_operator.trigger_agent.return_value = 1
        mock_operator_cls.return_value = mock_operator

        self._run_task(thread_ts=None)

        mock_entrypoint.install.get_thread_history.assert_not_called()
        call_kwargs = mock_operator.trigger_agent.call_args[1]
        assert call_kwargs["on_page_context"] is None

    @patch("sentry.analytics.record")
    @patch("sentry.seer.entrypoints.slack.tasks._count_linked_users")
    @patch("sentry.seer.entrypoints.slack.tasks.SeerAgentOperator")
    @patch("sentry.seer.entrypoints.slack.tasks.SlackAgentEntrypoint")
    @patch("sentry.seer.entrypoints.slack.tasks._resolve_user")
    def test_top_level_mention_analytics(
        self,
        mock_resolve_user,
        mock_agent_cls,
        mock_operator_cls,
        mock_count_linked,
        mock_record,
    ):
        mock_resolve_user.return_value = MagicMock(id=self.user.id, username="alice")

        mock_agent_cls.has_access.return_value = True
        mock_entrypoint = MagicMock()
        mock_entrypoint.thread_ts = "1234567890.654321"
        mock_agent_cls.return_value = mock_entrypoint

        mock_operator = MagicMock()
        mock_operator.trigger_agent.return_value = 7
        mock_operator_cls.return_value = mock_operator

        mock_count_linked.return_value = 1

        self._run_task(thread_ts=None)

        mock_count_linked.assert_called_once()
        assert mock_count_linked.call_args.kwargs["slack_user_ids"] == {"U1234567890"}

        assert_last_analytics_event(
            mock_record,
            SlackSeerAgentResponded(
                organization_id=self.organization.id,
                org_slug=self.organization.slug,
                user_id=self.user.id,
                username="alice",
                thread_ts="1234567890.654321",
                prompt_length=len("What is causing this issue?"),
                run_id=7,
                integration_id=123,
                messages_in_thread=1,
                seer_msgs_in_thread=0,
                unique_users_in_thread=1,
                linked_users_in_thread=1,
                conversation_type=SlackSeerAgentConversation.APP_MENTION,
            ),
        )

    @patch("sentry.analytics.record")
    @patch("sentry.seer.entrypoints.slack.tasks.SeerAgentOperator")
    @patch("sentry.seer.entrypoints.slack.tasks.SlackAgentEntrypoint")
    @patch("sentry.seer.entrypoints.slack.tasks._resolve_user")
    def test_skips_analytics_when_trigger_agent_fails(
        self, mock_resolve_user, mock_agent_cls, mock_operator_cls, mock_record
    ):
        mock_resolve_user.return_value = MagicMock(id=self.user.id)

        mock_agent_cls.has_access.return_value = True
        mock_entrypoint = MagicMock()
        mock_entrypoint.thread_ts = "1234567890.123456"
        mock_agent_cls.return_value = mock_entrypoint

        mock_operator = MagicMock()
        mock_operator.trigger_agent.return_value = None
        mock_operator_cls.return_value = mock_operator

        self._run_task()

        assert_not_analytics_event(mock_record, SlackSeerAgentResponded)
