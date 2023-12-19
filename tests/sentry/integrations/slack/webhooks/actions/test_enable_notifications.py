from sentry.integrations.slack.webhooks.action import (
    ENABLE_SLACK_SUCCESS_MESSAGE,
    NO_IDENTITY_MESSAGE,
)
from sentry.models.identity import Identity
from sentry.models.notificationsettingprovider import NotificationSettingProvider
from sentry.models.user import User
from sentry.utils import json

from . import BaseEventTest


class EnableNotificationsActionTest(BaseEventTest):
    def setUp(self):
        super().setUp()
        self.slack_id = "UXXXXXXX1"
        self.team_id = "TXXXXXXX1"

    def test_enable_all_slack_no_identity(self):
        Identity.objects.delete_identity(user=self.user, idp=self.idp, external_id=self.external_id)
        response = self.post_webhook(
            action_data=[{"name": "enable_notifications", "value": "all_slack"}]
        )

        assert response.status_code == 200, response.content
        assert response.data["text"] == NO_IDENTITY_MESSAGE

    def test_enable_all_slack_already_enabled(self):
        NotificationSettingProvider.objects.create(
            user_id=self.user.id,
            scope_type="user",
            scope_identifier=self.user.id,
            type="alerts",
            provider="slack",
            value="never",
        )
        response = self.post_webhook(
            action_data=[{"name": "enable_notifications", "value": "all_slack"}]
        )
        self.user = User.objects.get(id=self.user.id)  # Reload to fetch actor
        assert response.status_code == 200, response.content
        assert response.data["text"] == ENABLE_SLACK_SUCCESS_MESSAGE

        assert (
            NotificationSettingProvider.objects.get(
                user_id=self.user.id,
                scope_type="user",
                scope_identifier=self.user.id,
                type="alerts",
                provider="slack",
            ).value
            == "always"
        )

    def test_enable_all_slack(self):
        assert not NotificationSettingProvider.objects.all().exists()

        response = self.post_webhook(
            action_data=[{"name": "enable_notifications", "value": "all_slack"}]
        )
        self.user = User.objects.get(id=self.user.id)  # Reload to fetch actor
        assert response.status_code == 200, response.content
        assert response.data["text"] == ENABLE_SLACK_SUCCESS_MESSAGE

        assert (
            NotificationSettingProvider.objects.get(
                user_id=self.user.id,
                scope_type="user",
                scope_identifier=self.user.id,
                type="alerts",
                provider="slack",
            ).value
            == "always"
        )

    def test_enable_all_slack_block_kit(self):
        assert not NotificationSettingProvider.objects.all().exists()
        original_message = {
            "blocks": [
                {
                    "type": "section",
                    "text": {
                        "type": "mrkdwn",
                        "text": "Check your email lately? We didn't think so. Get Sentry notifications in Slack.",
                    },
                },
                {
                    "type": "actions",
                    "elements": [
                        {
                            "type": "button",
                            "text": {
                                "type": "plain_text",
                                "text": "Turn on personal notifications",
                            },
                            "action_id": "enable_notifications",
                            "value": "all_slack",
                        }
                    ],
                },
            ]
        }
        with self.feature("organizations:slack-block-kit"):
            response = self.post_webhook_block_kit(
                action_data=[{"name": "enable_notifications", "value": "all_slack"}],
                original_message=original_message,
                data={"callback_id": json.dumps({"enable_notifications": True})},
            )
        self.user = User.objects.get(id=self.user.id)  # Reload to fetch actor
        assert response.status_code == 200, response.content
        assert response.data["text"] == ENABLE_SLACK_SUCCESS_MESSAGE

        assert (
            NotificationSettingProvider.objects.get(
                user_id=self.user.id,
                scope_type="user",
                scope_identifier=self.user.id,
                type="alerts",
                provider="slack",
            ).value
            == "always"
        )
