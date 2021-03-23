import pytest

from django.core.urlresolvers import reverse
from django.test import override_settings

from sentry.demo.settings import MIDDLEWARE_CLASSES
from sentry.testutils import APITestCase
from sentry.utils import auth
from sentry.utils.compat import mock


orig_login = auth.login


@override_settings(MIDDLEWARE_CLASSES=MIDDLEWARE_CLASSES, DEMO_MODE=True)
class DemoMiddlewareTest(APITestCase):
    def setUp(self):
        super().setUp()
        self.organization2 = self.create_organization()
        self.user2 = self.create_user()
        self.om2 = self.create_member(
            organization=self.organization2, user=self.user2, role="member"
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
        mock_auth_login.assert_called_once_with(mock.ANY, self.user2)

    @mock.patch("sentry.demo.middleware.auth.login", side_effect=orig_login)
    def test_keep_logged_in(self, mock_auth_login):
        self.login_as(self.user2)
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
