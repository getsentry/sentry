import re

from django.test import override_settings
from django.urls import reverse

from sentry.testutils.cases import APITestCase
from sentry.toolbar.views.login_success_view import TEMPLATE


class LoginSuccessViewTest(APITestCase):
    view_name = "sentry-toolbar-login-success"

    def setUp(self):
        super().setUp()
        self.url = reverse(self.view_name, args=(self.organization.slug, self.project.slug))
        # Note no login

    def test_get_requires_auth(self):
        """
        Unauthenticated requests should redirect to /auth/login.
        Similar to self.assertRequiresAuthentication, which is outdated.
        """
        res = self.client.get(self.url)
        assert res.status_code == 302
        assert reverse("sentry-login") in res["Location"]

    def test_get(self):
        self.login_as(self.user)
        res = self.client.get(self.url)
        assert res.status_code == 200
        self.assertTemplateUsed(res, TEMPLATE)

    @override_settings(CSP_REPORT_ONLY=False)
    def test_csp_script_src_nonce(self):
        self.login_as(self.user)
        res = self.client.get(self.url)
        assert _has_nonce(res)


def _get_nonce_from_csp(csp: str) -> str:
    return re.search("nonce-([^']+)", csp).group(1)


def _has_nonce(response):
    csp = response.headers.get("c")  # TODO: Why "c" and not "Content-Security-Policy"?
    nonce = _get_nonce_from_csp(csp)
    content = response.content.decode("utf-8")
    return f'<script nonce="{nonce}">' in content
