import re
from unittest.mock import Mock, patch
from urllib.parse import parse_qsl

import orjson
import pytest
import responses
from slack_sdk.web import SlackResponse

from sentry.integrations.slack.unfurl.types import Handler, LinkType, make_type_coercer
from sentry.silo.base import SiloMode
from sentry.testutils.silo import assume_test_silo_mode
from sentry.users.models.identity import Identity, IdentityStatus

from . import LINK_SHARED_EVENT, BaseEventTest

LINK_SHARED_EVENT_NO_CHANNEL_NAME = """{
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


class DiscoverLinkSharedEvent(BaseEventTest):
    @pytest.fixture(autouse=True)
    def mock_chat_postEphemeral(self):
        with patch(
            "slack_sdk.web.client.WebClient.chat_postEphemeral",
            return_value=SlackResponse(
                client=None,
                http_verb="POST",
                api_url="https://slack.com/api/chat.postEphemeral",
                req_args={},
                data={"ok": True},
                headers={},
                status_code=200,
            ),
        ) as self.mock_post:
            yield

    @pytest.fixture(autouse=True)
    def mock_chat_unfurl(self):
        with patch(
            "slack_sdk.web.client.WebClient.chat_unfurl",
            return_value=SlackResponse(
                client=None,
                http_verb="POST",
                api_url="https://slack.com/api/chat.unfurl",
                req_args={},
                data={"ok": True},
                headers={},
                status_code=200,
            ),
        ) as self.mock_unfurl:
            yield

    @responses.activate
    @patch(
        "sentry.integrations.slack.webhooks.event.match_link",
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
        "sentry.integrations.slack.webhooks.event.link_handlers",
        {
            LinkType.DISCOVER: Handler(
                matcher=[re.compile(r"test")],
                arg_mapper=make_type_coercer({}),
                fn=Mock(return_value={"link1": "unfurl", "link2": "unfurl"}),
            )
        },
    )
    def share_discover_links(self, mock_match_link, mock_):
        responses.add(responses.POST, "https://slack.com/api/chat.postEphemeral", json={"ok": True})
        responses.add(responses.POST, "https://slack.com/api/chat.unfurl", json={"ok": True})

        resp = self.post_webhook(event_data=orjson.loads(LINK_SHARED_EVENT))
        assert resp.status_code == 200, resp.content

        data = responses.calls[0].request.body
        return dict(parse_qsl(data))

    @patch(
        "sentry.integrations.slack.webhooks.event.match_link",
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
        "sentry.integrations.slack.webhooks.event.link_handlers",
        {
            LinkType.DISCOVER: Handler(
                matcher=[re.compile(r"test")],
                arg_mapper=make_type_coercer({}),
                fn=Mock(return_value={"link1": "unfurl", "link2": "unfurl"}),
            )
        },
    )
    def share_discover_links_sdk(self, mock_match_link, mock_):
        resp = self.post_webhook(event_data=orjson.loads(LINK_SHARED_EVENT))
        assert resp.status_code == 200, resp.content

        return self.mock_unfurl.call_args[1]

    @patch(
        "sentry.integrations.slack.webhooks.event.match_link",
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
        "sentry.integrations.slack.webhooks.event.link_handlers",
        {
            LinkType.DISCOVER: Handler(
                matcher=[re.compile(r"test")],
                arg_mapper=make_type_coercer({}),
                fn=Mock(return_value={"link1": "unfurl", "link2": "unfurl"}),
            )
        },
    )
    def share_discover_links_ephermeral_sdk(self, mock_match_link, mock_):
        resp = self.post_webhook(event_data=orjson.loads(LINK_SHARED_EVENT))
        assert resp.status_code == 200, resp.content

        return self.mock_post.call_args[1]

    def test_share_discover_links_unlinked_user_sdk(self):
        with assume_test_silo_mode(SiloMode.CONTROL):
            self.create_identity_provider(type="slack", external_id="TXXXXXXX1")
        with self.feature("organizations:discover-basic"):
            data = self.share_discover_links_ephermeral_sdk()

        blocks = orjson.loads(data["blocks"])

        assert blocks[0]["type"] == "section"
        assert (
            blocks[0]["text"]["text"]
            == "Link your Slack identity to Sentry to unfurl Discover charts."
        )

        assert blocks[1]["type"] == "actions"
        assert len(blocks[1]["elements"]) == 2
        assert [button["text"]["text"] for button in blocks[1]["elements"]] == ["Link", "Cancel"]

    @responses.activate
    def test_share_discover_links_unlinked_user_no_channel(self):
        with assume_test_silo_mode(SiloMode.CONTROL):
            self.create_identity_provider(type="slack", external_id="TXXXXXXX1")
        with self.feature("organizations:discover-basic"):
            responses.add(
                responses.POST, "https://slack.com/api/chat.postEphemeral", json={"ok": True}
            )
            responses.add(responses.POST, "https://slack.com/api/chat.unfurl", json={"ok": True})

            resp = self.post_webhook(event_data=orjson.loads(LINK_SHARED_EVENT_NO_CHANNEL_NAME))
            assert resp.status_code == 200, resp.content
            assert len(responses.calls) == 0

    def test_share_discover_links_unlinked_user_no_channel_sdk(self):
        with assume_test_silo_mode(SiloMode.CONTROL):
            self.create_identity_provider(type="slack", external_id="TXXXXXXX1")
        with self.feature("organizations:discover-basic"):
            resp = self.post_webhook(event_data=orjson.loads(LINK_SHARED_EVENT_NO_CHANNEL_NAME))
            assert resp.status_code == 200, resp.content
            assert len(self.mock_post.mock_calls) == 0

    def test_share_discover_links_linked_user_sdk(self):
        with assume_test_silo_mode(SiloMode.CONTROL):
            idp = self.create_identity_provider(type="slack", external_id="TXXXXXXX1")
            Identity.objects.create(
                external_id="Uxxxxxxx",
                idp=idp,
                user=self.user,
                status=IdentityStatus.VALID,
                scopes=[],
            )
        data = self.share_discover_links_sdk()

        unfurls = orjson.loads(data["unfurls"])

        # We only have two unfurls since one link was duplicated
        assert len(unfurls) == 2
        assert unfurls["link1"] == "unfurl"
        assert unfurls["link2"] == "unfurl"
