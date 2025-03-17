import orjson

from sentry.integrations.slack.webhooks.action import (
    ENABLE_SLACK_SUCCESS_MESSAGE,
    NO_IDENTITY_MESSAGE,
)
from sentry.notifications.models.notificationsettingprovider import NotificationSettingProvider
from sentry.silo.base import SiloMode
from sentry.testutils.silo import assume_test_silo_mode
from sentry.users.models.identity import Identity

from . import BaseEventTest


class EnableNotificationsActionTest(BaseEventTest):
    def setUp(self):
        super().setUp()
        self.slack_id = "UXXXXXXX1"
        self.team_id = "TXXXXXXX1"

    def test_enable_all_slack_no_identity(self):
        with assume_test_silo_mode(SiloMode.CONTROL):
            Identity.objects.delete_identity(
                user=self.user,
                idp=self.idp,
                external_id=self.external_id,
            )
        response = self.post_webhook(
            action_data=[{"name": "enable_notifications", "value": "all_slack"}]
        )

        assert response.status_code == 200, response.content
        assert response.data["text"] == NO_IDENTITY_MESSAGE

    def test_enable_all_slack_already_enabled(self):
        provider = self.create_notification_settings_provider(
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
        assert response.status_code == 200, response.content
        assert response.data["text"] == ENABLE_SLACK_SUCCESS_MESSAGE

        self.user.refresh_from_db()  # Reload to fetch actor
        provider.refresh_from_db()
        assert provider.value == "always"

    def test_enable_all_slack(self):
        with assume_test_silo_mode(SiloMode.CONTROL):
            assert not NotificationSettingProvider.objects.all().exists()

        response = self.post_webhook(
            action_data=[{"name": "enable_notifications", "value": "all_slack"}]
        )
        self.user.refresh_from_db()  # Reload to fetch actor
        assert response.status_code == 200, response.content
        assert response.data["text"] == ENABLE_SLACK_SUCCESS_MESSAGE

        with assume_test_silo_mode(SiloMode.CONTROL):
            provider = NotificationSettingProvider.objects.get(
                user_id=self.user.id,
                scope_type="user",
                scope_identifier=self.user.id,
                type="alerts",
                provider="slack",
            )
            assert provider.value == "always"

    def test_enable_all_slack_block_kit(self):
        with assume_test_silo_mode(SiloMode.CONTROL):
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
        response = self.post_webhook_block_kit(
            action_data=[{"name": "enable_notifications", "value": "all_slack"}],
            original_message=original_message,
            data={"callback_id": orjson.dumps({"enable_notifications": True}).decode()},
        )
        self.user.refresh_from_db()  # Reload to fetch actor
        assert response.status_code == 200, response.content
        assert response.data["text"] == ENABLE_SLACK_SUCCESS_MESSAGE

        with assume_test_silo_mode(SiloMode.CONTROL):
            provider = NotificationSettingProvider.objects.get(
                user_id=self.user.id,
                scope_type="user",
                scope_identifier=self.user.id,
                type="alerts",
                provider="slack",
            )
            assert provider.value == "always"
