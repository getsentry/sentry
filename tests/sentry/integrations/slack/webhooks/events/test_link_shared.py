import re
from unittest.mock import Mock, patch

import orjson
import pytest
import responses
from slack_sdk.web import SlackResponse

from sentry.integrations.slack.unfurl.types import Handler, make_type_coercer

from . import LINK_SHARED_EVENT, BaseEventTest, build_test_block


class LinkSharedEventTest(BaseEventTest):
    @pytest.fixture(autouse=True)
    def mock_chat_unfurlMessage(self):
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
    def test_share_links_sdk(self, mock_match_link):
        resp = self.post_webhook(event_data=orjson.loads(LINK_SHARED_EVENT))
        assert resp.status_code == 200, resp.content
        assert len(mock_match_link.mock_calls) == 3

        data = self.mock_unfurl.call_args[1]
        unfurls = orjson.loads(data["unfurls"])

        # We only have two unfurls since one link was duplicated
        assert len(unfurls) == 2
        assert unfurls["link1"] == "unfurl"
        assert unfurls["link2"] == "unfurl"

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
    def test_share_links_block_kit_sdk(self, mock_match_link):
        resp = self.post_webhook(event_data=orjson.loads(LINK_SHARED_EVENT))
        assert resp.status_code == 200, resp.content
        assert len(mock_match_link.mock_calls) == 3

        data = self.mock_unfurl.call_args[1]
        unfurls = orjson.loads(data["unfurls"])

        # We only have two unfurls since one link was duplicated
        assert len(unfurls) == 2
        result1 = build_test_block(LINK_SHARED_EVENT[0])
        del result1["text"]
        result2 = build_test_block(LINK_SHARED_EVENT[1])
        del result2["text"]
        assert unfurls["link1"] == result1
        assert unfurls["link2"] == result2
