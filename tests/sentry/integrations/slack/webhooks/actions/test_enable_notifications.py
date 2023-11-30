from sentry.integrations.slack.webhooks.action import (
    ENABLE_SLACK_SUCCESS_MESSAGE,
    NO_IDENTITY_MESSAGE,
)
from sentry.models.identity import Identity
from sentry.models.notificationsettingprovider import NotificationSettingProvider
from sentry.models.user import User

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
