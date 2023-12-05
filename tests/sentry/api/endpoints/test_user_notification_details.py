from sentry.testutils.cases import APITestCase
from sentry.testutils.silo import control_silo_test


class UserNotificationDetailsTestBase(APITestCase):
    endpoint = "sentry-api-0-user-notifications"

    def setUp(self):
        self.login_as(self.user)


@control_silo_test
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

        response = self.get_success_response("me")

        assert response.data.get("personalActivityNotifications") is False
        assert response.data.get("selfAssignOnResolve") is False


@control_silo_test
class UserNotificationDetailsPutTest(UserNotificationDetailsTestBase):
    method = "put"

    def test_saves_and_returns_values(self):
        org = self.create_organization()
        self.create_member(user=self.user, organization=org)
        data = {
            "personalActivityNotifications": True,
            "selfAssignOnResolve": True,
        }
        self.get_success_response("me", **data)

    def test_reject_invalid_values(self):
        self.get_error_response("me", status_code=400, **{"personalActivityNotifications": 6})
