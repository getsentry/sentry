from sentry.utils.compat import mock

from django.test.utils import override_settings
from exam import fixture

from sentry.testutils import TestCase


class AuthLoginTest(TestCase):
    @fixture
    def path(self):
        return "/demo/start/"

    @override_settings(DEMO_MODE=True, ROOT_URLCONF="sentry.demo.urls")
    @mock.patch("sentry.web.frontend.demo_start.auth.login")
    @mock.patch("sentry.demo.demo_org_manager.assign_demo_org")
    def test_basic(self, mock_assign_demo_org, mock_auth_login):

        user = self.create_user()
        org = self.create_organization()

        mock_assign_demo_org.return_value = (org, user)
        resp = self.client.post(self.path)
        assert resp.status_code == 302

        mock_auth_login.assert_called_once_with(mock.ANY, user)

    @override_settings(DEMO_MODE=False, ROOT_URLCONF="sentry.demo.urls")
    def test_disabled(self):
        resp = self.client.post(self.path)
        assert resp.status_code == 404
