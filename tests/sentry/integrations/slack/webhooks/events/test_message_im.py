from unittest.mock import MagicMock, patch

import orjson
import pytest
from slack_sdk.web import SlackResponse

from sentry.integrations.messaging.metrics import SeerSlackHaltReason
from sentry.integrations.types import EventLifecycleOutcome
from sentry.testutils.asserts import assert_halt_metric, assert_slo_metric
from sentry.testutils.cases import IntegratedApiTestCase
from sentry.testutils.helpers import get_response_text

from . import SEER_EXPLORER_FEATURES, BaseEventTest

MESSAGE_IM_EVENT = """{
    "type": "message",
    "channel": "DOxxxxxx",
    "user": "Uxxxxxxx",
    "text": "helloo",
    "message_ts": "123456789.9875"
}"""

MESSAGE_IM_EVENT_NO_TEXT = """{
    "type": "message",
    "channel": "DOxxxxxx",
    "user": "Uxxxxxxx",
    "message_ts": "123456789.9875"
}"""

MESSAGE_IM_EVENT_UNLINK = """{
    "type": "message",
    "text": "unlink",
    "user": "UXXXXXXX1",
    "team": "TXXXXXXX1",
    "channel": "DTPJWTJ2D"
}"""

MESSAGE_IM_EVENT_LINK = """{
    "type": "message",
    "text": "link",
    "user": "UXXXXXXX1",
    "team": "TXXXXXXX1",
    "channel": "DTPJWTJ2D"
}"""

MESSAGE_IM_BOT_EVENT = """{
    "type": "message",
    "channel": "DOxxxxxx",
    "user": "Uxxxxxxx",
    "text": "helloo",
    "bot_id": "bot_id",
    "message_ts": "123456789.9875"
}"""


class MessageIMEventTest(BaseEventTest, IntegratedApiTestCase):
    """
    Tests for legacy messages to bot that would be interpreted as commands.
    This will be superceded by the explorer agentic workflow.
    """

    def get_block_section_text(self, data):
        blocks = data["blocks"]
        return blocks[0]["text"]["text"], blocks[1]["text"]["text"]

    @pytest.fixture(autouse=True)
    def mock_chat_postMessage(self):
        with patch(
            "slack_sdk.web.client.WebClient.chat_postMessage",
            return_value=SlackResponse(
                client=None,
                http_verb="POST",
                api_url="https://slack.com/api/chat.postMessage",
                req_args={},
                data={"ok": True},
                headers={},
                status_code=200,
            ),
        ) as self.mock_post:
            yield

    def test_identifying_channel_correctly(self) -> None:
        event_data = orjson.loads(MESSAGE_IM_EVENT)
        self.post_webhook(event_data=event_data)
        data = self.mock_post.call_args[1]
        assert data.get("channel") == event_data["channel"]

    def test_user_message_im_notification_platform(self) -> None:
        resp = self.post_webhook(event_data=orjson.loads(MESSAGE_IM_EVENT))
        assert resp.status_code == 200, resp.content

        data = self.mock_post.call_args[1]
        heading, contents = self.get_block_section_text(data)
        assert heading == "Unknown command: `helloo`"
        assert (
            contents
            == "Here are the commands you can use. Commands not working? Re-install the app!"
        )

    @patch("sentry.integrations.utils.metrics.EventLifecycle.record_event")
    def test_user_message_link(self, mock_record: MagicMock) -> None:
        """
        Test that when a user types in "link" to the DM we reply with the correct response.
        """
        resp = self.post_webhook(event_data=orjson.loads(MESSAGE_IM_EVENT_LINK))
        assert resp.status_code == 200, resp.content

        data = self.mock_post.call_args[1]
        assert "Link your Slack identity" in get_response_text(data)

        assert_slo_metric(mock_record, EventLifecycleOutcome.SUCCESS)

    def test_user_message_already_linked_sdk(self) -> None:
        """
        Test that when a user who has already linked their identity types in
        "link" to the DM we reply with the correct response.
        """
        self.create_identity(user=self.user, identity_provider=self.idp, external_id="UXXXXXXX1")

        resp = self.post_webhook(event_data=orjson.loads(MESSAGE_IM_EVENT_LINK))
        assert resp.status_code == 200, resp.content

        data = self.mock_post.call_args[1]
        assert "You are already linked" in get_response_text(data)

    def test_user_message_unlink(self) -> None:
        """
        Test that when a user types in "unlink" to the DM we reply with the correct response.
        """
        self.create_identity(user=self.user, identity_provider=self.idp, external_id="UXXXXXXX1")

        resp = self.post_webhook(event_data=orjson.loads(MESSAGE_IM_EVENT_UNLINK))
        assert resp.status_code == 200, resp.content

        data = self.mock_post.call_args[1]
        assert "Click here to unlink your identity" in get_response_text(data)

    def test_user_message_already_unlinked(self) -> None:
        """
        Test that when a user without an Identity types in "unlink" to the DM we
        reply with the correct response.
        """
        resp = self.post_webhook(event_data=orjson.loads(MESSAGE_IM_EVENT_UNLINK))
        assert resp.status_code == 200, resp.content

        data = self.mock_post.call_args[1]
        assert "You do not have a linked identity to unlink" in get_response_text(data)

    def test_bot_message_im(self) -> None:
        resp = self.post_webhook(event_data=orjson.loads(MESSAGE_IM_BOT_EVENT))
        assert resp.status_code == 200, resp.content

    def test_user_message_im_no_text(self) -> None:
        resp = self.post_webhook(event_data=orjson.loads(MESSAGE_IM_EVENT_NO_TEXT))
        assert resp.status_code == 200, resp.content
        assert not self.mock_post.called


MESSAGE_IM_DM_EVENT = {
    "type": "message",
    "channel": "DOxxxxxx",
    "user": "Uxxxxxxx",
    "text": "What is causing errors in my project?",
    "ts": "123456789.9875",
}

MESSAGE_IM_DM_EVENT_THREADED = {
    **MESSAGE_IM_DM_EVENT,
    "thread_ts": "123456789.0001",
}

AUTHORIZATIONS_DATA = {
    "authorizations": [{"user_id": "U0BOT", "is_bot": True}],
}


class MessageIMDmAgentTest(BaseEventTest):
    """Tests for DM messages triggering the Seer Explorer agentic workflow."""

    @pytest.fixture(autouse=True)
    def mock_chat_postMessage(self):
        with patch(
            "slack_sdk.web.client.WebClient.chat_postMessage",
            return_value=SlackResponse(
                client=None,
                http_verb="POST",
                api_url="https://slack.com/api/chat.postMessage",
                req_args={},
                data={"ok": True},
                headers={},
                status_code=200,
            ),
        ) as self.mock_post:
            yield

    @patch("sentry.seer.entrypoints.slack.tasks.process_mention_for_slack.apply_async")
    def test_dm_dispatches_task(self, mock_apply_async):
        with self.feature(SEER_EXPLORER_FEATURES):
            resp = self.post_webhook(event_data=MESSAGE_IM_DM_EVENT, data=AUTHORIZATIONS_DATA)

        assert resp.status_code == 200
        mock_apply_async.assert_called_once()
        kwargs = mock_apply_async.call_args[1]["kwargs"]
        assert kwargs["integration_id"] == self.integration.id
        assert kwargs["organization_id"] == self.organization.id
        assert kwargs["channel_id"] == "DOxxxxxx"
        assert kwargs["ts"] == "123456789.9875"
        assert kwargs["thread_ts"] is None
        assert kwargs["text"] == MESSAGE_IM_DM_EVENT["text"]
        assert kwargs["slack_user_id"] == "Uxxxxxxx"
        assert kwargs["bot_user_id"] == "U0BOT"

    @patch("sentry.seer.entrypoints.slack.tasks.process_mention_for_slack.apply_async")
    def test_dm_threaded_dispatches_task(self, mock_apply_async):
        with self.feature(SEER_EXPLORER_FEATURES):
            resp = self.post_webhook(
                event_data=MESSAGE_IM_DM_EVENT_THREADED, data=AUTHORIZATIONS_DATA
            )

        assert resp.status_code == 200
        mock_apply_async.assert_called_once()
        kwargs = mock_apply_async.call_args[1]["kwargs"]
        assert kwargs["ts"] == "123456789.9875"
        assert kwargs["thread_ts"] == "123456789.0001"

    @patch("sentry.seer.entrypoints.slack.tasks.process_mention_for_slack.apply_async")
    def test_dm_no_authorizations(self, mock_apply_async):
        with self.feature(SEER_EXPLORER_FEATURES):
            resp = self.post_webhook(event_data=MESSAGE_IM_DM_EVENT)

        assert resp.status_code == 200
        mock_apply_async.assert_called_once()
        kwargs = mock_apply_async.call_args[1]["kwargs"]
        assert kwargs["bot_user_id"] == ""

    @pytest.fixture(autouse=True)
    def mock_set_thread_status(self):
        with patch(
            "sentry.integrations.slack.integration.SlackIntegration.set_thread_status",
        ) as self.mock_status:
            yield

    @patch("sentry.integrations.utils.metrics.EventLifecycle.record_event")
    @patch("sentry.seer.entrypoints.slack.tasks.process_mention_for_slack.apply_async")
    def test_dm_feature_flag_disabled_falls_back_to_help(self, mock_apply_async, mock_record):
        """When feature flag is off, DM should fall back to help message."""
        resp = self.post_webhook(event_data=MESSAGE_IM_DM_EVENT)

        assert resp.status_code == 200
        mock_apply_async.assert_not_called()
        assert_halt_metric(mock_record, SeerSlackHaltReason.NO_VALID_ORGANIZATION)

    @patch("sentry.integrations.utils.metrics.EventLifecycle.record_event")
    @patch("sentry.seer.entrypoints.slack.tasks.process_mention_for_slack.apply_async")
    def test_dm_no_integration(self, mock_apply_async, mock_record):
        with patch(
            "sentry.integrations.slack.webhooks.event.integration_service.get_organization_integrations",
            return_value=[],
        ):
            with self.feature(SEER_EXPLORER_FEATURES):
                resp = self.post_webhook(event_data=MESSAGE_IM_DM_EVENT)

        assert resp.status_code == 200
        mock_apply_async.assert_not_called()
        assert_halt_metric(mock_record, SeerSlackHaltReason.NO_VALID_INTEGRATION)

    @patch("sentry.integrations.utils.metrics.EventLifecycle.record_event")
    @patch("sentry.seer.entrypoints.slack.tasks.process_mention_for_slack.apply_async")
    def test_dm_empty_text(self, mock_apply_async, mock_record):
        event_data = {**MESSAGE_IM_DM_EVENT, "text": ""}
        with self.feature(SEER_EXPLORER_FEATURES):
            resp = self.post_webhook(event_data=event_data)

        assert resp.status_code == 200
        mock_apply_async.assert_not_called()
        assert_halt_metric(mock_record, SeerSlackHaltReason.MISSING_EVENT_DATA)
