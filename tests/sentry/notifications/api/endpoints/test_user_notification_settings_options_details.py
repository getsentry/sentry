from rest_framework import status

from sentry.notifications.models.notificationsettingoption import NotificationSettingOption
from sentry.notifications.types import (
    NotificationScopeEnum,
    NotificationSettingEnum,
    NotificationSettingsOptionEnum,
)
from sentry.testutils.cases import APITestCase
from sentry.testutils.silo import control_silo_test


class UserNotificationSettingsOptionsDetailsBaseTest(APITestCase):
    endpoint = "sentry-api-0-user-notification-options-details"


@control_silo_test
class UserNotificationSettingsOptionsDetailsDeleteTest(
    UserNotificationSettingsOptionsDetailsBaseTest
):
    method = "DELETE"

    def setUp(self):
        super().setUp()
        self.login_as(self.user)

        self.option = NotificationSettingOption.objects.create(
            user_id=self.user.id,
            scope_type=NotificationScopeEnum.ORGANIZATION.value,
            scope_identifier=self.organization.id,
            type=NotificationSettingEnum.ISSUE_ALERTS.value,
            value=NotificationSettingsOptionEnum.ALWAYS.value,
        )

    def test_simple(self):
        self.get_success_response(
            "me",
            self.option.id,
        )
        assert not NotificationSettingOption.objects.filter(id=self.option.id).exists()

    def test_invalid_option(self):
        self.get_error_response(
            "me",
            "123",
            status_code=status.HTTP_404_NOT_FOUND,
        )

    def test_cannot_delete_other_users_setting(self):
        victim_user = self.create_user()
        victim_org = self.create_organization(owner=victim_user)
        victim_option = NotificationSettingOption.objects.create(
            user_id=victim_user.id,
            scope_type=NotificationScopeEnum.ORGANIZATION.value,
            scope_identifier=victim_org.id,
            type=NotificationSettingEnum.ISSUE_ALERTS.value,
            value=NotificationSettingsOptionEnum.ALWAYS.value,
        )

        response = self.get_error_response(
            "me",
            victim_option.id,
            status_code=status.HTTP_404_NOT_FOUND,
        )
        assert response.data["detail"] == "User notification setting does not exist"
        assert NotificationSettingOption.objects.filter(id=victim_option.id).exists()
