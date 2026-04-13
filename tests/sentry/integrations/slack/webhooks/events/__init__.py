from typing import Any
from unittest.mock import patch

import orjson

from sentry.testutils.cases import APITestCase
from sentry.testutils.helpers import install_slack
from sentry.testutils.silo import assume_test_silo_mode_of
from sentry.users.models.identity import Identity
from sentry.users.models.user import User

UNSET = object()

SEER_EXPLORER_FEATURES = {
    "organizations:seer-slack-explorer": True,
    "organizations:gen-ai-features": True,
    "organizations:seer-explorer": True,
}


LINK_SHARED_EVENT: dict[str, Any] = {
    "type": "link_shared",
    "channel": "Cxxxxxx",
    "channel_name": "general",
    "user": "Uxxxxxxx",
    "message_ts": "123456789.9875",
    "team_id": "TXXXXXXX1",
    "links": [
        {"domain": "example.com", "url": "http://testserver/organizations/test-org/issues/foo/"},
        {
            "domain": "example.com",
            "url": "http://testserver/organizations/test-org/issues/bar/baz/",
        },
        {
            "domain": "example.com",
            "url": "http://testserver/organizations/test-org/issues/bar/baz/",
        },
    ],
}


def build_test_block(link):
    return {
        "blocks": [
            {
                "type": "section",
                "text": {
                    "type": "mrkdwn",
                    "text": f"<{link}/1|*wow an issue very cool*> \n",
                },
                "block_id": orjson.dumps({"issue": 1}).decode(),
            }
        ],
        "text": "[foo] wow an issue very cool",
    }


class BaseEventTest(APITestCase):
    def setUp(self) -> None:
        super().setUp()
        self.integration = install_slack(self.organization)
        self.idp = self.create_identity_provider(
            type="slack", external_id=self.integration.external_id
        )

    def link_identity(self, slack_user_id: str, user: User | None = None):
        self.create_identity(
            user=user or self.user, identity_provider=self.idp, external_id=slack_user_id
        )

    def unlink_identity(self, user=None):
        with assume_test_silo_mode_of(Identity):
            Identity.objects.filter(user=user or self.user).delete()

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
