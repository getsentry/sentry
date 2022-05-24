from unittest.mock import patch

from sentry.testutils import APITestCase
from sentry.testutils.helpers import install_slack

UNSET = object()

LINK_SHARED_EVENT = """{
    "type": "link_shared",
    "channel": "Cxxxxxx",
    "channel_name": "general",
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
