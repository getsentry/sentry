from rest_framework import status

from sentry.models import NotificationSetting
from sentry.notifications.types import NotificationSettingOptionValues, NotificationSettingTypes
from sentry.testutils import APITestCase
from sentry.testutils.silo import control_silo_test
from sentry.types.integrations import ExternalProviders


class UserNotificationSettingsTestBase(APITestCase):
    endpoint = "sentry-api-0-user-notification-settings"

    def setUp(self):
        super().setUp()
        self.login_as(self.user)


@control_silo_test
class UserNotificationSettingsGetTest(UserNotificationSettingsTestBase):
    def test_simple(self):
        NotificationSetting.objects.update_settings(
            ExternalProviders.EMAIL,
            NotificationSettingTypes.ISSUE_ALERTS,
            NotificationSettingOptionValues.NEVER,
            user=self.user,
        )
        NotificationSetting.objects.update_settings(
            ExternalProviders.EMAIL,
            NotificationSettingTypes.DEPLOY,
            NotificationSettingOptionValues.NEVER,
            user=self.user,
            organization=self.organization,
        )
        NotificationSetting.objects.update_settings(
            ExternalProviders.SLACK,
            NotificationSettingTypes.DEPLOY,
            NotificationSettingOptionValues.ALWAYS,
            user=self.user,
            organization=self.organization,
        )
        NotificationSetting.objects.update_settings(
            ExternalProviders.SLACK,
            NotificationSettingTypes.WORKFLOW,
            NotificationSettingOptionValues.SUBSCRIBE_ONLY,
            user=self.user,
        )

        response = self.get_success_response("me")

        # Spot check.
        assert response.data["alerts"]["user"][self.user.id]["email"] == "never"
        assert response.data["deploy"]["organization"][self.organization.id]["email"] == "never"
        assert response.data["deploy"]["organization"][self.organization.id]["slack"] == "always"
        assert response.data["workflow"]["user"][self.user.id]["slack"] == "subscribe_only"

    def test_notification_settings_empty(self):
        _ = self.organization  # HACK to force creation.

        response = self.get_success_response("me")

        # Spot check.
        assert response.data["alerts"]["user"][self.user.id]["email"] == "always"
        assert response.data["deploy"]["organization"][self.organization.id]["email"] == "default"
        assert response.data["deploy"]["organization"][self.organization.id]["slack"] == "default"
        assert response.data["workflow"]["user"][self.user.id]["slack"] == "subscribe_only"

    def test_type_querystring(self):
        response = self.get_success_response("me", qs_params={"type": "workflow"})

        assert "alerts" not in response.data
        assert "workflow" in response.data

    def test_invalid_querystring(self):
        self.get_error_response(
            "me", qs_params={"type": "invalid"}, status_code=status.HTTP_400_BAD_REQUEST
        )

    def test_invalid_user_id(self):
        self.get_error_response("invalid", status_code=status.HTTP_404_NOT_FOUND)

    def test_wrong_user_id(self):
        other_user = self.create_user("bizbaz@example.com")

        self.get_error_response(other_user.id, status_code=status.HTTP_403_FORBIDDEN)

    def test_invalid_notification_setting(self):
        other_organization = self.create_organization(name="Rowdy Tiger", owner=None)
        other_project = self.create_project(
            organization=other_organization, teams=[], name="Bengal"
        )

        NotificationSetting.objects.update_settings(
            ExternalProviders.SLACK,
            NotificationSettingTypes.WORKFLOW,
            NotificationSettingOptionValues.SUBSCRIBE_ONLY,
            user=self.user,
            project=other_project,
        )

        response = self.get_success_response("me")

        assert other_project.id not in response.data["workflow"]["project"]


class UserNotificationSettingsTestBase(APITestCase):
    endpoint = "sentry-api-0-user-notification-settings"

    def setUp(self):
        super().setUp()
        self.login_as(self.user)


@control_silo_test
class UserNotificationSettingsGetTestV2(UserNotificationSettingsTestBase):
    def get_v2_response(self, qs_params=None, **kwargs):
        qs_params = qs_params or {}
        qs_params["v2"] = "1"
        return self.get_success_response("me", qs_params=qs_params, **kwargs)

    def test_simple(self):
        NotificationSetting.objects.update_settings(
            ExternalProviders.EMAIL,
            NotificationSettingTypes.ISSUE_ALERTS,
            NotificationSettingOptionValues.NEVER,
            user=self.user,
        )
        NotificationSetting.objects.update_settings(
            ExternalProviders.EMAIL,
            NotificationSettingTypes.DEPLOY,
            NotificationSettingOptionValues.NEVER,
            user=self.user,
            organization=self.organization,
        )
        NotificationSetting.objects.update_settings(
            ExternalProviders.SLACK,
            NotificationSettingTypes.DEPLOY,
            NotificationSettingOptionValues.ALWAYS,
            user=self.user,
            organization=self.organization,
        )
        NotificationSetting.objects.update_settings(
            ExternalProviders.SLACK,
            NotificationSettingTypes.WORKFLOW,
            NotificationSettingOptionValues.SUBSCRIBE_ONLY,
            user=self.user,
        )

        response = self.get_v2_response()

        # Spot check.
        preferences = response.data["preferences"]
        assert preferences["alerts"]["user"][self.user.id]["email"] == "never"
        assert preferences["deploy"]["organization"][self.organization.id]["email"] == "never"
        assert preferences["deploy"]["organization"][self.organization.id]["slack"] == "always"
        assert preferences["workflow"]["user"][self.user.id]["slack"] == "subscribe_only"

        providers = response.data["providers"]
        assert providers == ["email"]

    def test_slack_enabled(self):
        self.integration = self.create_slack_integration(self.organization, user=self.user)
        response = self.get_v2_response()
        providers = response.data["providers"]
        assert sorted(providers) == ["email", "slack"]

    def test_notification_settings_empty(self):
        _ = self.organization  # HACK to force creation.

        response = self.get_v2_response()

        # Spot check.
        preferences = response.data["preferences"]
        assert preferences["alerts"]["user"][self.user.id]["email"] == "always"
        assert preferences["deploy"]["organization"][self.organization.id]["email"] == "default"
        assert preferences["deploy"]["organization"][self.organization.id]["slack"] == "default"
        assert preferences["workflow"]["user"][self.user.id]["slack"] == "subscribe_only"

    def test_type_querystring(self):
        response = self.get_v2_response(qs_params={"type": "workflow"})

        assert "alerts" not in response.data["preferences"]
        assert "workflow" in response.data["preferences"]

    def test_invalid_querystring(self):
        self.get_error_response(
            "me", qs_params={"type": "invalid"}, status_code=status.HTTP_400_BAD_REQUEST
        )

    def test_invalid_user_id(self):
        self.get_error_response("invalid", status_code=status.HTTP_404_NOT_FOUND)

    def test_wrong_user_id(self):
        other_user = self.create_user("bizbaz@example.com")

        self.get_error_response(other_user.id, status_code=status.HTTP_403_FORBIDDEN)

    def test_invalid_notification_setting(self):
        other_organization = self.create_organization(name="Rowdy Tiger", owner=None)
        other_project = self.create_project(
            organization=other_organization, teams=[], name="Bengal"
        )

        NotificationSetting.objects.update_settings(
            ExternalProviders.SLACK,
            NotificationSettingTypes.WORKFLOW,
            NotificationSettingOptionValues.SUBSCRIBE_ONLY,
            user=self.user,
            project=other_project,
        )

        response = self.get_v2_response()

        assert other_project.id not in response.data["preferences"]["workflow"]["project"]


@control_silo_test
class UserNotificationSettingsTest(UserNotificationSettingsTestBase):
    method = "put"

    def test_simple(self):
        _ = self.project  # HACK to force creation.

        assert (
            NotificationSetting.objects.get_settings(
                provider=ExternalProviders.SLACK,
                type=NotificationSettingTypes.DEPLOY,
                user=self.user,
            )
            == NotificationSettingOptionValues.DEFAULT
        )

        self.get_success_response(
            "me",
            deploy={"user": {"me": {"email": "always", "slack": "always"}}},
            status_code=status.HTTP_204_NO_CONTENT,
        )

        assert (
            NotificationSetting.objects.get_settings(
                provider=ExternalProviders.SLACK,
                type=NotificationSettingTypes.DEPLOY,
                user=self.user,
            )
            == NotificationSettingOptionValues.ALWAYS
        )

    def test_empty_payload(self):
        self.get_error_response("me", status_code=status.HTTP_400_BAD_REQUEST)

    def test_invalid_payload(self):
        self.get_error_response("me", invalid=1, status_code=status.HTTP_400_BAD_REQUEST)

    def test_malformed_payload(self):
        self.get_error_response("me", alerts=[1, 2], status_code=status.HTTP_400_BAD_REQUEST)

    def test_wrong_user_id(self):
        user2 = self.create_user()
        self.get_error_response(
            "me",
            deploy={"user": {user2.id: {"email": "always", "slack": "always"}}},
            status_code=status.HTTP_400_BAD_REQUEST,
        )
