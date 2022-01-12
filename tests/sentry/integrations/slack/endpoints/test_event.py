import re
from unittest.mock import Mock, patch
from urllib.parse import parse_qsl

import responses

from sentry.integrations.slack.unfurl import Handler, LinkType, make_type_coercer
from sentry.models import Identity, IdentityProvider, IdentityStatus
from sentry.testutils import APITestCase
from sentry.testutils.helpers import get_response_text, install_slack
from sentry.utils import json

UNSET = object()

LINK_SHARED_EVENT = """{
    "type": "link_shared",
    "channel": "Cxxxxxx",
    "user": "Uxxxxxxx",
    "message_ts": "123456789.9875",
    "team_id": "TXXXXXXX1",
    "links": [
        {
            "domain": "example.com",
            "url": "http://testserver/organizations/test-org/issues/foo/"
        },
        {
            "domain": "example.com",
            "url": "http://testserver/organizations/test-org/issues/bar/baz/"
        },
        {
            "domain": "example.com",
            "url": "http://testserver/organizations/test-org/issues/bar/baz/"
        }
    ]
}"""

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


class BaseEventTest(APITestCase):
    def setUp(self):
        super().setUp()
        self.integration = install_slack(self.organization)

    @patch(
        "sentry.integrations.slack.requests.SlackRequest._check_signing_secret", return_value=True
    )
    def post_webhook(
        self,
        check_signing_secret_mock,
        event_data=None,
        type="event_callback",
        data=None,
        token=UNSET,
        team_id="TXXXXXXX1",
    ):
        payload = {
            "team_id": team_id,
            "api_app_id": "AXXXXXXXX1",
            "type": type,
            "authed_users": [],
            "event_id": "Ev08MFMKH6",
            "event_time": 123456789,
        }
        if data:
            payload.update(data)
        if event_data:
            payload.setdefault("event", {}).update(event_data)

        return self.client.post("/extensions/slack/event/", payload)


class UrlVerificationEventTest(BaseEventTest):
    challenge = "3eZbrw1aBm2rZgRNFdxV2595E9CY3gmdALWMmHkvFXO7tYXAYM8P"

    @patch(
        "sentry.integrations.slack.requests.SlackRequest._check_signing_secret", return_value=True
    )
    def test_valid_event(self, check_signing_secret_mock):
        resp = self.client.post(
            "/extensions/slack/event/",
            {
                "type": "url_verification",
                "challenge": self.challenge,
            },
        )
        assert resp.status_code == 200, resp.content
        assert resp.data["challenge"] == self.challenge


class LinkSharedEventTest(BaseEventTest):
    @responses.activate
    @patch(
        "sentry.integrations.slack.endpoints.event.match_link",
        # match_link will be called twice, for each our links. Resolve into
        # two unique links and one duplicate.
        side_effect=[
            ("mock_link", {"arg1": "value1"}),
            ("mock_link", {"arg1", "value2"}),
            ("mock_link", {"arg1": "value1"}),
        ],
    )
    @patch(
        "sentry.integrations.slack.endpoints.event.link_handlers",
        {
            "mock_link": Handler(
                matcher=re.compile(r"test"),
                arg_mapper=make_type_coercer({}),
                fn=Mock(return_value={"link1": "unfurl", "link2": "unfurl"}),
            )
        },
    )
    def share_links(self, mock_match_link):
        responses.add(responses.POST, "https://slack.com/api/chat.unfurl", json={"ok": True})

        resp = self.post_webhook(event_data=json.loads(LINK_SHARED_EVENT))
        assert resp.status_code == 200, resp.content
        assert len(mock_match_link.mock_calls) == 3

        data = dict(parse_qsl(responses.calls[0].request.body))
        unfurls = json.loads(data["unfurls"])

        # We only have two unfurls since one link was duplicated
        assert len(unfurls) == 2
        assert unfurls["link1"] == "unfurl"
        assert unfurls["link2"] == "unfurl"

        return data

    def test_valid_token(self):
        data = self.share_links()
        assert data["token"] == "xoxb-xxxxxxxxx-xxxxxxxxxx-xxxxxxxxxxxx"

    def test_user_access_token(self):
        # this test is needed to make sure that classic bots installed by
        # self-hosted users still work since they needed to use a
        # user_access_token for unfurl
        self.integration.metadata.update(
            {
                "user_access_token": "xoxt-xxxxxxxxx-xxxxxxxxxx-xxxxxxxxxxxx",
                "access_token": "xoxm-xxxxxxxxx-xxxxxxxxxx-xxxxxxxxxxxx",
            }
        )
        self.integration.save()

        data = self.share_links()
        assert data["token"] == "xoxt-xxxxxxxxx-xxxxxxxxxx-xxxxxxxxxxxx"


class DiscoverLinkSharedEvent(BaseEventTest):
    @responses.activate
    @patch(
        "sentry.integrations.slack.endpoints.event.match_link",
        # match_link will be called twice, for each our links. Resolve into
        # two unique links and one duplicate.
        side_effect=[
            (LinkType.DISCOVER, {"arg1": "value1"}),
            (LinkType.DISCOVER, {"arg1", "value2"}),
            (LinkType.DISCOVER, {"arg1": "value1"}),
        ],
    )
    @patch("sentry.integrations.slack.requests.event.has_discover_links", return_value=True)
    @patch(
        "sentry.integrations.slack.endpoints.event.link_handlers",
        {
            LinkType.DISCOVER: Handler(
                matcher=re.compile(r"test"),
                arg_mapper=make_type_coercer({}),
                fn=Mock(return_value={"link1": "unfurl", "link2": "unfurl"}),
            )
        },
    )
    def share_discover_links(self, mock_match_link, mock_):
        responses.add(responses.POST, "https://slack.com/api/chat.postEphemeral", json={"ok": True})
        responses.add(responses.POST, "https://slack.com/api/chat.unfurl", json={"ok": True})

        resp = self.post_webhook(event_data=json.loads(LINK_SHARED_EVENT))
        assert resp.status_code == 200, resp.content

        data = responses.calls[0].request.body
        return dict(parse_qsl(data))

    def test_share_discover_links_unlinked_user(self):
        IdentityProvider.objects.create(type="slack", external_id="TXXXXXXX1", config={})
        with self.feature("organizations:discover-basic"):
            data = self.share_discover_links()

        blocks = json.loads(data["blocks"])

        assert blocks[0]["type"] == "section"
        assert (
            blocks[0]["text"]["text"]
            == "Link your Slack identity to Sentry to unfurl Discover charts."
        )

        assert blocks[1]["type"] == "actions"
        assert len(blocks[1]["elements"]) == 2
        assert [button["text"]["text"] for button in blocks[1]["elements"]] == ["Link", "Cancel"]

    def test_share_discover_links_linked_user(self):
        idp = IdentityProvider.objects.create(type="slack", external_id="TXXXXXXX1", config={})
        Identity.objects.create(
            external_id="Uxxxxxxx",
            idp=idp,
            user=self.user,
            status=IdentityStatus.VALID,
            scopes=[],
        )
        data = self.share_discover_links()

        unfurls = json.loads(data["unfurls"])

        # We only have two unfurls since one link was duplicated
        assert len(unfurls) == 2
        assert unfurls["link1"] == "unfurl"
        assert unfurls["link2"] == "unfurl"


class MessageIMEventTest(BaseEventTest):
    def get_block_section_text(self, data):
        blocks = data["blocks"]
        return blocks[0]["text"]["text"], blocks[1]["text"]["text"]

    @responses.activate
    def test_user_message_im_notification_platform(self):
        responses.add(responses.POST, "https://slack.com/api/chat.postMessage", json={"ok": True})
        resp = self.post_webhook(event_data=json.loads(MESSAGE_IM_EVENT))
        assert resp.status_code == 200, resp.content
        request = responses.calls[0].request
        assert request.headers["Authorization"] == "Bearer xoxb-xxxxxxxxx-xxxxxxxxxx-xxxxxxxxxxxx"
        data = json.loads(request.body)
        heading, contents = self.get_block_section_text(data)
        assert heading == "Unknown command: `helloo`"
        assert (
            contents
            == "Here are the commands you can use. Commands not working? Re-install the app!"
        )

    @responses.activate
    def test_user_message_link(self):
        """
        Test that when a user types in "link" to the DM we reply with the correct response
        """
        IdentityProvider.objects.create(type="slack", external_id="TXXXXXXX1", config={})

        responses.add(responses.POST, "https://slack.com/api/chat.postMessage", json={"ok": True})
        resp = self.post_webhook(event_data=json.loads(MESSAGE_IM_EVENT_LINK))
        assert resp.status_code == 200, resp.content
        request = responses.calls[0].request
        assert request.headers["Authorization"] == "Bearer xoxb-xxxxxxxxx-xxxxxxxxxx-xxxxxxxxxxxx"
        data = json.loads(request.body)
        assert "Link your Slack identity" in get_response_text(data)

    @responses.activate
    def test_user_message_already_linked(self):
        """
        Test that when a user who has already linked their identity types in "link" to the DM we reply with the correct response
        """
        idp = IdentityProvider.objects.create(type="slack", external_id="TXXXXXXX1", config={})
        Identity.objects.create(
            external_id="UXXXXXXX1",
            idp=idp,
            user=self.user,
            status=IdentityStatus.VALID,
            scopes=[],
        )

        responses.add(responses.POST, "https://slack.com/api/chat.postMessage", json={"ok": True})
        resp = self.post_webhook(event_data=json.loads(MESSAGE_IM_EVENT_LINK))
        assert resp.status_code == 200, resp.content
        request = responses.calls[0].request
        assert request.headers["Authorization"] == "Bearer xoxb-xxxxxxxxx-xxxxxxxxxx-xxxxxxxxxxxx"
        data = json.loads(request.body)
        assert "You are already linked" in get_response_text(data)

    @responses.activate
    def test_user_message_unlink(self):
        """
        Test that when a user types in "unlink" to the DM we reply with the correct response
        """
        idp = IdentityProvider.objects.create(type="slack", external_id="TXXXXXXX1", config={})
        Identity.objects.create(
            external_id="UXXXXXXX1",
            idp=idp,
            user=self.user,
            status=IdentityStatus.VALID,
            scopes=[],
        )

        responses.add(responses.POST, "https://slack.com/api/chat.postMessage", json={"ok": True})
        resp = self.post_webhook(event_data=json.loads(MESSAGE_IM_EVENT_UNLINK))
        assert resp.status_code == 200, resp.content
        request = responses.calls[0].request
        assert request.headers["Authorization"] == "Bearer xoxb-xxxxxxxxx-xxxxxxxxxx-xxxxxxxxxxxx"
        data = json.loads(request.body)
        assert "Click here to unlink your identity" in get_response_text(data)

    @responses.activate
    def test_user_message_already_unlinked(self):
        """
        Test that when a user without an Identity types in "unlink" to the DM we reply with the correct response
        """
        IdentityProvider.objects.create(type="slack", external_id="TXXXXXXX1", config={})

        responses.add(responses.POST, "https://slack.com/api/chat.postMessage", json={"ok": True})
        resp = self.post_webhook(event_data=json.loads(MESSAGE_IM_EVENT_UNLINK))
        assert resp.status_code == 200, resp.content
        request = responses.calls[0].request
        assert request.headers["Authorization"] == "Bearer xoxb-xxxxxxxxx-xxxxxxxxxx-xxxxxxxxxxxx"
        data = json.loads(request.body)
        assert "You do not have a linked identity to unlink" in get_response_text(data)

    def test_bot_message_im(self):
        resp = self.post_webhook(event_data=json.loads(MESSAGE_IM_BOT_EVENT))
        assert resp.status_code == 200, resp.content

    @responses.activate
    def test_user_message_im_no_text(self):
        responses.add(responses.POST, "https://slack.com/api/chat.postMessage", json={"ok": True})
        resp = self.post_webhook(event_data=json.loads(MESSAGE_IM_EVENT_NO_TEXT))
        assert resp.status_code == 200, resp.content
        assert len(responses.calls) == 0
