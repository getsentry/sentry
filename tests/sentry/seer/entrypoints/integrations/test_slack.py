from unittest.mock import ANY, Mock, patch

from fixtures.seer.webhooks import MOCK_RUN_ID, MOCK_SEER_WEBHOOKS
from sentry.integrations.slack.requests.action import SlackActionRequest
from sentry.notifications.platform.templates.seer import SeerAutofixUpdate
from sentry.seer.autofix.utils import AutofixStoppingPoint
from sentry.seer.entrypoints.integrations.slack import (
    SlackEntrypoint,
    SlackEntrypointCachePayload,
    _send_thread_update,
    _update_existing_message,
    transform_block_actions,
)
from sentry.testutils.cases import TestCase


class SlackEntrypointTest(TestCase):
    def setUp(self):
        self.slack_user_id = "UXXXXXXXXX1"
        self.channel_id = "CXXXXXXXXX1"
        self.thread_ts = "1712345678.987654"
        self.integration = self.create_integration(
            organization=self.organization,
            external_id="TXXXXXXXXX1",
            provider="slack",
        )
        self.slack_request: SlackActionRequest = Mock()
        self.slack_request.integration = self.integration
        self.slack_request.channel_id = self.channel_id
        self.slack_request.user_id = self.slack_user_id
        self.slack_request.data = {"message": {"ts": self.thread_ts}}

    @patch("sentry.integrations.slack.integration.SlackIntegration.send_threaded_ephemeral_message")
    def test_on_trigger_autofix_error(self, mock_send_threaded_ephemeral_message):
        ep = SlackEntrypoint(
            slack_request=self.slack_request,
            group=self.group,
            organization_id=self.organization.id,
        )
        ep.on_trigger_autofix_error(error="Test error")
        mock_send_threaded_ephemeral_message.assert_called_with(
            channel_id=self.channel_id,
            thread_ts=self.thread_ts,
            renderable=ANY,
            slack_user_id=self.slack_request.user_id,
        )

    @patch("sentry.integrations.slack.integration.SlackIntegration.update_message")
    @patch("sentry.integrations.slack.integration.SlackIntegration.send_threaded_ephemeral_message")
    def test_on_trigger_autofix_success(
        self, mock_send_threaded_ephemeral_message, mock_update_message
    ):
        self.slack_request.data = {
            "message": {
                "ts": self.thread_ts,
                "text": "Issue notification",
                "blocks": [],
            }
        }
        ep = SlackEntrypoint(
            slack_request=self.slack_request,
            group=self.group,
            organization_id=self.organization.id,
        )
        ep.on_trigger_autofix_success(run_id=MOCK_RUN_ID)
        mock_send_threaded_ephemeral_message.assert_called_with(
            channel_id=self.channel_id,
            thread_ts=self.thread_ts,
            renderable=ANY,
            slack_user_id=self.slack_request.user_id,
        )
        mock_update_message.assert_called_once()

    def test_create_autofix_cache_payload(self):
        ep = SlackEntrypoint(
            slack_request=self.slack_request,
            group=self.group,
            organization_id=self.organization.id,
        )
        cache_payload = ep.create_autofix_cache_payload()
        SlackEntrypointCachePayload(**cache_payload)
        assert cache_payload["group_link"] == self.group.get_absolute_url()
        assert cache_payload["organization_id"] == self.organization.id
        assert cache_payload["integration_id"] == self.integration.id
        assert cache_payload["project_id"] == self.group.project.id
        assert cache_payload["group_id"] == self.group.id
        assert cache_payload["thread_ts"] == self.thread_ts
        assert cache_payload["channel_id"] == self.channel_id

    @patch("sentry.integrations.slack.integration.SlackIntegration.send_threaded_message")
    def test_on_autofix_update(self, mock_send_threaded_message):
        ep = SlackEntrypoint(
            slack_request=self.slack_request,
            group=self.group,
            organization_id=self.organization.id,
        )
        for event_type, event_payload in MOCK_SEER_WEBHOOKS.items():
            cache_payload = ep.create_autofix_cache_payload()
            ep.on_autofix_update(
                event_type=event_type, event_payload=event_payload, cache_payload=cache_payload
            )
            mock_send_threaded_message.assert_called_with(
                channel_id=self.channel_id,
                thread_ts=self.thread_ts,
                renderable=ANY,
            )

    @patch("sentry.integrations.slack.integration.SlackIntegration.send_threaded_ephemeral_message")
    @patch("sentry.integrations.slack.integration.SlackIntegration.send_threaded_message")
    def test__send_thread_update(
        self, mock_send_threaded_message, mock_send_threaded_ephemeral_message
    ):
        data = SeerAutofixUpdate(
            run_id=MOCK_RUN_ID,
            organization_id=self.organization.id,
            project_id=self.group.project.id,
            group_id=self.group.id,
            current_point=AutofixStoppingPoint.SOLUTION,
            group_link=self.group.get_absolute_url(),
        )
        install = self.integration.get_installation(organization_id=self.organization.id)

        _send_thread_update(
            install=install, channel_id=self.channel_id, thread_ts=self.thread_ts, data=data
        )
        mock_send_threaded_message.assert_called_with(
            channel_id=self.channel_id,
            thread_ts=self.thread_ts,
            renderable=ANY,
        )
        mock_send_threaded_ephemeral_message.assert_not_called()

        mock_send_threaded_message.reset_mock()
        _send_thread_update(
            install=install,
            channel_id=self.channel_id,
            thread_ts=self.thread_ts,
            data=data,
            ephemeral_user_id=self.slack_user_id,
        )
        mock_send_threaded_message.assert_not_called()
        mock_send_threaded_ephemeral_message.assert_called_with(
            channel_id=self.channel_id,
            thread_ts=self.thread_ts,
            renderable=ANY,
            slack_user_id=self.slack_user_id,
        )

    def test_transform_block_actions_removes_matching_elements(self):
        blocks = [
            {"type": "section", "text": {"type": "plain_text", "text": "Keep this"}},
            {
                "type": "actions",
                "elements": [
                    {
                        "type": "button",
                        "action_id": "remove_me",
                        "text": {"type": "plain_text", "text": "Remove"},
                    },
                    {
                        "type": "button",
                        "action_id": "keep_me",
                        "text": {"type": "plain_text", "text": "Keep"},
                    },
                ],
            },
        ]

        result = transform_block_actions(
            blocks, lambda elem: None if elem.get("action_id") == "remove_me" else elem
        )

        assert len(result) == 2
        assert result[0]["type"] == "section"
        assert len(result[1]["elements"]) == 1
        assert result[1]["elements"][0]["action_id"] == "keep_me"

    def test_transform_block_actions_removes_empty_action_blocks(self):
        blocks = [
            {
                "type": "actions",
                "elements": [
                    {"type": "button", "action_id": "remove_me"},
                ],
            },
        ]

        result = transform_block_actions(
            blocks, lambda elem: None if elem.get("action_id") == "remove_me" else elem
        )

        assert len(result) == 0

    @patch("sentry.integrations.slack.integration.SlackIntegration.update_message")
    def test_update_existing_message(self, mock_update_message):
        self.slack_request.data = {
            "message": {
                "ts": self.thread_ts,
                "text": "Issue notification",
                "blocks": [
                    {"type": "section", "text": {"type": "plain_text", "text": "Issue found"}},
                    {
                        "type": "actions",
                        "elements": [
                            {"type": "button", "action_id": "seer_autofix_start_root_cause"},
                            {"type": "button", "action_id": "other_action"},
                        ],
                    },
                ],
            }
        }

        install = self.integration.get_installation(organization_id=self.organization.id)
        _update_existing_message(
            request=self.slack_request,
            install=install,
            channel_id=self.channel_id,
            message_ts=self.thread_ts,
        )

        mock_update_message.assert_called_once()
        call_args = mock_update_message.call_args
        assert call_args.kwargs["channel_id"] == self.channel_id
        assert call_args.kwargs["message_ts"] == self.thread_ts
        renderable = call_args.kwargs["renderable"]
        assert len(renderable["blocks"]) == 2
        assert len(renderable["blocks"][1]["elements"]) == 1
        assert renderable["blocks"][1]["elements"][0]["action_id"] == "other_action"

    @patch("sentry.integrations.slack.integration.SlackIntegration.update_message")
    @patch("sentry.integrations.slack.integration.SlackIntegration.send_threaded_ephemeral_message")
    def test_on_trigger_autofix_success_updates_message(
        self, mock_send_threaded_ephemeral_message, mock_update_message
    ):
        self.slack_request.data = {
            "message": {
                "ts": self.thread_ts,
                "text": "Issue notification",
                "blocks": [
                    {
                        "type": "actions",
                        "elements": [
                            {"type": "button", "action_id": "seer_autofix_start_root_cause"}
                        ],
                    }
                ],
            }
        }

        ep = SlackEntrypoint(
            slack_request=self.slack_request,
            group=self.group,
            organization_id=self.organization.id,
        )
        ep.on_trigger_autofix_success(run_id=MOCK_RUN_ID)

        mock_send_threaded_ephemeral_message.assert_called_once()
        mock_update_message.assert_called_once()
