import re
from unittest.mock import Mock, patch
from urllib.parse import parse_qsl

import responses

from sentry.integrations.slack.unfurl import Handler, make_type_coercer
from sentry.testutils.helpers.features import with_feature
from sentry.utils import json

from . import LINK_SHARED_EVENT, BaseEventTest, build_test_block


class LinkSharedEventTest(BaseEventTest):
    @responses.activate
    @patch(
        "sentry.integrations.slack.webhooks.event.match_link",
        # match_link will be called twice, for each our links. Resolve into
        # two unique links and one duplicate.
        side_effect=[
            ("mock_link", {"arg1": "value1"}),
            ("mock_link", {"arg1", "value2"}),
            ("mock_link", {"arg1": "value1"}),
        ],
    )
    @patch(
        "sentry.integrations.slack.webhooks.event.link_handlers",
        {
            "mock_link": Handler(
                matcher=[re.compile(r"test")],
                arg_mapper=make_type_coercer({}),
                fn=Mock(return_value={"link1": "unfurl", "link2": "unfurl"}),
            )
        },
    )
    def test_share_links(self, mock_match_link):
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

    @responses.activate
    @with_feature("organizations:slack-block-kit")
    @patch(
        "sentry.integrations.slack.webhooks.event.match_link",
        # match_link will be called twice, for each our links. Resolve into
        # two unique links and one duplicate.
        side_effect=[
            ("mock_link", {"arg1": "value1"}),
            ("mock_link", {"arg1", "value2"}),
            ("mock_link", {"arg1": "value1"}),
        ],
    )
    @patch(
        "sentry.integrations.slack.webhooks.event.link_handlers",
        {
            "mock_link": Handler(
                matcher=[re.compile(r"test")],
                arg_mapper=make_type_coercer({}),
                fn=Mock(
                    return_value={
                        "link1": build_test_block(LINK_SHARED_EVENT[0]),
                        "link2": build_test_block(LINK_SHARED_EVENT[1]),
                    }
                ),
            )
        },
    )
    def test_share_links_block_kit(self, mock_match_link):
        responses.add(responses.POST, "https://slack.com/api/chat.unfurl", json={"ok": True})

        resp = self.post_webhook(event_data=json.loads(LINK_SHARED_EVENT))
        assert resp.status_code == 200, resp.content
        assert len(mock_match_link.mock_calls) == 3

        data = dict(parse_qsl(responses.calls[0].request.body))
        unfurls = json.loads(data["unfurls"])

        # We only have two unfurls since one link was duplicated
        assert len(unfurls) == 2
        result1 = build_test_block(LINK_SHARED_EVENT[0])
        del result1["text"]
        result2 = build_test_block(LINK_SHARED_EVENT[1])
        del result2["text"]
        assert unfurls["link1"] == result1
        assert unfurls["link2"] == result2
