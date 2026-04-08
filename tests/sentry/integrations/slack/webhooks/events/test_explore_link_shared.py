import re
from unittest.mock import Mock, patch

import orjson
import pytest
from slack_sdk.web import SlackResponse

from sentry.integrations.slack.unfurl.types import Handler, LinkType, make_type_coercer
from sentry.silo.base import SiloMode
from sentry.testutils.silo import assume_test_silo_mode
from sentry.users.models.identity import Identity, IdentityStatus

from . import LINK_SHARED_EVENT, BaseEventTest


class ExploreLinkSharedEvent(BaseEventTest):
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

    @patch(
        "sentry.integrations.slack.webhooks.event.match_link",
        side_effect=[
            (LinkType.EXPLORE, {"arg1": "value1"}),
            (LinkType.EXPLORE, {"arg1", "value2"}),
            (LinkType.EXPLORE, {"arg1": "value1"}),
        ],
    )
    @patch("sentry.integrations.slack.requests.event.has_explore_links", return_value=True)
    @patch(
        "sentry.integrations.slack.webhooks.event.link_handlers",
        {
            LinkType.EXPLORE: Handler(
                matcher=[re.compile(r"test")],
                arg_mapper=make_type_coercer({}),
                fn=Mock(return_value={"link1": "unfurl", "link2": "unfurl"}),
            )
        },
    )
    def share_explore_links_sdk(self, mock_match_link, mock_):
        resp = self.post_webhook(event_data=orjson.loads(LINK_SHARED_EVENT))
        assert resp.status_code == 200, resp.content
        return self.mock_unfurl.call_args[1]

    @patch(
        "sentry.integrations.slack.webhooks.event.match_link",
        side_effect=[
            (LinkType.EXPLORE, {"arg1": "value1"}),
            (LinkType.EXPLORE, {"arg1", "value2"}),
            (LinkType.EXPLORE, {"arg1": "value1"}),
        ],
    )
    @patch("sentry.integrations.slack.requests.event.has_explore_links", return_value=True)
    @patch(
        "sentry.integrations.slack.webhooks.event.link_handlers",
        {
            LinkType.EXPLORE: Handler(
                matcher=[re.compile(r"test")],
                arg_mapper=make_type_coercer({}),
                fn=Mock(return_value={"link1": "unfurl", "link2": "unfurl"}),
            )
        },
    )
    def share_explore_links_ephemeral_sdk(self, mock_match_link, mock_):
        resp = self.post_webhook(event_data=orjson.loads(LINK_SHARED_EVENT))
        assert resp.status_code == 200, resp.content
        return self.mock_post.call_args[1]

    def test_share_explore_links_unlinked_user(self) -> None:
        with assume_test_silo_mode(SiloMode.CONTROL):
            self.create_identity_provider(type="slack", external_id="TXXXXXXX1")
        with self.feature("organizations:data-browsing-widget-unfurl"):
            data = self.share_explore_links_ephemeral_sdk()

        blocks = orjson.loads(data["blocks"])

        assert blocks[0]["type"] == "section"
        assert (
            blocks[0]["text"]["text"]
            == "Link your Slack identity to Sentry to unfurl Discover charts."
        )

        assert blocks[1]["type"] == "actions"
        assert len(blocks[1]["elements"]) == 2
        assert [button["text"]["text"] for button in blocks[1]["elements"]] == ["Link", "Cancel"]

    def test_share_explore_links_linked_user(self) -> None:
        with assume_test_silo_mode(SiloMode.CONTROL):
            idp = self.create_identity_provider(type="slack", external_id="TXXXXXXX1")
            Identity.objects.create(
                external_id="Uxxxxxxx",
                idp=idp,
                user=self.user,
                status=IdentityStatus.VALID,
                scopes=[],
            )
        data = self.share_explore_links_sdk()

        unfurls = data["unfurls"]

        # We only have two unfurls since one link was duplicated
        assert len(unfurls) == 2
        assert unfurls["link1"] == "unfurl"
        assert unfurls["link2"] == "unfurl"
