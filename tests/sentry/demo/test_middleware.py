import pytest
from django.test import override_settings
from django.urls import reverse

from sentry.demo.models import DemoUser
from sentry.demo.settings import MIDDLEWARE
from sentry.testutils import APITestCase
from sentry.utils import auth
from sentry.utils.compat import mock

orig_login = auth.login


@override_settings(MIDDLEWARE=MIDDLEWARE, DEMO_MODE=True)
class DemoMiddlewareTest(APITestCase):
    def setUp(self):
        super().setUp()
        self.organization2 = self.create_organization()
        # non demo user
        self.user2 = self.create_user()
        self.om2 = self.create_member(
            organization=self.organization2, user=self.user2, role="member"
        )
        # demo user
        self.demo_user = DemoUser.create_user()
        self.demo_om = self.create_member(
            organization=self.organization2, user=self.demo_user, role="member"
        )
        self.url = reverse(
            "sentry-organization-issue-list",
            kwargs={"organization_slug": self.organization2.slug},
        )

    @override_settings(DEMO_MODE=False)
    def test_demo_mode_disabled(self):
        with pytest.raises(Exception) as e:
            self.client.get(self.url)
        assert "Demo mode misconfigured" in str(e)

    @mock.patch("sentry.demo.middleware.auth.login", side_effect=orig_login)
    def test_switch_to_logged_in(self, mock_auth_login):
        response = self.client.get(self.url)
        assert response.status_code == 200, response.content
        mock_auth_login.assert_called_once_with(mock.ANY, self.demo_user)

    @mock.patch("sentry.demo.middleware.auth.login", side_effect=orig_login)
    def test_keep_logged_in(self, mock_auth_login):
        self.login_as(self.demo_user)
        response = self.client.get(self.url)
        assert response.status_code == 200, response.content
        assert mock_auth_login.call_count == 0

    def test_non_org_route(self):
        url = reverse("sentry-account-settings")
        response = self.client.get(url)
        assert response.status_code == 302, response.content

    def test_prompt_route(self):
        url = reverse("sentry-api-0-prompts-activity")
        response = self.client.get(url)
        assert response.status_code == 200
        assert response.content == b'{"data": {"dismissed_ts": 1}}'

    def test_org_creation(self):
        url = reverse("sentry-api-0-organizations")
        response = self.client.post(url)
        assert response.status_code == 400
        assert response.content == b'{"detail": "Organization creation disabled in demo mode"}'

    def test_login_redirect(self):
        url = reverse("sentry-login")
        response = self.client.get(url)
        assert response.status_code == 302

    def test_org_login_redirect(self):
        url = reverse("sentry-auth-organization", args=[self.organization2.slug])
        response = self.client.get(url)
        assert response.status_code == 302

    def test_login_no_redirect(self):
        url = reverse("sentry-login") + "?allow_login=1"
        response = self.client.get(url)
        assert response.status_code == 200

    def test_org_login_no_redirect(self):
        url = reverse("sentry-auth-organization", args=[self.organization2.slug]) + "?allow_login=1"
        response = self.client.get(url)
        assert response.status_code == 200
