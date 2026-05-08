from unittest.mock import MagicMock, patch

from sentry.integrations.messaging.metrics import SeerSlackHaltReason
from sentry.seer.entrypoints.slack.analytics import (
    SlackSeerAgentConversation,
    SlackSeerAgentResponded,
)
from sentry.seer.entrypoints.slack.entrypoint import EntrypointSetupError
from sentry.seer.entrypoints.slack.metrics import (
    ProcessMentionFailureReason,
    ProcessMentionHaltReason,
)
from sentry.seer.entrypoints.slack.tasks import (
    _build_inaccessible_links_renderable,
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
    @patch("sentry.seer.entrypoints.slack.tasks.send_halt_message")
    @patch("sentry.seer.entrypoints.slack.tasks.SeerAgentOperator")
    @patch("sentry.seer.entrypoints.slack.tasks.SlackAgentEntrypoint")
    @patch("sentry.seer.entrypoints.slack.tasks._resolve_user")
    def test_identity_not_linked(
        self,
        mock_resolve_user,
        mock_agent_cls,
        mock_operator_cls,
        mock_send_halt,
        mock_record,
    ):
        mock_resolve_user.return_value = None

        mock_agent_cls.has_access.return_value = True
        mock_entrypoint = MagicMock()
        mock_entrypoint.thread_ts = "1234567890.123456"
        mock_agent_cls.return_value = mock_entrypoint

        self._run_task()

        mock_send_halt.assert_called_once_with(
            integration=mock_entrypoint.integration,
            slack_user_id=mock_entrypoint.slack_user_id,
            channel_id=mock_entrypoint.channel_id,
            thread_ts="1234567890.123456",
            halt_reason=SeerSlackHaltReason.IDENTITY_NOT_LINKED,
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

    def setUp(self):
        super().setUp()
        self.mock_resolve_user = self._start_patch(
            patch("sentry.seer.entrypoints.slack.tasks._resolve_user")
        )
        self.mock_agent_cls = self._start_patch(
            patch("sentry.seer.entrypoints.slack.tasks.SlackAgentEntrypoint")
        )
        self.mock_operator_cls = self._start_patch(
            patch("sentry.seer.entrypoints.slack.tasks.SeerAgentOperator")
        )
        self.mock_count = self._start_patch(
            patch("sentry.seer.entrypoints.slack.tasks._count_linked_users", return_value=0)
        )
        self.mock_record = self._start_patch(patch("sentry.analytics.record"))

        self._build_mocks()

    def _start_patch(self, p):
        mock = p.start()
        self.addCleanup(p.stop)
        return mock

    def _build_mocks(
        self,
        *,
        thread_history_side_effect=None,
        conversations_info_side_effect=None,
    ):
        self.mock_user = MagicMock(id=self.user.id, username="alice")
        self.mock_entrypoint = MagicMock()
        self.mock_entrypoint.thread_ts = "1234567890.123456"
        self.mock_entrypoint.channel_id = TASK_KWARGS["channel_id"]
        self.mock_entrypoint.slack_user_id = TASK_KWARGS["slack_user_id"]
        self.mock_entrypoint.integration.metadata = {"domain_name": "acme.slack.com"}
        self.mock_entrypoint.integration.external_id = "T0TEAM"

        # Default: every channel is public unless the test overrides this.
        self.mock_entrypoint.install.get_conversations_info.side_effect = (
            conversations_info_side_effect
            if conversations_info_side_effect is not None
            else lambda **_: {"channel": {"is_private": False}}
        )
        # ``get_thread_history`` covers both the permalink-resolution path
        # (with latest/oldest narrowing) and the in-thread context path.
        self.mock_entrypoint.install.get_thread_history.side_effect = (
            thread_history_side_effect if thread_history_side_effect is not None else lambda **_: []
        )

        self.mock_operator = MagicMock()
        self.mock_operator.trigger_agent.return_value = 42

        self.mock_resolve_user.return_value = self.mock_user
        self.mock_agent_cls.has_access.return_value = True
        self.mock_agent_cls.return_value = self.mock_entrypoint
        self.mock_operator_cls.return_value = self.mock_operator

    def _run(self, *, text, **overrides):
        kwargs = {
            **TASK_KWARGS,
            "organization_id": self.organization.id,
            "text": text,
            **overrides,
        }
        process_mention_for_slack(**kwargs)

    def test_top_level_permalink_fetches_single_message(self):
        def history(*, channel_id, thread_ts, **kwargs):
            if channel_id == "C9999LINKED":
                return [{"user": "ULINK", "text": "linked body", "ts": "1700000000.222222"}]
            return []

        self._build_mocks(thread_history_side_effect=history)

        self._run(text=f"<@U0BOT> what about <{self.LINKED_PERMALINK}>")

        # The fetch is narrowed to a single ts (latest=oldest, limit=1).
        self.mock_entrypoint.install.get_thread_history.assert_any_call(
            channel_id="C9999LINKED",
            thread_ts="1700000000.222222",
            latest="1700000000.222222",
            oldest="1700000000.222222",
            inclusive=True,
            limit=1,
        )

        on_page_context = self.mock_operator.trigger_agent.call_args[1]["on_page_context"]
        assert on_page_context is not None
        assert "User linked a Slack message in <#C9999LINKED>:" in on_page_context
        assert "<@ULINK>: linked body" in on_page_context

    def test_threaded_permalink_fetches_only_the_linked_reply(self):
        """A permalink into a thread reply must NOT pull the whole thread —
        we only ship the single targeted reply to Seer.

        ``conversations.replies`` always returns the parent even when narrowed,
        so we filter client-side.
        """

        def history(*, channel_id, thread_ts, **kwargs):
            if channel_id == "C9999LINKED" and thread_ts == "1700000000.111111":
                # Slack returned the parent + the requested reply — we should
                # filter to the reply and drop the parent.
                return [
                    {"user": "UPARENT", "text": "parent", "ts": "1700000000.111111"},
                    {"user": "UREPLY", "text": "reply", "ts": "1700000000.222222"},
                ]
            return []

        self._build_mocks(thread_history_side_effect=history)

        url = (
            "https://acme.slack.com/archives/C9999LINKED/p1700000000222222"
            "?thread_ts=1700000000.111111&cid=C9999LINKED"
        )
        self._run(text=f"<@U0BOT> see <{url}>")

        self.mock_entrypoint.install.get_thread_history.assert_any_call(
            channel_id="C9999LINKED",
            thread_ts="1700000000.111111",
            latest="1700000000.222222",
            oldest="1700000000.222222",
            inclusive=True,
            limit=1,
        )
        on_page_context = self.mock_operator.trigger_agent.call_args[1]["on_page_context"]
        assert "User linked a Slack message in <#C9999LINKED>:" in on_page_context
        assert "<@UREPLY>: reply" in on_page_context
        # The thread parent must be filtered out client-side.
        assert "UPARENT" not in on_page_context

    def test_unfurl_attachment_short_circuits_api_call(self):
        """If the inbound app_mention event already includes the unfurled
        message as an attachment, we use it directly — no Slack API calls."""
        attachments = [
            {
                "is_msg_unfurl": True,
                "from_url": self.LINKED_PERMALINK,
                "channel_id": "C9999LINKED",
                "channel_name": "general",
                "ts": "1700000000.222222",
                "author_id": "ULINK",
                "author_subname": "linker",
                "text": "linked body",
                "fallback": "[date] linker: linked body",
            }
        ]

        self._run(text=f"<@U0BOT> what about <{self.LINKED_PERMALINK}>", attachments=attachments)

        # We did NOT need to call out to Slack to read the linked channel.
        self.mock_entrypoint.install.get_conversations_info.assert_not_called()
        history_calls = self.mock_entrypoint.install.get_thread_history.call_args_list
        assert all(call.kwargs["channel_id"] != "C9999LINKED" for call in history_calls)

        on_page_context = self.mock_operator.trigger_agent.call_args[1]["on_page_context"]
        assert on_page_context is not None
        assert "User linked a Slack message in <#C9999LINKED>:" in on_page_context
        assert "<@ULINK>: linked body" in on_page_context

    def test_unfurl_attachment_with_blocks_preserves_rich_text(self):
        """Rich-text blocks on the unfurl attachment are preferred over flat text."""
        attachments = [
            {
                "is_msg_unfurl": True,
                "from_url": self.LINKED_PERMALINK,
                "channel_id": "C9999LINKED",
                "ts": "1700000000.222222",
                "author_id": "ULINK",
                "text": "fallback flat text",
                "message_blocks": [
                    {
                        "team": "T0TEAM",
                        "channel": "C9999LINKED",
                        "ts": "1700000000.222222",
                        "message": {
                            "blocks": [
                                {
                                    "type": "rich_text",
                                    "elements": [
                                        {
                                            "type": "rich_text_section",
                                            "elements": [
                                                {"type": "text", "text": "rich body"},
                                            ],
                                        }
                                    ],
                                }
                            ]
                        },
                    }
                ],
            }
        ]

        self._run(text=f"<@U0BOT> what about <{self.LINKED_PERMALINK}>", attachments=attachments)

        on_page_context = self.mock_operator.trigger_agent.call_args[1]["on_page_context"]
        assert on_page_context is not None
        assert "<@ULINK>: rich body" in on_page_context
        assert "fallback flat text" not in on_page_context

    def test_attachment_for_other_link_falls_through_to_api(self):
        """When the attachment's (channel_id, ts) doesn't match any link in
        the message, we fall through to the API path."""

        def history(*, channel_id, thread_ts, **kwargs):
            if channel_id == "C9999LINKED":
                return [{"user": "UFETCH", "text": "fetched body", "ts": "1700000000.222222"}]
            return []

        self._build_mocks(thread_history_side_effect=history)

        # Attachment for a totally different message — must not be used.
        attachments = [
            {
                "is_msg_unfurl": True,
                "channel_id": "C0OTHER",
                "ts": "1700000000.999999",
                "author_id": "UOTHER",
                "text": "irrelevant",
            }
        ]

        self._run(
            text=f"<@U0BOT> what about <{self.LINKED_PERMALINK}>",
            attachments=attachments,
        )

        self.mock_entrypoint.install.get_thread_history.assert_any_call(
            channel_id="C9999LINKED",
            thread_ts="1700000000.222222",
            latest="1700000000.222222",
            oldest="1700000000.222222",
            inclusive=True,
            limit=1,
        )
        on_page_context = self.mock_operator.trigger_agent.call_args[1]["on_page_context"]
        assert "<@UFETCH>: fetched body" in on_page_context
        assert "irrelevant" not in on_page_context

    def test_private_channel_skipped_and_user_notified(self):
        self._build_mocks(
            conversations_info_side_effect=lambda **_: {"channel": {"is_private": True}}
        )

        self._run(
            text=f"<@U0BOT> what about <{self.LINKED_PERMALINK}>",
            thread_ts=None,
        )

        # We didn't try to fetch the message from a private channel.
        self.mock_entrypoint.install.get_thread_history.assert_not_called()
        assert self.mock_operator.trigger_agent.call_args[1]["on_page_context"] is None

        renderable_text = self.mock_entrypoint.install.send_threaded_ephemeral_message.call_args[1][
            "renderable"
        ]["text"]
        assert "private channels" in renderable_text
        assert "<#C9999LINKED>" in renderable_text

    def test_unresolved_link_yields_no_block_and_sends_ephemeral(self):
        # get_thread_history returns [] → simulates missing scope or deleted message.
        self._run(
            text=f"<@U0BOT> what about <{self.LINKED_PERMALINK}>",
            thread_ts=None,
        )

        self.mock_entrypoint.install.get_thread_history.assert_called_once_with(
            channel_id="C9999LINKED",
            thread_ts="1700000000.222222",
            latest="1700000000.222222",
            oldest="1700000000.222222",
            inclusive=True,
            limit=1,
        )
        assert self.mock_operator.trigger_agent.call_args[1]["on_page_context"] is None

        self.mock_entrypoint.install.send_threaded_ephemeral_message.assert_called_once()
        call_kwargs = self.mock_entrypoint.install.send_threaded_ephemeral_message.call_args[1]
        assert call_kwargs["channel_id"] == TASK_KWARGS["channel_id"]
        assert call_kwargs["slack_user_id"] == TASK_KWARGS["slack_user_id"]
        renderable_text = call_kwargs["renderable"]["text"]
        assert "<#C9999LINKED>" in renderable_text
        assert "need to be invited" in renderable_text

    def test_partial_resolution_still_sends_ephemeral_for_unresolved(self):
        def history(*, channel_id, thread_ts, **kwargs):
            if channel_id == "C0OK":
                return [{"user": "UOK", "text": "ok", "ts": "1700000000.111111"}]
            return []

        self._build_mocks(thread_history_side_effect=history)

        text = (
            "<@U0BOT> "
            "<https://acme.slack.com/archives/C0OK/p1700000000111111> and "
            "<https://acme.slack.com/archives/C0BAD/p1700000000222222>"
        )
        self._run(text=text, thread_ts=None)

        on_page_context = self.mock_operator.trigger_agent.call_args[1]["on_page_context"]
        assert "<@UOK>: ok" in on_page_context

        self.mock_entrypoint.install.send_threaded_ephemeral_message.assert_called_once()
        renderable_text = self.mock_entrypoint.install.send_threaded_ephemeral_message.call_args[1][
            "renderable"
        ]["text"]
        assert "C0BAD" in renderable_text
        assert "C0OK" not in renderable_text

    def test_multiple_unresolved_channels_listed_in_ephemeral(self):
        text = (
            "<@U0BOT> "
            "<https://acme.slack.com/archives/C0AAA/p1700000000111111> and "
            "<https://acme.slack.com/archives/C0BBB/p1700000000222222>"
        )
        self._run(text=text, thread_ts=None)

        renderable_text = self.mock_entrypoint.install.send_threaded_ephemeral_message.call_args[1][
            "renderable"
        ]["text"]
        assert "C0AAA" in renderable_text
        assert "C0BBB" in renderable_text

    def test_linked_block_precedes_in_thread_context(self):
        def history(*, channel_id, thread_ts, **kwargs):
            # Permalink fetch (narrowed by latest/oldest)
            if channel_id == "C9999LINKED":
                return [{"user": "ULINK", "text": "linked body", "ts": "1700000000.222222"}]
            # In-thread context fetch (no latest/oldest)
            if (
                channel_id == "C1234567890"
                and thread_ts == "1234567890.123456"
                and "latest" not in kwargs
            ):
                return [{"user": "UTHREAD", "text": "earlier in thread", "ts": "1234567890.000001"}]
            return []

        self._build_mocks(thread_history_side_effect=history)

        self._run(text=f"<@U0BOT> see <{self.LINKED_PERMALINK}>")

        on_page_context = self.mock_operator.trigger_agent.call_args[1]["on_page_context"]
        assert on_page_context is not None
        linked_idx = on_page_context.index("User linked a Slack message")
        thread_idx = on_page_context.index("<@UTHREAD>")
        assert linked_idx < thread_idx
        assert "<@ULINK>: linked body" in on_page_context
        assert "<@UTHREAD>: earlier in thread" in on_page_context

    def test_other_workspace_link_is_skipped(self):
        # domain_name is "acme.slack.com"; this link targets "other.slack.com".
        url = "https://other.slack.com/archives/C9999OTHER/p1700000000222222"
        self._run(text=f"<@U0BOT> ignore <{url}>", thread_ts=None)

        self.mock_entrypoint.install.get_thread_history.assert_not_called()
        self.mock_entrypoint.install.send_threaded_ephemeral_message.assert_not_called()
        assert self.mock_operator.trigger_agent.call_args[1]["on_page_context"] is None


class BuildInaccessibleLinksRenderableTest(TestCase):
    def test_single_unresolved_channel(self) -> None:
        renderable = _build_inaccessible_links_renderable(
            unresolved_channel_ids=["C0AAA"],
            private_channel_ids=[],
        )
        assert "need to be invited" in renderable["text"]
        assert "<#C0AAA>" in renderable["text"]

    def test_multiple_unresolved_channels(self) -> None:
        renderable = _build_inaccessible_links_renderable(
            unresolved_channel_ids=["C0AAA", "C0BBB"],
            private_channel_ids=[],
        )
        assert "need to be invited" in renderable["text"]
        assert "<#C0AAA>" in renderable["text"]
        assert "<#C0BBB>" in renderable["text"]

    def test_single_private_channel(self) -> None:
        renderable = _build_inaccessible_links_renderable(
            unresolved_channel_ids=[],
            private_channel_ids=["C0PRIV"],
        )
        assert "private channels" in renderable["text"]
        assert "<#C0PRIV>" in renderable["text"]

    def test_multiple_private_channels(self) -> None:
        renderable = _build_inaccessible_links_renderable(
            unresolved_channel_ids=[],
            private_channel_ids=["C0PRIV1", "C0PRIV2"],
        )
        assert "private channels" in renderable["text"]
        assert "<#C0PRIV1>" in renderable["text"]
        assert "<#C0PRIV2>" in renderable["text"]

    def test_mixed_unresolved_and_private_renders_both_sections(self) -> None:
        renderable = _build_inaccessible_links_renderable(
            unresolved_channel_ids=["C0AAA"],
            private_channel_ids=["C0PRIV"],
        )
        assert "need to be invited" in renderable["text"]
        assert "<#C0AAA>" in renderable["text"]
        assert "private channels" in renderable["text"]
        assert "<#C0PRIV>" in renderable["text"]
