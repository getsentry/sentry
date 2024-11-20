from unittest.mock import patch

import orjson
import pytest
from slack_sdk.web import SlackResponse

from sentry.integrations.types import EventLifecycleOutcome
from sentry.silo.base import SiloMode
from sentry.testutils.cases import IntegratedApiTestCase
from sentry.testutils.helpers import get_response_text
from sentry.testutils.silo import assume_test_silo_mode
from sentry.users.models.identity import Identity, IdentityStatus

from . import BaseEventTest

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

    def test_identifying_channel_correctly(self):
        event_data = orjson.loads(MESSAGE_IM_EVENT)
        self.post_webhook(event_data=event_data)
        data = self.mock_post.call_args[1]
        assert data.get("channel") == event_data["channel"]

    def test_user_message_im_notification_platform(self):
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
    def test_user_message_link(self, mock_record):
        """
        Test that when a user types in "link" to the DM we reply with the correct response.
        """
        with assume_test_silo_mode(SiloMode.CONTROL):
            self.create_identity_provider(type="slack", external_id="TXXXXXXX1")

        resp = self.post_webhook(event_data=orjson.loads(MESSAGE_IM_EVENT_LINK))
        assert resp.status_code == 200, resp.content

        data = self.mock_post.call_args[1]
        assert "Link your Slack identity" in get_response_text(data)

        assert len(mock_record.mock_calls) == 2
        start, success = mock_record.mock_calls
        assert start.args[0] == EventLifecycleOutcome.STARTED
        assert success.args[0] == EventLifecycleOutcome.SUCCESS

    def test_user_message_already_linked_sdk(self):
        """
        Test that when a user who has already linked their identity types in
        "link" to the DM we reply with the correct response.
        """
        with assume_test_silo_mode(SiloMode.CONTROL):
            idp = self.create_identity_provider(type="slack", external_id="TXXXXXXX1")
            Identity.objects.create(
                external_id="UXXXXXXX1",
                idp=idp,
                user=self.user,
                status=IdentityStatus.VALID,
                scopes=[],
            )

        resp = self.post_webhook(event_data=orjson.loads(MESSAGE_IM_EVENT_LINK))
        assert resp.status_code == 200, resp.content

        data = self.mock_post.call_args[1]
        assert "You are already linked" in get_response_text(data)

    def test_user_message_unlink(self):
        """
        Test that when a user types in "unlink" to the DM we reply with the correct response.
        """
        with assume_test_silo_mode(SiloMode.CONTROL):
            idp = self.create_identity_provider(type="slack", external_id="TXXXXXXX1")
            Identity.objects.create(
                external_id="UXXXXXXX1",
                idp=idp,
                user=self.user,
                status=IdentityStatus.VALID,
                scopes=[],
            )

        resp = self.post_webhook(event_data=orjson.loads(MESSAGE_IM_EVENT_UNLINK))
        assert resp.status_code == 200, resp.content

        data = self.mock_post.call_args[1]
        assert "Click here to unlink your identity" in get_response_text(data)

    def test_user_message_already_unlinked(self):
        """
        Test that when a user without an Identity types in "unlink" to the DM we
        reply with the correct response.
        """
        with assume_test_silo_mode(SiloMode.CONTROL):
            self.create_identity_provider(type="slack", external_id="TXXXXXXX1")

        resp = self.post_webhook(event_data=orjson.loads(MESSAGE_IM_EVENT_UNLINK))
        assert resp.status_code == 200, resp.content

        data = self.mock_post.call_args[1]
        assert "You do not have a linked identity to unlink" in get_response_text(data)

    def test_bot_message_im(self):
        resp = self.post_webhook(event_data=orjson.loads(MESSAGE_IM_BOT_EVENT))
        assert resp.status_code == 200, resp.content

    def test_user_message_im_no_text(self):
        resp = self.post_webhook(event_data=orjson.loads(MESSAGE_IM_EVENT_NO_TEXT))
        assert resp.status_code == 200, resp.content
        assert not self.mock_post.called
