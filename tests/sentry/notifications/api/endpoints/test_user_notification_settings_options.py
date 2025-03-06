from rest_framework import status

from sentry.notifications.models.notificationsettingoption import NotificationSettingOption
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
        row = NotificationSettingOption.objects.get(
            user_id=self.user.id,
            scope_type=NotificationScopeEnum.ORGANIZATION.value,
            scope_identifier=self.organization.id,
            type=NotificationSettingEnum.ISSUE_ALERTS.value,
            value=NotificationSettingsOptionEnum.ALWAYS.value,
        )
        assert response.data["id"] == str(row.id)

    def test_user_scope(self):

        notification_settings = [
            NotificationSettingEnum.QUOTA,
            NotificationSettingEnum.QUOTA_WARNINGS,
            NotificationSettingEnum.QUOTA_THRESHOLDS,
            NotificationSettingEnum.QUOTA_ERRORS,
            NotificationSettingEnum.QUOTA_TRANSACTIONS,
            NotificationSettingEnum.QUOTA_ATTACHMENTS,
            NotificationSettingEnum.QUOTA_REPLAYS,
            NotificationSettingEnum.QUOTA_MONITOR_SEATS,
            NotificationSettingEnum.QUOTA_SPANS,
        ]

        # turn on notification settings
        for setting in notification_settings:
            response = self.get_success_response(
                "me",
                user_id=self.user.id,
                scope_type="user",
                scope_identifier=self.user.id,
                type=setting.value,
                status_code=status.HTTP_201_CREATED,
                value="always",
            )
            record = NotificationSettingOption.objects.filter(
                user_id=self.user.id,
                scope_type=NotificationScopeEnum.USER.value,
                scope_identifier=self.user.id,
                type=setting.value,
                value=NotificationSettingsOptionEnum.ALWAYS.value,
            ).get()
            assert response.data == {
                "id": str(record.id),
                "scopeType": "user",
                "scopeIdentifier": str(self.user.id),
                "type": setting.value,
                "value": "always",
                "user_id": str(self.user.id),
                "team_id": None,
            }

        # turn off notification settings
        for setting in notification_settings:
            response = self.get_success_response(
                "me",
                user_id=self.user.id,
                scope_type="user",
                scope_identifier=self.user.id,
                type=setting.value,
                status_code=status.HTTP_201_CREATED,
                value="never",
            )
            record = NotificationSettingOption.objects.filter(
                user_id=self.user.id,
                scope_type=NotificationScopeEnum.USER.value,
                scope_identifier=self.user.id,
                type=setting.value,
                value=NotificationSettingsOptionEnum.NEVER.value,
            ).get()
            assert response.data == {
                "id": str(record.id),
                "scopeType": "user",
                "scopeIdentifier": str(self.user.id),
                "type": setting.value,
                "value": "never",
                "user_id": str(self.user.id),
                "team_id": None,
            }

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
        row = NotificationSettingOption.objects.get(
            user_id=self.user.id,
            scope_type=NotificationScopeEnum.ORGANIZATION.value,
            scope_identifier=self.organization.id,
            type=NotificationSettingEnum.REPORTS.value,
            value=NotificationSettingsOptionEnum.ALWAYS.value,
        )
        assert response.data["id"] == str(row.id)
