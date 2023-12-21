from unittest.mock import patch

from sentry.testutils.cases import APITestCase
from sentry.testutils.helpers import add_identity, install_slack
from sentry.utils import json


class BaseEventTest(APITestCase):
    def setUp(self):
        super().setUp()
        self.external_id = "slack:1"
        self.integration = install_slack(self.organization)
        self.idp = add_identity(self.integration, self.user, self.external_id)

        self.trigger_id = "13345224609.738474920.8088930838d88f008e0"
        self.response_url = (
            "https://hooks.slack.com/actions/T47563693/6204672533/x7ZLaiVMoECAW50Gw1ZYAXEM"
        )

    @patch(
        "sentry.integrations.slack.requests.base.SlackRequest._check_signing_secret",
        return_value=True,
    )
    def post_webhook(
        self,
        check_signing_secret_mock,
        action_data=None,
        type="event_callback",
        data=None,
        team_id="TXXXXXXX1",
        callback_id=None,
        slack_user=None,
        original_message=None,
    ):

        if slack_user is None:
            slack_user = {"id": self.external_id, "domain": "example"}

        if callback_id is None:
            callback_id = json.dumps({"issue": self.group.id})

        if original_message is None:
            original_message = {}

        payload = {
            "team": {"id": team_id, "domain": "example.com"},
            "channel": {"id": "C065W1189", "domain": "forgotten-works"},
            "user": slack_user,
            "callback_id": callback_id,
            "action_ts": "1458170917.164398",
            "message_ts": "1458170866.000004",
            "original_message": original_message,
            "trigger_id": self.trigger_id,
            "response_url": self.response_url,
            "attachment_id": "1",
            "actions": action_data or [],
            "type": type,
        }
        if data:
            payload.update(data)

        payload = {"payload": json.dumps(payload)}

        return self.client.post("/extensions/slack/action/", data=payload)

    @patch(
        "sentry.integrations.slack.requests.base.SlackRequest._check_signing_secret",
        return_value=True,
    )
    def post_webhook_block_kit(
        self,
        check_signing_secret_mock,
        action_data=None,
        type="block_actions",
        data=None,
        team_id="TXXXXXXX1",
        slack_user=None,
        original_message=None,
        selected_option=None,
        view=None,
        private_metadata=None,
    ):
        """Respond as if we were Slack"""
        if slack_user is None:
            slack_user = {
                "id": self.external_id,
                "name": "colleen",
                "username": "colleen",
                "team_id": team_id,
            }

        if original_message is None:
            original_message = {}

        payload = {
            "type": type,
            "team": {
                "id": team_id,
                "domain": "hb-meowcraft",
            },
            "user": slack_user,
            "api_app_id": "A058NGW5NDP",
            "token": "6IM9MzJR4Ees5x4jkW29iKbj",
            "trigger_id": self.trigger_id,
            "view": view,
            "response_urls": [],
            "enterprise": None,
            "is_enterprise_install": False,
        }

        if type == "view_submission":
            view = {
                "id": "V069MCJ1Y4X",
                "team_id": team_id,
                "type": "modal",
                "blocks": [
                    {
                        "type": "section",
                        "block_id": "a6HD+",
                        "text": {"type": "mrkdwn", "text": "Resolve in", "verbatim": False},
                        "accessory": {
                            "type": "static_select",
                            "action_id": "static_select-action",
                            "initial_option": {
                                "text": {
                                    "type": "plain_text",
                                    "text": "Immediately",
                                    "emoji": True,
                                },
                                "value": "resolved",
                            },
                            "options": [
                                {
                                    "text": {
                                        "type": "plain_text",
                                        "text": "Immediately",
                                        "emoji": True,
                                    },
                                    "value": "resolved",
                                },
                                {
                                    "text": {
                                        "type": "plain_text",
                                        "text": "In the next release",
                                        "emoji": True,
                                    },
                                    "value": "resolved:inNextRelease",
                                },
                                {
                                    "text": {
                                        "type": "plain_text",
                                        "text": "In the current release",
                                        "emoji": True,
                                    },
                                    "value": "resolved:inCurrentRelease",
                                },
                            ],
                        },
                    }
                ],
                "private_metadata": private_metadata,
                "state": {
                    "values": {
                        "a6HD+": {
                            "static_select-action": {
                                "type": "static_select",
                                "selected_option": {
                                    "text": {
                                        "type": "plain_text",
                                        "text": "Immediately",
                                        "emoji": True,
                                    },
                                    "value": selected_option,
                                },
                            }
                        }
                    }
                },
                "hash": "1702502121.CZNlXHKw",
                "title": {"type": "plain_text", "text": "Resolve Issue", "emoji": True},
                "clear_on_close": False,
                "notify_on_close": False,
                "close": {"type": "plain_text", "text": "Cancel", "emoji": True},
                "submit": {"type": "plain_text", "text": "Resolve", "emoji": True},
                "previous_view_id": None,
                "root_view_id": "V069MCJ1Y4X",
                "app_id": "A058NGW5NDP",
                "external_id": "",
                "app_installed_team_id": "TA17GH2QL",
                "bot_id": "B058CDV2LKW",
            }
            payload["response_urls"] = []
            payload["view"] = view

        elif type == "block_actions":
            payload["container"] = {
                "type": "message",
                "message_ts": "1702424381.221719",
                "channel_id": "C065W1189",
                "is_ephemeral": False,
            }
            payload["channel"] = {
                "id": "C065W1189",
                "name": "general",
            }
            payload["message"] = original_message
            payload["state"] = {
                "values": {
                    "bXwil": {
                        "assign": {
                            "type": "static_select",
                            "selected_option": selected_option,
                        }
                    }
                }
            }
            payload["response_url"] = self.response_url
            payload["actions"] = action_data or []

        if data:
            payload.update(data)

        payload = {"payload": json.dumps(payload)}
        return self.client.post("/extensions/slack/action/", data=payload)
