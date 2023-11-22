import re
from unittest.mock import Mock, patch
from urllib.parse import parse_qsl

import responses

from sentry.integrations.slack.unfurl import Handler, make_type_coercer
from sentry.testutils.silo import region_silo_test
from sentry.utils import json

from . import LINK_SHARED_EVENT, BaseEventTest


@region_silo_test
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
