from django.test import override_settings
from django.urls import reverse

from sentry.testutils.cases import APITestCase
from sentry.toolbar.views import has_valid_csp


class LoginSuccessViewTest(APITestCase):
    view_name = "sentry-toolbar-login-success"

    def setUp(self):
        super().setUp()
        self.login_as(user=self.user)
        self.url = reverse(self.view_name, args=(self.organization.slug, self.project.slug))

    @override_settings(CSP_REPORT_ONLY=False)
    def test_csp_enforce(self):
        res = self.client.get(self.url)
        assert has_valid_csp(res)

    @override_settings(CSP_REPORT_ONLY=True)
    def test_csp_report_only(self):
        res = self.client.get(self.url)
        assert has_valid_csp(res)
