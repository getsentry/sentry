from django.http import HttpResponse
from django.test import override_settings
from django.urls import reverse

from sentry.testutils.cases import APITestCase
from sentry.toolbar.views.iframe_view import TEMPLATE


class IframeViewTest(APITestCase):
    view_name = "sentry-toolbar-iframe"

    def setUp(self) -> None:
        super().setUp()
        self.url = reverse(self.view_name, args=(self.organization.slug, self.project.slug))

    @override_settings(CSP_REPORT_ONLY=False)
    def test_logged_out_without_auth(self) -> None:
        referrer = "https://example.com"
        res = self.client.get(self.url, HTTP_REFERER=referrer)

        assert res.status_code == 200
        assert res.headers.get("X-Frame-Options") == "ALLOWALL"
        assert f"frame-ancestors {referrer}" in _get_csp_parts(res)
        assert _has_nonce(res)

        self.assertTemplateUsed(res, TEMPLATE)
        content = res.content.decode("utf-8")
        assert f"const referrer = '{referrer}';" in content
        assert "postStateMessage('logged-out');" in content
        assert "port-connect" not in content

    @override_settings(CSP_REPORT_ONLY=False)
    def test_logged_in_user_is_still_logged_out(self) -> None:
        self.login_as(user=self.user)
        res = self.client.get(self.url, HTTP_REFERER="https://example.com")

        assert res.status_code == 200
        assert "postStateMessage('logged-out');" in res.content.decode("utf-8")

    @override_settings(CSP_REPORT_ONLY=False)
    def test_unknown_org_and_project(self) -> None:
        url = reverse(self.view_name, args=("does-not-exist", "abc123xyz"))
        res = self.client.get(url, HTTP_REFERER="https://example.com")

        assert res.status_code == 200
        self.assertTemplateUsed(res, TEMPLATE)

    @override_settings(CSP_REPORT_ONLY=False)
    def test_no_referrer(self) -> None:
        res = self.client.get(self.url)

        assert res.status_code == 200
        assert res.headers.get("X-Frame-Options") == "DENY"
        assert "frame-ancestors 'none'" in _get_csp_parts(res)
        assert "const referrer = '';" in res.content.decode("utf-8")


def _get_csp_parts(response: HttpResponse) -> list[str]:
    # Fallback to `c` for tests in dev.
    csp = response.headers.get("Content-Security-Policy", response.headers.get("c"))
    assert csp is not None
    return [chunk.strip() for chunk in csp.split(";")]


def _has_nonce(response: HttpResponse) -> bool:
    content = response.content.decode("utf-8")
    # Middleware automatically injects the `nonce` attribute onto our <script>
    # tag; so if that attribute is there then we can assume the nonce header and
    # value are set correctly.
    return "<script nonce=" in content
