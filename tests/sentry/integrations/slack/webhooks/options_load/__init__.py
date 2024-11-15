from unittest.mock import patch

import orjson

from sentry.testutils.cases import APITestCase
from sentry.testutils.helpers.slack import install_slack


class BaseEventTest(APITestCase):
    def setUp(self):
        super().setUp()
        self.external_id = "slack:1"
        self.integration = install_slack(self.organization)
        self.channel = {"channel_id": "C065W1189", "name": "workflow"}

    @patch(
        "sentry.integrations.slack.requests.SlackRequest._check_signing_secret", return_value=True
    )
    def post_webhook(
        self,
        check_signing_secret_mock,
        substring="",
        type="block_suggestion",
        data=None,
        team_id="TXXXXXXX1",
        slack_user=None,
        original_message=None,
        action_id="assign",
    ):
        if slack_user is None:
            slack_user = {
                "id": self.external_id,
                "name": "isabella",
                "username": "isabella",
                "team_id": team_id,
            }

        if original_message is None:
            original_message = {}

        payload = {}

        if type == "block_suggestion":
            payload = {
                "payload": orjson.dumps(
                    {
                        "type": type,
                        "user": slack_user,
                        "container": {
                            "type": "message",
                            "message_ts": "1702424387.108033",
                            "channel_id": "C065W1189",
                            "is_ephemeral": False,
                        },
                        "api_app_id": "A19Z2B84Y3C",
                        "token": "eLgKhjXiYh2GIFzeADwczbaA",
                        "action_id": action_id,
                        "value": substring,
                        "team": {"id": team_id, "domain": "iliekmudkipz"},
                        "enterprise": None,
                        "is_enterprise_install": False,
                        "channel": self.channel,
                        "message": original_message,
                    }
                ).decode()
            }
        if data:
            payload.update(data)

        return self.client.post("/extensions/slack/options-load/", payload)
