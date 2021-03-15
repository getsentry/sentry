import pytest

from django.core.urlresolvers import reverse
from django.test import override_settings

from sentry.demo.settings import MIDDLEWARE_CLASSES
from sentry.testutils import APITestCase
from sentry.utils.compat import mock

from sentry.utils import auth

orig_login = auth.login


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

    @override_settings(MIDDLEWARE_CLASSES=MIDDLEWARE_CLASSES, DEMO_MODE=False)
    def test_demo_mode_disabled(self):
        with pytest.raises(Exception) as e:
            self.client.get(self.url)
        assert "Demo mode misconfigured" in str(e)

    @override_settings(MIDDLEWARE_CLASSES=MIDDLEWARE_CLASSES)
    @mock.patch("sentry.demo.middleware.auth.login", side_effect=orig_login)
    def test_switch_to_logged_in(self, mock_auth_login):
        response = self.client.get(self.url)
        assert response.status_code == 200, response.content
        mock_auth_login.assert_called_once_with(mock.ANY, self.user2)

    @override_settings(MIDDLEWARE_CLASSES=MIDDLEWARE_CLASSES)
    @mock.patch("sentry.demo.middleware.auth.login", side_effect=orig_login)
    def test_keep_logged_in(self, mock_auth_login):
        self.login_as(self.user2)
        response = self.client.get(self.url)
        assert response.status_code == 200, response.content
        assert mock_auth_login.call_count == 0

    @override_settings(MIDDLEWARE_CLASSES=MIDDLEWARE_CLASSES)
    def test_non_org_route(self):
        url = reverse("sentry-account-settings")
        response = self.client.get(url)
        assert response.status_code == 302, response.content
