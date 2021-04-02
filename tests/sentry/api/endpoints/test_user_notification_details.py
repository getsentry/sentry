from sentry.models import NotificationSetting
from sentry.models.integration import ExternalProviders
from sentry.notifications.types import (
    NotificationSettingTypes,
    NotificationSettingOptionValues,
)
from sentry.testutils import APITestCase


class UserNotificationDetailsTestBase(APITestCase):
    endpoint = "sentry-api-0-user-notifications"

    def setUp(self):
        self.login_as(self.user)


class UserNotificationDetailsGetTest(UserNotificationDetailsTestBase):
    def test_lookup_self(self):
        self.get_valid_response("me")

    def test_lookup_other_user(self):
        user_b = self.create_user(email="b@example.com")
        self.get_valid_response(user_b.id, status_code=403)

    def test_superuser(self):
        superuser = self.create_user(email="b@example.com", is_superuser=True)

        self.login_as(user=superuser, superuser=True)

        self.get_valid_response(self.user.id)

    def test_returns_correct_defaults(self):
        """
        In this test we add existing per-project and per-organization
        Notification settings in order to test that defaults are correct.
        """
        # default is 3
        NotificationSetting.objects.update_settings(
            ExternalProviders.EMAIL,
            NotificationSettingTypes.DEPLOY,
            NotificationSettingOptionValues.NEVER,
            user=self.user,
            organization=self.organization,
        )

        # default is NotificationSettingOptionValues.COMMITTED_ONLY
        NotificationSetting.objects.update_settings(
            ExternalProviders.EMAIL,
            NotificationSettingTypes.WORKFLOW,
            NotificationSettingOptionValues.ALWAYS,
            user=self.user,
            organization=self.organization,
        )

        response = self.get_valid_response("me")

        assert response.data.get("deployNotifications") == 3
        assert response.data.get("personalActivityNotifications") is False
        assert response.data.get("selfAssignOnResolve") is False
        assert response.data.get("subscribeByDefault") is True
        assert response.data.get("workflowNotifications") == 1


class UserNotificationDetailsPutTest(UserNotificationDetailsTestBase):
    method = "put"

    def test_saves_and_returns_values(self):
        data = {
            "deployNotifications": 2,
            "personalActivityNotifications": True,
            "selfAssignOnResolve": True,
        }
        response = self.get_valid_response("me", **data)

        assert response.data.get("deployNotifications") == 2
        assert response.data.get("personalActivityNotifications") is True
        assert response.data.get("selfAssignOnResolve") is True
        assert response.data.get("subscribeByDefault") is True
        assert response.data.get("workflowNotifications") == 1

        value = NotificationSetting.objects.get_settings(
            ExternalProviders.EMAIL,
            NotificationSettingTypes.DEPLOY,
            user=self.user,
        )
        assert value == NotificationSettingOptionValues.ALWAYS

    def test_saves_and_returns_values_when_defaults_present(self):
        NotificationSetting.objects.update_settings(
            ExternalProviders.EMAIL,
            NotificationSettingTypes.DEPLOY,
            NotificationSettingOptionValues.NEVER,
            user=self.user,
            organization=self.organization,
        )

        response = self.get_valid_response("me", **{"deployNotifications": 2})
        assert response.data.get("deployNotifications") == 2

        value1 = NotificationSetting.objects.get_settings(
            ExternalProviders.EMAIL,
            NotificationSettingTypes.DEPLOY,
            user=self.user,
            organization=self.organization,
        )
        value2 = NotificationSetting.objects.get_settings(
            ExternalProviders.EMAIL,
            NotificationSettingTypes.DEPLOY,
            user=self.user,
        )

        assert value1 == NotificationSettingOptionValues.NEVER
        assert value2 == NotificationSettingOptionValues.ALWAYS

    def test_reject_invalid_values(self):
        self.get_valid_response("me", status_code=400, **{"deployNotifications": 6})
