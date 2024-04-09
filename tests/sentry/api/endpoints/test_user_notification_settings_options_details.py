from rest_framework import status

from sentry.models.notificationsettingoption import NotificationSettingOption
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

        option = NotificationSettingOption.objects.create(
            user_id=self.user.id,
            scope_type=NotificationScopeEnum.ORGANIZATION.value,
            scope_identifier=self.organization.id,
            type=NotificationSettingEnum.ISSUE_ALERTS.value,
            value=NotificationSettingsOptionEnum.ALWAYS.value,
        )
        self.get_success_response(
            "me",
            option.id,
        )
        assert not NotificationSettingOption.objects.filter(id=option.id).exists()

    def test_invalid_option(self):
        self.get_error_response(
            "me",
            "123",
            status_code=status.HTTP_404_NOT_FOUND,
        )
