from sentry.models import NotificationSetting
from sentry.notifications.types import NotificationSettingOptionValues, NotificationSettingTypes
from sentry.testutils import APITestCase
from sentry.types.integrations import ExternalProviders

FEATURE_NAMES = [
    "organizations:notification-platform",
]


class UserNotificationSettingsTestBase(APITestCase):
    endpoint = "sentry-api-0-user-notification-settings"

    def setUp(self):
        self.login_as(self.user)
        self.org = self.organization  # Force creation.


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
            organization=self.org,
        )
        NotificationSetting.objects.update_settings(
            ExternalProviders.SLACK,
            NotificationSettingTypes.DEPLOY,
            NotificationSettingOptionValues.ALWAYS,
            user=self.user,
            organization=self.org,
        )
        NotificationSetting.objects.update_settings(
            ExternalProviders.SLACK,
            NotificationSettingTypes.WORKFLOW,
            NotificationSettingOptionValues.SUBSCRIBE_ONLY,
            user=self.user,
        )

        with self.feature(FEATURE_NAMES):
            response = self.get_success_response("me")

        # Spot check.
        assert response.data["alerts"]["user"][self.user.id]["email"] == "never"
        assert response.data["deploy"]["organization"][self.org.id]["email"] == "never"
        assert response.data["deploy"]["organization"][self.org.id]["slack"] == "always"
        assert response.data["workflow"]["user"][self.user.id]["slack"] == "subscribe_only"

    def test_notification_settings_empty(self):
        with self.feature(FEATURE_NAMES):
            response = self.get_success_response("me")

        # Spot check.
        assert response.data["alerts"]["user"][self.user.id]["email"] == "always"
        assert response.data["deploy"]["organization"][self.org.id]["email"] == "default"
        assert response.data["deploy"]["organization"][self.org.id]["slack"] == "default"
        assert response.data["workflow"]["user"][self.user.id]["slack"] == "never"

    def test_type_querystring(self):
        with self.feature(FEATURE_NAMES):
            response = self.get_success_response("me", qs_params={"type": "workflow"})

        assert "alerts" not in response.data
        assert "workflow" in response.data

    def test_invalid_querystring(self):
        with self.feature(FEATURE_NAMES):
            self.get_error_response("me", qs_params={"type": "invalid"}, status_code=400)

    def test_invalid_user_id(self):
        with self.feature(FEATURE_NAMES):
            self.get_error_response("invalid", status_code=404)

    def test_wrong_user_id(self):
        other_user = self.create_user("bizbaz@example.com")

        with self.feature(FEATURE_NAMES):
            self.get_error_response(other_user.id, status_code=403)

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

        with self.feature(FEATURE_NAMES):
            response = self.get_success_response("me")

        assert other_project.id not in response.data["workflow"]["project"]


class UserNotificationSettingsTest(UserNotificationSettingsTestBase):
    method = "put"

    def test_simple(self):
        assert (
            NotificationSetting.objects.get_settings(
                provider=ExternalProviders.SLACK,
                type=NotificationSettingTypes.DEPLOY,
                user=self.user,
            )
            == NotificationSettingOptionValues.DEFAULT
        )

        data = {"deploy": {"user": {"me": {"email": "always", "slack": "always"}}}}
        with self.feature(FEATURE_NAMES):
            self.get_success_response("me", **data)

        assert (
            NotificationSetting.objects.get_settings(
                provider=ExternalProviders.SLACK,
                type=NotificationSettingTypes.DEPLOY,
                user=self.user,
            )
            == NotificationSettingOptionValues.ALWAYS
        )

    def test_empty_payload(self):
        with self.feature(FEATURE_NAMES):
            self.get_error_response("me", **{}, status_code=400)

    def test_invalid_payload(self):
        with self.feature(FEATURE_NAMES):
            self.get_error_response("me", **{"invalid": 1}, status_code=400)

    def test_malformed_payload(self):
        with self.feature(FEATURE_NAMES):
            self.get_error_response("me", **{"alerts": [1, 2]}, status_code=400)

    def test_wrong_user_id(self):
        user2 = self.create_user()
        data = {"deploy": {"user": {user2.id: {"email": "always", "slack": "always"}}}}
        with self.feature(FEATURE_NAMES):
            self.get_error_response("me", **data, status_code=400)
