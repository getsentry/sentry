from unittest.mock import MagicMock, patch

from sentry.seer.entrypoints.slack.analytics import (
    SlackSeerAgentConversation,
    SlackSeerAgentResponded,
)
from sentry.seer.entrypoints.slack.entrypoint import EntrypointSetupError
from sentry.seer.entrypoints.slack.mention import SlackMessageLink
from sentry.seer.entrypoints.slack.metrics import (
    ProcessMentionFailureReason,
    ProcessMentionHaltReason,
)
from sentry.seer.entrypoints.slack.tasks import (
    _build_inaccessible_links_renderable,
    _cap_linked_thread,
    process_mention_for_slack,
)
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


class LinkedMessagesContextTest(TestCase):
    """Tests for the Slack-permalink → on_page_context wiring."""

    LINKED_PERMALINK = "https://acme.slack.com/archives/C9999LINKED/p1700000000222222"

    def _build_mocks(self, history_side_effect):
        mock_user = MagicMock(id=self.user.id, username="alice")
        mock_entrypoint = MagicMock()
        mock_entrypoint.thread_ts = "1234567890.123456"
        mock_entrypoint.channel_id = TASK_KWARGS["channel_id"]
        mock_entrypoint.slack_user_id = TASK_KWARGS["slack_user_id"]
        mock_entrypoint.integration.metadata = {"domain_name": "acme.slack.com"}
        mock_entrypoint.integration.external_id = "T0TEAM"
        mock_entrypoint.install.get_thread_history.side_effect = history_side_effect

        mock_operator = MagicMock()
        mock_operator.trigger_agent.return_value = 42
        return mock_user, mock_entrypoint, mock_operator

    def _run(self, *, text, **overrides):
        kwargs = {
            **TASK_KWARGS,
            "organization_id": self.organization.id,
            "text": text,
            **overrides,
        }
        process_mention_for_slack(**kwargs)

    @patch("sentry.analytics.record")
    @patch("sentry.seer.entrypoints.slack.tasks._count_linked_users", return_value=0)
    @patch("sentry.seer.entrypoints.slack.tasks.SeerAgentOperator")
    @patch("sentry.seer.entrypoints.slack.tasks.SlackAgentEntrypoint")
    @patch("sentry.seer.entrypoints.slack.tasks._resolve_user")
    def test_top_level_permalink_appends_single_message(
        self, mock_resolve_user, mock_agent_cls, mock_operator_cls, _mock_count, _mock_record
    ):
        # In-thread fetch returns nothing; the linked permalink fetch returns a single message.
        def history_side_effect(*, channel_id, thread_ts):
            if channel_id == "C9999LINKED":
                return [{"user": "ULINK", "text": "linked body", "ts": "1700000000.222222"}]
            return []

        mock_user, mock_entrypoint, mock_operator = self._build_mocks(history_side_effect)
        mock_resolve_user.return_value = mock_user
        mock_agent_cls.has_access.return_value = True
        mock_agent_cls.return_value = mock_entrypoint
        mock_operator_cls.return_value = mock_operator

        text = f"<@U0BOT> what about <{self.LINKED_PERMALINK}>"
        self._run(text=text)

        # The fetch was issued against the linked channel + ts (no thread_ts in URL → ts is used).
        mock_entrypoint.install.get_thread_history.assert_any_call(
            channel_id="C9999LINKED", thread_ts="1700000000.222222"
        )

        on_page_context = mock_operator.trigger_agent.call_args[1]["on_page_context"]
        assert on_page_context is not None
        assert "Linked Slack message in <#C9999LINKED>:" in on_page_context
        assert "<@ULINK>: linked body" in on_page_context

    @patch("sentry.analytics.record")
    @patch("sentry.seer.entrypoints.slack.tasks._count_linked_users", return_value=0)
    @patch("sentry.seer.entrypoints.slack.tasks.SeerAgentOperator")
    @patch("sentry.seer.entrypoints.slack.tasks.SlackAgentEntrypoint")
    @patch("sentry.seer.entrypoints.slack.tasks._resolve_user")
    def test_threaded_permalink_appends_full_thread(
        self, mock_resolve_user, mock_agent_cls, mock_operator_cls, _mock_count, _mock_record
    ):
        def history_side_effect(*, channel_id, thread_ts):
            if channel_id == "C9999LINKED" and thread_ts == "1700000000.111111":
                return [
                    {"user": "UPARENT", "text": "parent", "ts": "1700000000.111111"},
                    {"user": "UREPLY", "text": "reply", "ts": "1700000000.222222"},
                ]
            return []

        mock_user, mock_entrypoint, mock_operator = self._build_mocks(history_side_effect)
        mock_resolve_user.return_value = mock_user
        mock_agent_cls.has_access.return_value = True
        mock_agent_cls.return_value = mock_entrypoint
        mock_operator_cls.return_value = mock_operator

        url = (
            "https://acme.slack.com/archives/C9999LINKED/p1700000000222222"
            "?thread_ts=1700000000.111111&cid=C9999LINKED"
        )
        self._run(text=f"<@U0BOT> see <{url}>")

        mock_entrypoint.install.get_thread_history.assert_any_call(
            channel_id="C9999LINKED", thread_ts="1700000000.111111"
        )
        on_page_context = mock_operator.trigger_agent.call_args[1]["on_page_context"]
        assert "Linked Slack thread in <#C9999LINKED>:" in on_page_context
        assert "<@UPARENT>: parent" in on_page_context
        assert "<@UREPLY>: reply" in on_page_context

    @patch("sentry.analytics.record")
    @patch("sentry.seer.entrypoints.slack.tasks._count_linked_users", return_value=0)
    @patch("sentry.seer.entrypoints.slack.tasks.SeerAgentOperator")
    @patch("sentry.seer.entrypoints.slack.tasks.SlackAgentEntrypoint")
    @patch("sentry.seer.entrypoints.slack.tasks._resolve_user")
    def test_unresolved_link_yields_no_block_and_sends_ephemeral(
        self, mock_resolve_user, mock_agent_cls, mock_operator_cls, _mock_count, _mock_record
    ):
        # Empty list simulates has_history_scope returning False inside get_thread_history.
        mock_user, mock_entrypoint, mock_operator = self._build_mocks(lambda **_: [])
        mock_resolve_user.return_value = mock_user
        mock_agent_cls.has_access.return_value = True
        mock_agent_cls.return_value = mock_entrypoint
        mock_operator_cls.return_value = mock_operator

        self._run(
            text=f"<@U0BOT> what about <{self.LINKED_PERMALINK}>",
            thread_ts=None,  # no in-thread context either
        )

        # The fetch was attempted but returned empty → on_page_context stays None.
        mock_entrypoint.install.get_thread_history.assert_called_once_with(
            channel_id="C9999LINKED", thread_ts="1700000000.222222"
        )
        assert mock_operator.trigger_agent.call_args[1]["on_page_context"] is None

        # The user is nudged to invite the bot to the inaccessible channel.
        mock_entrypoint.install.send_threaded_ephemeral_message.assert_called_once()
        call_kwargs = mock_entrypoint.install.send_threaded_ephemeral_message.call_args[1]
        assert call_kwargs["channel_id"] == TASK_KWARGS["channel_id"]
        assert call_kwargs["slack_user_id"] == TASK_KWARGS["slack_user_id"]
        renderable_text = call_kwargs["renderable"]["text"]
        assert "C9999LINKED" in renderable_text
        assert "/invite @Sentry" in renderable_text
        assert "team=T0TEAM" in renderable_text

    @patch("sentry.analytics.record")
    @patch("sentry.seer.entrypoints.slack.tasks._count_linked_users", return_value=0)
    @patch("sentry.seer.entrypoints.slack.tasks.SeerAgentOperator")
    @patch("sentry.seer.entrypoints.slack.tasks.SlackAgentEntrypoint")
    @patch("sentry.seer.entrypoints.slack.tasks._resolve_user")
    def test_partial_resolution_still_sends_ephemeral_for_unresolved(
        self, mock_resolve_user, mock_agent_cls, mock_operator_cls, _mock_count, _mock_record
    ):
        # One link resolves, one doesn't.
        def history_side_effect(*, channel_id, thread_ts):
            if channel_id == "C0OK":
                return [{"user": "UOK", "text": "ok", "ts": "1700000000.111111"}]
            return []

        mock_user, mock_entrypoint, mock_operator = self._build_mocks(history_side_effect)
        mock_resolve_user.return_value = mock_user
        mock_agent_cls.has_access.return_value = True
        mock_agent_cls.return_value = mock_entrypoint
        mock_operator_cls.return_value = mock_operator

        text = (
            "<@U0BOT> "
            "<https://acme.slack.com/archives/C0OK/p1700000000111111> and "
            "<https://acme.slack.com/archives/C0BAD/p1700000000222222>"
        )
        self._run(text=text, thread_ts=None)

        # Resolved link still made it into the prompt context.
        on_page_context = mock_operator.trigger_agent.call_args[1]["on_page_context"]
        assert "<@UOK>: ok" in on_page_context

        # And we still tell the user about the channel we couldn't read.
        mock_entrypoint.install.send_threaded_ephemeral_message.assert_called_once()
        renderable_text = mock_entrypoint.install.send_threaded_ephemeral_message.call_args[1][
            "renderable"
        ]["text"]
        assert "C0BAD" in renderable_text
        assert "C0OK" not in renderable_text  # the resolved channel is not mentioned

    @patch("sentry.analytics.record")
    @patch("sentry.seer.entrypoints.slack.tasks._count_linked_users", return_value=0)
    @patch("sentry.seer.entrypoints.slack.tasks.SeerAgentOperator")
    @patch("sentry.seer.entrypoints.slack.tasks.SlackAgentEntrypoint")
    @patch("sentry.seer.entrypoints.slack.tasks._resolve_user")
    def test_multiple_unresolved_channels_listed_in_ephemeral(
        self, mock_resolve_user, mock_agent_cls, mock_operator_cls, _mock_count, _mock_record
    ):
        mock_user, mock_entrypoint, mock_operator = self._build_mocks(lambda **_: [])
        mock_resolve_user.return_value = mock_user
        mock_agent_cls.has_access.return_value = True
        mock_agent_cls.return_value = mock_entrypoint
        mock_operator_cls.return_value = mock_operator

        text = (
            "<@U0BOT> "
            "<https://acme.slack.com/archives/C0AAA/p1700000000111111> and "
            "<https://acme.slack.com/archives/C0BBB/p1700000000222222>"
        )
        self._run(text=text, thread_ts=None)

        renderable_text = mock_entrypoint.install.send_threaded_ephemeral_message.call_args[1][
            "renderable"
        ]["text"]
        assert "C0AAA" in renderable_text
        assert "C0BBB" in renderable_text

    @patch("sentry.analytics.record")
    @patch("sentry.seer.entrypoints.slack.tasks._count_linked_users", return_value=0)
    @patch("sentry.seer.entrypoints.slack.tasks.SeerAgentOperator")
    @patch("sentry.seer.entrypoints.slack.tasks.SlackAgentEntrypoint")
    @patch("sentry.seer.entrypoints.slack.tasks._resolve_user")
    def test_linked_block_precedes_in_thread_context(
        self, mock_resolve_user, mock_agent_cls, mock_operator_cls, _mock_count, _mock_record
    ):
        def history_side_effect(*, channel_id, thread_ts):
            if channel_id == "C9999LINKED":
                return [{"user": "ULINK", "text": "linked body", "ts": "1700000000.222222"}]
            # In-thread context for the channel/thread the user is mentioning from.
            if channel_id == "C1234567890" and thread_ts == "1234567890.123456":
                return [{"user": "UTHREAD", "text": "earlier in thread", "ts": "1234567890.000001"}]
            return []

        mock_user, mock_entrypoint, mock_operator = self._build_mocks(history_side_effect)
        mock_resolve_user.return_value = mock_user
        mock_agent_cls.has_access.return_value = True
        mock_agent_cls.return_value = mock_entrypoint
        mock_operator_cls.return_value = mock_operator

        self._run(text=f"<@U0BOT> see <{self.LINKED_PERMALINK}>")

        on_page_context = mock_operator.trigger_agent.call_args[1]["on_page_context"]
        assert on_page_context is not None
        linked_idx = on_page_context.index("Linked Slack message")
        thread_idx = on_page_context.index("<@UTHREAD>")
        assert linked_idx < thread_idx
        assert "<@ULINK>: linked body" in on_page_context
        assert "<@UTHREAD>: earlier in thread" in on_page_context

    @patch("sentry.analytics.record")
    @patch("sentry.seer.entrypoints.slack.tasks._count_linked_users", return_value=0)
    @patch("sentry.seer.entrypoints.slack.tasks.SeerAgentOperator")
    @patch("sentry.seer.entrypoints.slack.tasks.SlackAgentEntrypoint")
    @patch("sentry.seer.entrypoints.slack.tasks._resolve_user")
    def test_other_workspace_link_is_skipped(
        self, mock_resolve_user, mock_agent_cls, mock_operator_cls, _mock_count, _mock_record
    ):
        mock_user, mock_entrypoint, mock_operator = self._build_mocks(lambda **_: [])
        mock_resolve_user.return_value = mock_user
        mock_agent_cls.has_access.return_value = True
        mock_agent_cls.return_value = mock_entrypoint
        mock_operator_cls.return_value = mock_operator

        # domain_name is "acme.slack.com"; this link targets "other.slack.com".
        url = "https://other.slack.com/archives/C9999OTHER/p1700000000222222"
        self._run(text=f"<@U0BOT> ignore <{url}>", thread_ts=None)

        # No fetch should be attempted for an out-of-workspace permalink, and we
        # don't bug the user about a channel they couldn't have invited us to.
        mock_entrypoint.install.get_thread_history.assert_not_called()
        mock_entrypoint.install.send_threaded_ephemeral_message.assert_not_called()
        assert mock_operator.trigger_agent.call_args[1]["on_page_context"] is None


class BuildInaccessibleLinksRenderableTest(TestCase):
    def test_single_channel_uses_inline_link(self) -> None:
        renderable = _build_inaccessible_links_renderable(team_id="T0TEAM", channel_ids=["C0AAA"])
        assert "the Slack message you linked" in renderable["text"]
        assert "<slack://channel?team=T0TEAM&id=C0AAA|Open the channel>" in renderable["text"]
        assert "/invite @Sentry" in renderable["text"]

    def test_multiple_channels_use_bullet_list(self) -> None:
        renderable = _build_inaccessible_links_renderable(
            team_id="T0TEAM", channel_ids=["C0AAA", "C0BBB"]
        )
        assert "some of the Slack messages you linked" in renderable["text"]
        assert "• <slack://channel?team=T0TEAM&id=C0AAA|Open channel>" in renderable["text"]
        assert "• <slack://channel?team=T0TEAM&id=C0BBB|Open channel>" in renderable["text"]


class CapLinkedThreadTest(TestCase):
    """Direct tests for the policy that trims oversized linked threads."""

    def _msgs(self, count: int) -> list[dict]:
        return [
            {"user": f"U{i}", "text": f"msg {i}", "ts": f"1700000000.{i:06d}"} for i in range(count)
        ]

    def test_below_cap_returns_unchanged(self) -> None:
        link = SlackMessageLink(channel_id="C0", ts="1700000000.000003")
        msgs = self._msgs(10)
        assert _cap_linked_thread(msgs, link, 50) == msgs

    def test_at_cap_returns_unchanged(self) -> None:
        link = SlackMessageLink(channel_id="C0", ts="1700000000.000003")
        msgs = self._msgs(50)
        assert _cap_linked_thread(msgs, link, 50) == msgs

    def test_drops_oldest_replies_keeping_parent_and_recent(self) -> None:
        # Linked message coincides with the parent (index 0), so we keep the
        # parent + the most recent (max_messages - 1) replies.
        link = SlackMessageLink(channel_id="C0", ts="1700000000.000000")
        msgs = self._msgs(100)
        result = _cap_linked_thread(msgs, link, 5)
        assert len(result) == 5
        assert result[0] == msgs[0]
        assert result[1:] == msgs[-4:]

    def test_preserves_linked_message_in_the_middle(self) -> None:
        # A user-pasted permalink can target a specific reply that's neither the
        # parent nor in the most recent slice — it MUST still show up.
        link = SlackMessageLink(channel_id="C0", ts="1700000000.000050")
        msgs = self._msgs(200)
        result = _cap_linked_thread(msgs, link, 10)
        assert len(result) == 10
        assert msgs[0] in result  # parent always included
        assert msgs[50] in result  # explicitly linked message always included
        # The remaining slots should be filled from the most recent end.
        assert msgs[-1] in result

    def test_preserves_chronological_order(self) -> None:
        link = SlackMessageLink(channel_id="C0", ts="1700000000.000050")
        msgs = self._msgs(200)
        result = _cap_linked_thread(msgs, link, 10)
        result_ts = [m["ts"] for m in result]
        assert result_ts == sorted(result_ts)

    def test_linked_ts_not_present_falls_back_to_recent(self) -> None:
        # If conversations.replies returned messages but the exact linked ts
        # isn't there (e.g., it was deleted), we still cap gracefully.
        link = SlackMessageLink(channel_id="C0", ts="1700000000.999999")
        msgs = self._msgs(100)
        result = _cap_linked_thread(msgs, link, 5)
        assert len(result) == 5
        assert result[0] == msgs[0]
        assert result[1:] == msgs[-4:]
