import re
from unittest.mock import Mock, patch
from urllib.parse import parse_qsl

import responses

from sentry.integrations.slack.unfurl import Handler, LinkType, make_type_coercer
from sentry.models import Identity, IdentityProvider, IdentityStatus
from sentry.utils import json

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

    def test_share_discover_links_unlinked_user_no_channel(self):
        IdentityProvider.objects.create(type="slack", external_id="TXXXXXXX1", config={})
        with self.feature("organizations:discover-basic"):
            responses.add(
                responses.POST, "https://slack.com/api/chat.postEphemeral", json={"ok": True}
            )
            responses.add(responses.POST, "https://slack.com/api/chat.unfurl", json={"ok": True})

            resp = self.post_webhook(event_data=json.loads(LINK_SHARED_EVENT_NO_CHANNEL_NAME))
            assert resp.status_code == 200, resp.content
            assert len(responses.calls) == 0

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
