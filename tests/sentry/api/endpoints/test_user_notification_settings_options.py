from rest_framework import status

from sentry.models.notificationsettingoption import NotificationSettingOption
from sentry.notifications.types import (
    NotificationScopeEnum,
    NotificationSettingEnum,
    NotificationSettingsOptionEnum,
)
from sentry.testutils.cases import APITestCase
from sentry.testutils.silo import control_silo_test


class UserNotificationSettingsOptionsBaseTest(APITestCase):
    endpoint = "sentry-api-0-user-notification-options"


@control_silo_test
class UserNotificationSettingsOptionsGetTest(UserNotificationSettingsOptionsBaseTest):
    def setUp(self):
        super().setUp()
        self.login_as(self.user)

    def test_simple(self):
        other_user = self.create_user()
        NotificationSettingOption.objects.create(
            user_id=self.user.id,
            scope_type=NotificationScopeEnum.ORGANIZATION.value,
            scope_identifier=self.organization.id,
            type=NotificationSettingEnum.ISSUE_ALERTS.value,
            value=NotificationSettingsOptionEnum.ALWAYS.value,
        )
        NotificationSettingOption.objects.create(
            user_id=self.user.id,
            scope_type=NotificationScopeEnum.ORGANIZATION.value,
            scope_identifier=self.organization.id,
            type=NotificationSettingEnum.WORKFLOW.value,
            value=NotificationSettingsOptionEnum.ALWAYS.value,
        )
        NotificationSettingOption.objects.create(
            user_id=other_user.id,
            scope_type=NotificationScopeEnum.ORGANIZATION.value,
            scope_identifier=self.organization.id,
            type=NotificationSettingEnum.ISSUE_ALERTS.value,
            value=NotificationSettingsOptionEnum.ALWAYS.value,
        )

        response = self.get_success_response("me", type="alerts").data
        assert len(response) == 1
        assert response[0]["scopeType"] == "organization"
        assert response[0]["scopeIdentifier"] == str(self.organization.id)
        assert response[0]["user_id"] == str(self.user.id)
        assert response[0]["team_id"] is None
        assert response[0]["value"] == "always"
        assert response[0]["type"] == "alerts"

        response = self.get_success_response("me").data
        assert len(response) == 2

    def test_invalid_type(self):
        response = self.get_error_response(
            "me",
            type="invalid",
            status_code=status.HTTP_400_BAD_REQUEST,
        )
        assert response.data["type"] == ["Invalid type"]


@control_silo_test
class UserNotificationSettingsOptionsPutTest(UserNotificationSettingsOptionsBaseTest):
    method = "PUT"

    def setUp(self):
        super().setUp()
        self.login_as(self.user)

    def test_simple(self):
        response = self.get_success_response(
            "me",
            user_id=self.user.id,
            scope_type="organization",
            scope_identifier=self.organization.id,
            type="alerts",
            status_code=status.HTTP_201_CREATED,
            value="always",
        )
        row = NotificationSettingOption.objects.filter(
            user_id=self.user.id,
            scope_type=NotificationScopeEnum.ORGANIZATION.value,
            scope_identifier=self.organization.id,
            type=NotificationSettingEnum.ISSUE_ALERTS.value,
            value=NotificationSettingsOptionEnum.ALWAYS.value,
        ).first()
        assert response.data["id"] == str(row.id)

    def test_invalid_scope_type(self):
        response = self.get_error_response(
            "me",
            user_id=self.user.id,
            scope_type="invalid",
            scope_identifier=self.organization.id,
            type="alerts",
            status_code=status.HTTP_400_BAD_REQUEST,
            value="always",
        )
        assert response.data["scopeType"] == ["Invalid scope type"]

    def test_invalid_value(self):
        response = self.get_error_response(
            "me",
            user_id=self.user.id,
            scope_type="organization",
            scope_identifier=self.organization.id,
            type="alerts",
            status_code=status.HTTP_400_BAD_REQUEST,
            value="hello",
        )
        assert response.data["value"] == ["Invalid value"]

    def test_invalid_value_for_option(self):
        response = self.get_error_response(
            "me",
            user_id=self.user.id,
            scope_type="organization",
            scope_identifier=self.organization.id,
            type="alerts",
            status_code=status.HTTP_400_BAD_REQUEST,
            value=NotificationSettingsOptionEnum.SUBSCRIBE_ONLY.value,
        )
        assert response.data["nonFieldErrors"] == ["Invalid type for value"]

    def test_reports(self):
        response = self.get_success_response(
            "me",
            user_id=self.user.id,
            scope_type="organization",
            scope_identifier=self.organization.id,
            type="reports",
            status_code=status.HTTP_201_CREATED,
            value="always",
        )
        row = NotificationSettingOption.objects.filter(
            user_id=self.user.id,
            scope_type=NotificationScopeEnum.ORGANIZATION.value,
            scope_identifier=self.organization.id,
            type=NotificationSettingEnum.REPORTS.value,
            value=NotificationSettingsOptionEnum.ALWAYS.value,
        ).first()
        assert response.data["id"] == str(row.id)
