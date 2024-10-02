from unittest.mock import Mock, patch

from django.test import override_settings
from django.urls import reverse

from sentry.testutils.cases import APITestCase
from sentry.toolbar.utils.testutils import csp_has_directive
from sentry.toolbar.views.login_success_view import SUCCESS_TEMPLATE


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
        self.assertTemplateUsed(res, SUCCESS_TEMPLATE)

    @override_settings(CSP_REPORT_ONLY=False, CSP_INCLUDE_NONCE_IN=["script-src"])
    def test_csp_script_src_nonce(self):
        self.login_as(self.user)
        mock_nonce = f"{'a' * 22}=="

        def mock_process_request(request):
            request._csp_nonce = mock_nonce
            request.csp_nonce = mock_nonce
            return None

        with patch(
            "csp.middleware.CSPMiddleware.process_request", Mock(side_effect=mock_process_request)
        ):
            res = self.client.get(self.url)

        # Header
        csp = res.headers.get("Content-Security-Policy", "")
        assert csp_has_directive(csp, "script-src", [f"'nonce-{mock_nonce}'"], [])

        # Content
        script_tag = f'<script nonce="{mock_nonce}">'
        assert script_tag in res.content.decode("utf-8")
