import re
from urllib.parse import parse_qsl

import responses

from sentry.integrations.slack.unfurl import Handler, make_type_coercer
from sentry.models import (
    Identity,
    IdentityProvider,
    IdentityStatus,
    Integration,
    OrganizationIntegration,
)
from sentry.testutils import APITestCase
from sentry.utils import json
from sentry.utils.compat import filter
from sentry.utils.compat.mock import Mock, patch

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
        self.user = self.create_user(is_superuser=False)
        self.org = self.create_organization(owner=None)
        self.integration = Integration.objects.create(
            provider="slack",
            external_id="TXXXXXXX1",
            metadata={"access_token": "xoxp-xxxxxxxxx-xxxxxxxxxx-xxxxxxxxxxxx"},
        )
        OrganizationIntegration.objects.create(organization=self.org, integration=self.integration)

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
        assert data["token"] == "xoxp-xxxxxxxxx-xxxxxxxxxx-xxxxxxxxxxxx"

    def test_user_access_token(self):
        # this test is needed to make sure that classic bots installed by on-prem users
        # still work since they needed to use a user_access_token for unfurl
        self.integration.metadata.update(
            {
                "user_access_token": "xoxt-xxxxxxxxx-xxxxxxxxxx-xxxxxxxxxxxx",
                "access_token": "xoxm-xxxxxxxxx-xxxxxxxxxx-xxxxxxxxxxxx",
            }
        )
        self.integration.save()

        data = self.share_links()
        assert data["token"] == "xoxt-xxxxxxxxx-xxxxxxxxxx-xxxxxxxxxxxx"


class MessageIMEventTest(BaseEventTest):
    def get_block_type_text(self, block_type, data):
        block = filter(lambda x: x["type"] == block_type, data["blocks"])[0]
        if block_type == "section":
            return block["text"]["text"]

        return block["elements"][0]["text"]["text"]

    @responses.activate
    def test_user_message_im(self):
        responses.add(responses.POST, "https://slack.com/api/chat.postMessage", json={"ok": True})
        resp = self.post_webhook(event_data=json.loads(MESSAGE_IM_EVENT))
        assert resp.status_code == 200, resp.content
        request = responses.calls[0].request
        assert request.headers["Authorization"] == "Bearer xoxp-xxxxxxxxx-xxxxxxxxxx-xxxxxxxxxxxx"
        data = json.loads(request.body)
        assert (
            self.get_block_type_text("section", data)
            == "Want to learn more about configuring alerts in Sentry? Check out our documentation."
        )
        assert self.get_block_type_text("actions", data) == "Sentry Docs"

    @responses.activate
    def test_user_message_im_notification_platform(self):
        responses.add(responses.POST, "https://slack.com/api/chat.postMessage", json={"ok": True})
        with self.feature("organizations:notification-platform"):
            resp = self.post_webhook(event_data=json.loads(MESSAGE_IM_EVENT))
        assert resp.status_code == 200, resp.content
        request = responses.calls[0].request
        assert request.headers["Authorization"] == "Bearer xoxp-xxxxxxxxx-xxxxxxxxxx-xxxxxxxxxxxx"
        data = json.loads(request.body)
        assert (
            self.get_block_type_text("section", data)
            == "Here are the commands you can use. Commands not working? Re-install the app!"
        )

    @responses.activate
    def test_user_message_link(self):
        """
        Test that when a user types in "link" to the DM we reply with the correct response
        """
        IdentityProvider.objects.create(type="slack", external_id="TXXXXXXX1", config={})

        responses.add(responses.POST, "https://slack.com/api/chat.postMessage", json={"ok": True})
        with self.feature("organizations:notification-platform"):
            resp = self.post_webhook(event_data=json.loads(MESSAGE_IM_EVENT_LINK))
        assert resp.status_code == 200, resp.content
        request = responses.calls[0].request
        assert request.headers["Authorization"] == "Bearer xoxp-xxxxxxxxx-xxxxxxxxxx-xxxxxxxxxxxx"
        data = json.loads(request.body)
        assert "Link your Slack identity" in data["text"]

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
        with self.feature("organizations:notification-platform"):
            resp = self.post_webhook(event_data=json.loads(MESSAGE_IM_EVENT_LINK))
        assert resp.status_code == 200, resp.content
        request = responses.calls[0].request
        assert request.headers["Authorization"] == "Bearer xoxp-xxxxxxxxx-xxxxxxxxxx-xxxxxxxxxxxx"
        data = json.loads(request.body)
        assert "You are already linked" in data["text"]

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
        with self.feature("organizations:notification-platform"):
            resp = self.post_webhook(event_data=json.loads(MESSAGE_IM_EVENT_UNLINK))
        assert resp.status_code == 200, resp.content
        request = responses.calls[0].request
        assert request.headers["Authorization"] == "Bearer xoxp-xxxxxxxxx-xxxxxxxxxx-xxxxxxxxxxxx"
        data = json.loads(request.body)
        assert "Click here to unlink your identity" in data["text"]

    @responses.activate
    def test_user_message_already_unlinked(self):
        """
        Test that when a user without an Identity types in "unlink" to the DM we reply with the correct response
        """
        IdentityProvider.objects.create(type="slack", external_id="TXXXXXXX1", config={})

        responses.add(responses.POST, "https://slack.com/api/chat.postMessage", json={"ok": True})
        with self.feature("organizations:notification-platform"):
            resp = self.post_webhook(event_data=json.loads(MESSAGE_IM_EVENT_UNLINK))
        assert resp.status_code == 200, resp.content
        request = responses.calls[0].request
        assert request.headers["Authorization"] == "Bearer xoxp-xxxxxxxxx-xxxxxxxxxx-xxxxxxxxxxxx"
        data = json.loads(request.body)
        assert "You do not have a linked identity to unlink" in data["text"]

    def test_bot_message_im(self):
        resp = self.post_webhook(event_data=json.loads(MESSAGE_IM_BOT_EVENT))
        assert resp.status_code == 200, resp.content
