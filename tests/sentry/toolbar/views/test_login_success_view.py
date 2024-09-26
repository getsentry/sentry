from django.test import override_settings
from django.urls import reverse

from sentry.testutils.cases import APITestCase
from sentry.toolbar.utils.testutils import has_valid_csp
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
    def test_csp(self):
        self.project.update_option("sentry:toolbar_allowed_origins", ["https://sentry.io"])
        res = self.client.get(self.url, HTTP_REFERER="https://sentry.io")
        assert has_valid_csp(res)
