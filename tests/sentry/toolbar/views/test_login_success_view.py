from django.test import override_settings
from django.urls import reverse

from sentry.testutils.cases import APITestCase
from sentry.toolbar.views import has_valid_csp
from sentry.toolbar.views.login_success_view import SUCCESS_TEMPLATE


class LoginSuccessViewTest(APITestCase):
    view_name = "sentry-toolbar-login-success"

    def setUp(self):
        super().setUp()
        self.login_as(user=self.user)
        self.url = reverse(self.view_name, args=(self.organization.slug, self.project.slug))

    def test_get(self):
        response = self.client.get(self.url)
        assert response.status_code == 200
        self.assertTemplateUsed(response, SUCCESS_TEMPLATE)

    @override_settings(CSP_REPORT_ONLY=False)
    def test_csp_enforce(self):
        res = self.client.get(self.url)
        assert has_valid_csp(res)

    @override_settings(CSP_REPORT_ONLY=True)
    def test_csp_report_only(self):
        res = self.client.get(self.url)
        assert has_valid_csp(res)

    @override_settings(CSP_REPORT_ONLY=False, CSP_SCRIPT_SRC=["'unsafe-inline'"])
    def test_csp_duplicate_unsafe_inline(self):
        # Duplicate values in CSP directives are ok. This test asserts we still have the same behavior if unsafe-inline is repeated.
        res = self.client.get(self.url)
        assert has_valid_csp(res)
