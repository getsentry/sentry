from django.conf import settings
from django.test.utils import override_settings

from sentry.testutils import APITestCase
from sentry.utils.http import absolute_uri


def provision_middleware():
    return ["csp.middleware.CSPMiddleware"] + list(settings.MIDDLEWARE)


class JiraCSPTest(APITestCase):
    def setUp(self):
        super().setUp()
        self.issue_key = "APP-123"
        self.path = absolute_uri(f"extensions/jira/issue/{self.issue_key}/") + "?xdm_e=base_url"
        self.middleware = provision_middleware()

    def _split_csp_policy(self, policy):
        csp = {}
        for directive in policy.split("; "):
            parts = directive.split(" ")
            csp[parts[0]] = parts[1:]
        return csp

    def test_csp_frame_ancestors(self):
        with override_settings(MIDDLEWARE=tuple(self.middleware)):
            response = self.client.get(self.path)
            assert "Content-Security-Policy-Report-Only" in response

            csp = self._split_csp_policy(response["Content-Security-Policy-Report-Only"])
            assert "base_url" in csp["frame-ancestors"]
            assert "http://testserver" in csp["frame-ancestors"]

    @override_settings(STATIC_FRONTEND_APP_URL="https://sentry.io/_static/dist/")
    def test_csp_remote_style(self):
        with override_settings(MIDDLEWARE=tuple(self.middleware)):
            response = self.client.get(self.path)
            assert "Content-Security-Policy-Report-Only" in response

            csp = self._split_csp_policy(response["Content-Security-Policy-Report-Only"])
            assert "https://sentry.io" in csp["style-src"]

    @override_settings(CSP_REPORT_ONLY=False)
    def test_csp_enforce(self):
        with override_settings(MIDDLEWARE=tuple(self.middleware)):
            response = self.client.get(self.path)
            assert "Content-Security-Policy" in response
