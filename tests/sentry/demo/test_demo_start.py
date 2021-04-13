from django.core import signing
from django.test.utils import override_settings
from exam import fixture

from sentry.demo.demo_start import MEMBER_ID_COOKIE
from sentry.models import OrganizationStatus
from sentry.testutils import TestCase
from sentry.utils.compat import mock

signer = signing.get_cookie_signer(salt=MEMBER_ID_COOKIE)


@override_settings(DEMO_MODE=True, ROOT_URLCONF="sentry.demo.urls")
class DemoStartTeset(TestCase):
    @fixture
    def path(self):
        return "/demo/start/"

    def setUp(self):
        super().setUp()
        self.user = self.create_user()
        self.org = self.create_organization()
        self.member = self.create_member(organization=self.org, role="member", user=self.user)

    @mock.patch("sentry.demo.demo_start.auth.login")
    @mock.patch("sentry.demo.demo_org_manager.assign_demo_org")
    def test_basic(self, mock_assign_demo_org, mock_auth_login):
        mock_assign_demo_org.return_value = (self.org, self.user)
        resp = self.client.post(self.path)
        assert resp.status_code == 302
        mock_auth_login.assert_called_once_with(mock.ANY, self.user)
        recovered = resp.cookies[MEMBER_ID_COOKIE].value.split(":")[0]
        assert recovered == str(self.member.id)
        mock_assign_demo_org.assert_called_once_with(skip_buffer=False)

    @override_settings(DEMO_MODE=False, ROOT_URLCONF="sentry.demo.urls")
    def test_disabled(self):
        resp = self.client.post(self.path)
        assert resp.status_code == 404

    @mock.patch("sentry.demo.demo_start.auth.login")
    def test_member_cookie(self, mock_auth_login):
        self.save_cookie(MEMBER_ID_COOKIE, signer.sign(self.member.id))
        resp = self.client.post(self.path)
        assert resp.status_code == 302
        mock_auth_login.assert_called_once_with(mock.ANY, self.user)

    @mock.patch("sentry.demo.demo_start.auth.login")
    @mock.patch("sentry.demo.demo_org_manager.assign_demo_org")
    def test_member_cookie_deactivated_org(self, mock_assign_demo_org, mock_auth_login):
        self.org.status = OrganizationStatus.PENDING_DELETION
        self.org.save()
        self.save_cookie(MEMBER_ID_COOKIE, signer.sign(self.member.id))

        new_user = self.create_user()
        new_org = self.create_organization()
        new_member = self.create_member(organization=new_org, role="member", user=new_user)
        mock_assign_demo_org.return_value = (new_org, new_user)

        resp = self.client.post(self.path)
        assert resp.status_code == 302
        mock_auth_login.assert_called_once_with(mock.ANY, new_user)
        recovered = resp.cookies[MEMBER_ID_COOKIE].value.split(":")[0]
        assert recovered == str(new_member.id)

    @mock.patch("sentry.demo.demo_start.auth.login")
    @mock.patch("sentry.demo.demo_org_manager.assign_demo_org")
    def test_redirects(self, mock_assign_demo_org, mock_auth_login):
        mock_assign_demo_org.return_value = (self.org, self.user)

        for scenario in ["performance", "releases", "alerts", "discover", "dashboards"]:
            resp = self.client.post(self.path, data={"scenario": scenario})
            partial_url = f"/organizations/{self.org.slug}/{scenario}/"
            assert resp.status_code == 302
            assert partial_url in resp.url

    @mock.patch("sentry.demo.demo_start.auth.login")
    @mock.patch("sentry.demo.demo_org_manager.assign_demo_org")
    def test_skip_buffer(self, mock_assign_demo_org, mock_auth_login):
        mock_assign_demo_org.return_value = (self.org, self.user)
        self.client.post(self.path, data={"skip_buffer": "1"})
        mock_assign_demo_org.assert_called_once_with(skip_buffer=True)
