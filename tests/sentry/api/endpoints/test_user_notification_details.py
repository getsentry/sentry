from sentry.models.notificationsetting import NotificationSetting
from sentry.models.notificationsettingoption import NotificationSettingOption
from sentry.models.notificationsettingprovider import NotificationSettingProvider
from sentry.notifications.types import NotificationSettingOptionValues, NotificationSettingTypes
from sentry.testutils.cases import APITestCase
from sentry.testutils.silo import control_silo_test
from sentry.types.integrations import ExternalProviders


class UserNotificationDetailsTestBase(APITestCase):
    endpoint = "sentry-api-0-user-notifications"

    def setUp(self):
        self.login_as(self.user)


@control_silo_test(stable=True)
class UserNotificationDetailsGetTest(UserNotificationDetailsTestBase):
    def test_lookup_self(self):
        self.get_success_response("me")

    def test_lookup_other_user(self):
        user_b = self.create_user(email="b@example.com")
        self.get_error_response(user_b.id, status_code=403)

    def test_superuser(self):
        superuser = self.create_user(email="b@example.com", is_superuser=True)

        self.login_as(user=superuser, superuser=True)

        self.get_success_response(self.user.id)

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
            user_id=self.user.id,
            organization=self.organization,
        )

        # default is NotificationSettingOptionValues.COMMITTED_ONLY
        NotificationSetting.objects.update_settings(
            ExternalProviders.EMAIL,
            NotificationSettingTypes.WORKFLOW,
            NotificationSettingOptionValues.ALWAYS,
            user_id=self.user.id,
            organization=self.organization,
        )

        response = self.get_success_response("me")

        assert response.data.get("deployNotifications") == 3
        assert response.data.get("personalActivityNotifications") is False
        assert response.data.get("selfAssignOnResolve") is False
        assert response.data.get("subscribeByDefault") is True
        assert response.data.get("workflowNotifications") == 1

    def test_subscribe_by_default(self):
        """
        Test that we expect project-independent issue alert preferences to be
        returned as `subscribe_by_default`.
        """
        NotificationSetting.objects.update_settings(
            ExternalProviders.EMAIL,
            NotificationSettingTypes.ISSUE_ALERTS,
            NotificationSettingOptionValues.NEVER,
            user_id=self.user.id,
        )

        response = self.get_success_response("me")
        assert response.data.get("subscribeByDefault") is False


@control_silo_test(stable=True)
class UserNotificationDetailsPutTest(UserNotificationDetailsTestBase):
    method = "put"

    def test_saves_and_returns_values(self):
        org = self.create_organization()
        self.create_member(user=self.user, organization=org)
        data = {
            "deployNotifications": 2,
            "personalActivityNotifications": True,
            "selfAssignOnResolve": True,
        }
        self.get_success_response("me", **data)

        value = NotificationSetting.objects.get_settings(
            ExternalProviders.EMAIL,
            NotificationSettingTypes.DEPLOY,
            user_id=self.user.id,
        )
        assert value == NotificationSettingOptionValues.ALWAYS

        query_args = {
            "user_id": self.user.id,
            "team_id": None,
            "value": "always",
            "scope_type": "user",
            "scope_identifier": self.user.id,
        }
        assert NotificationSettingOption.objects.filter(**query_args).exists()
        assert NotificationSettingProvider.objects.filter(**query_args, provider="email")

    def test_saves_and_returns_values_when_defaults_present(self):
        NotificationSetting.objects.update_settings(
            ExternalProviders.EMAIL,
            NotificationSettingTypes.DEPLOY,
            NotificationSettingOptionValues.NEVER,
            user_id=self.user.id,
            organization=self.organization,
        )

        response = self.get_success_response("me", **{"deployNotifications": 2})
        assert response.data.get("deployNotifications") == 2

        value1 = NotificationSetting.objects.get_settings(
            ExternalProviders.EMAIL,
            NotificationSettingTypes.DEPLOY,
            user_id=self.user.id,
            organization=self.organization,
        )
        value2 = NotificationSetting.objects.get_settings(
            ExternalProviders.EMAIL,
            NotificationSettingTypes.DEPLOY,
            user_id=self.user.id,
        )

        assert value1 == NotificationSettingOptionValues.NEVER
        assert value2 == NotificationSettingOptionValues.ALWAYS

    def test_reject_invalid_values(self):
        self.get_error_response("me", status_code=400, **{"deployNotifications": 6})
