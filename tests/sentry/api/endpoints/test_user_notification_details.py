from __future__ import absolute_import

from sentry.testutils import APITestCase
from sentry.models import UserOption, UserOptionValue

from django.core.urlresolvers import reverse


class UserNotificationDetailsTest(APITestCase):
    def test_lookup_self(self):
        user = self.create_user(email="a@example.com")

        self.login_as(user=user)

        url = reverse("sentry-api-0-user-notifications", kwargs={"user_id": "me"})
        resp = self.client.get(url, format="json")

        assert resp.status_code == 200

    def test_lookup_other_user(self):
        user_a = self.create_user(email="a@example.com")
        user_b = self.create_user(email="b@example.com")

        self.login_as(user=user_b)

        url = reverse("sentry-api-0-user-notifications", kwargs={"user_id": user_a.id})

        resp = self.client.get(url, format="json")

        assert resp.status_code == 403

    def test_superuser(self):
        user = self.create_user(email="a@example.com")
        superuser = self.create_user(email="b@example.com", is_superuser=True)

        self.login_as(user=superuser, superuser=True)

        url = reverse("sentry-api-0-user-notifications", kwargs={"user_id": user.id})
        resp = self.client.get(url, format="json")

        assert resp.status_code == 200

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

        url = reverse("sentry-api-0-user-notifications", kwargs={"user_id": "me"})
        resp = self.client.get(url, format="json")

        assert resp.data.get("deployNotifications") == 3
        assert resp.data.get("personalActivityNotifications") is False
        assert resp.data.get("selfAssignOnResolve") is False
        assert resp.data.get("subscribeByDefault") is True
        assert resp.data.get("workflowNotifications") == int(UserOptionValue.participating_only)

    def test_saves_and_returns_values(self):
        user = self.create_user(email="a@example.com")
        self.login_as(user=user)

        url = reverse("sentry-api-0-user-notifications", kwargs={"user_id": "me"})

        resp = self.client.put(
            url,
            format="json",
            data={
                "deployNotifications": 2,
                "personalActivityNotifications": True,
                "selfAssignOnResolve": True,
            },
        )

        assert resp.status_code == 200

        assert resp.data.get("deployNotifications") == 2
        assert resp.data.get("personalActivityNotifications") is True
        assert resp.data.get("selfAssignOnResolve") is True
        assert resp.data.get("subscribeByDefault") is True
        assert resp.data.get("workflowNotifications") == int(UserOptionValue.participating_only)

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

        url = reverse("sentry-api-0-user-notifications", kwargs={"user_id": "me"})

        resp = self.client.put(url, format="json", data={"deployNotifications": 2})

        assert resp.status_code == 200
        assert resp.data.get("deployNotifications") == 2
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

        url = reverse("sentry-api-0-user-notifications", kwargs={"user_id": "me"})

        resp = self.client.put(url, format="json", data={"deployNotifications": 6})

        assert resp.status_code == 400
