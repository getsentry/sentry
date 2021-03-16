from sentry.models import UserOption, UserOptionValue
from sentry.testutils import APITestCase


class UserNotificationDetailsTest(APITestCase):
    endpoint = "sentry-api-0-user-notifications"

    def test_lookup_self(self):
        user = self.create_user(email="a@example.com")

        self.login_as(user=user)

        self.get_valid_response("me")

    def test_lookup_other_user(self):
        user_a = self.create_user(email="a@example.com")
        user_b = self.create_user(email="b@example.com")

        self.login_as(user=user_b)

        self.get_valid_response(user_a.id, status_code=403)

    def test_superuser(self):
        user = self.create_user(email="a@example.com")
        superuser = self.create_user(email="b@example.com", is_superuser=True)

        self.login_as(user=superuser, superuser=True)

        self.get_valid_response(user.id)

    def test_returns_correct_defaults(self):
        user = self.create_user(email="a@example.com")
        org = self.create_organization(name="Org Name", owner=user)

        # Adding existing UserOptions for a project or org to test that defaults are correct
        # default is 3
        UserOption.objects.create(
            user=user, project=None, organization=org, key="deploy-emails", value=1
        )

        # default is UserOptionValue.participating_only
        UserOption.objects.create(
            user=user,
            project=None,
            organization=org,
            key="workflow:notifications",
            value=UserOptionValue.all_conversations,
        )

        self.login_as(user=user)

        response = self.get_valid_response("me")

        assert response.data.get("deployNotifications") == 3
        assert response.data.get("personalActivityNotifications") is False
        assert response.data.get("selfAssignOnResolve") is False
        assert response.data.get("subscribeByDefault") is True
        assert response.data.get("workflowNotifications") == int(UserOptionValue.participating_only)

    def test_saves_and_returns_values(self):
        user = self.create_user(email="a@example.com")
        self.login_as(user=user)

        response = self.get_valid_response(
            "me",
            method="put",
            **{
                "deployNotifications": 2,
                "personalActivityNotifications": True,
                "selfAssignOnResolve": True,
            },
        )

        assert response.data.get("deployNotifications") == 2
        assert response.data.get("personalActivityNotifications") is True
        assert response.data.get("selfAssignOnResolve") is True
        assert response.data.get("subscribeByDefault") is True
        assert response.data.get("workflowNotifications") == int(UserOptionValue.participating_only)

        assert (
            UserOption.objects.get(
                user=user, project=None, organization=None, key="deploy-emails"
            ).value
            == "2"
        )

    def test_saves_and_returns_values_when_defaults_present(self):
        user = self.create_user(email="a@example.com")
        org = self.create_organization(name="Org Name", owner=user)
        self.login_as(user=user)
        UserOption.objects.create(
            user=user, project=None, organization=org, key="deploy-emails", value=1
        )

        response = self.get_valid_response("me", method="put", **{"deployNotifications": 2})

        assert response.data.get("deployNotifications") == 2
        assert (
            UserOption.objects.get(
                user=user, project=None, organization=org, key="deploy-emails"
            ).value
            == 1
        )
        assert (
            UserOption.objects.get(
                user=user, project=None, organization=None, key="deploy-emails"
            ).value
            == "2"
        )

    def test_reject_invalid_values(self):
        user = self.create_user(email="a@example.com")
        self.login_as(user=user)

        self.get_valid_response("me", method="put", status_code=400, **{"deployNotifications": 6})
