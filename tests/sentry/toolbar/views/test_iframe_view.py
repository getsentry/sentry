from django.test import override_settings
from django.urls import reverse
from django.utils.html import escapejs

from sentry.testutils.cases import APITestCase
from sentry.toolbar.views.iframe_view import TEMPLATE


class IframeViewTest(APITestCase):
    view_name = "sentry-toolbar-iframe"

    def setUp(self):
        super().setUp()
        self.login_as(user=self.user)
        self.url = reverse(self.view_name, args=(self.organization.slug, self.project.slug))

    @override_settings(CSP_REPORT_ONLY=False)
    def test_missing_project(self):
        referrer = "https://example.com"
        url = reverse(self.view_name, args=(self.organization.slug, "abc123xyz"))
        res = self.client.get(url, HTTP_REFERER=referrer)

        assert res.status_code == 200
        assert res.headers.get("X-Frame-Options") == "ALLOWALL"
        assert f"frame-ancestors {referrer}" in _get_csp_parts(res)
        assert _has_nonce(res)

        self.assertTemplateUsed(res, TEMPLATE)
        assert f"const referrer = '{referrer}';" in res.content.decode("utf-8")
        assert f"const state = '{escapejs('missing-project')}';" in res.content.decode("utf-8")

    @override_settings(CSP_REPORT_ONLY=False)
    def test_default_no_allowed_origins(self):
        referrer = "https://example.com"
        res = self.client.get(self.url, HTTP_REFERER=referrer)

        assert res.status_code == 200
        assert res.headers.get("X-Frame-Options") == "ALLOWALL"
        assert f"frame-ancestors {referrer}" in _get_csp_parts(res)
        assert _has_nonce(res)

        self.assertTemplateUsed(res, TEMPLATE)
        assert f"const referrer = '{referrer}';" in res.content.decode("utf-8")
        assert f"const state = '{escapejs('invalid-domain')}';" in res.content.decode("utf-8")

    @override_settings(CSP_REPORT_ONLY=False)
    def test_allowed_origins_basic(self):
        referrer = "https://sentry.io:127/replays"
        self.project.update_option("sentry:toolbar_allowed_origins", ["sentry.io"])

        res = self.client.get(self.url, HTTP_REFERER=referrer)
        assert res.status_code == 200
        assert res.headers.get("X-Frame-Options") == "ALLOWALL"
        assert f"frame-ancestors {referrer}" in _get_csp_parts(res)
        assert _has_nonce(res)

        self.assertTemplateUsed(res, TEMPLATE)
        assert f"const referrer = '{referrer}';" in res.content.decode("utf-8")
        assert f"const state = '{escapejs('logged-in')}';" in res.content.decode("utf-8")

    @override_settings(CSP_REPORT_ONLY=False)
    def test_allowed_origins_wildcard_subdomain(self):
        referrer = "https://foo.nugettrends.com"
        self.project.update_option("sentry:toolbar_allowed_origins", ["*.nugettrends.com"])

        res = self.client.get(self.url, HTTP_REFERER=referrer)
        assert res.status_code == 200
        assert res.headers.get("X-Frame-Options") == "ALLOWALL"
        assert f"frame-ancestors {referrer}" in _get_csp_parts(res)
        assert _has_nonce(res)

        self.assertTemplateUsed(res, TEMPLATE)
        assert f"const referrer = '{referrer}';" in res.content.decode("utf-8")
        assert f"const state = '{escapejs('logged-in')}';" in res.content.decode("utf-8")

    @override_settings(CSP_REPORT_ONLY=False)
    def test_only_single_wildcard_subdomain(self):
        referrer = "https://foo.bar.nugettrends.com"
        self.project.update_option("sentry:toolbar_allowed_origins", ["*.nugettrends.com"])

        res = self.client.get(self.url, HTTP_REFERER=referrer)
        assert res.status_code == 200
        assert res.headers.get("X-Frame-Options") == "ALLOWALL"
        assert f"frame-ancestors {referrer}" in _get_csp_parts(res)
        assert _has_nonce(res)

        self.assertTemplateUsed(res, TEMPLATE)
        assert f"const referrer = '{referrer}';" in res.content.decode("utf-8")
        assert f"const state = '{escapejs('invalid-domain')}';" in res.content.decode("utf-8")

    @override_settings(CSP_REPORT_ONLY=False)
    def test_no_referrer(self):
        self.project.update_option("sentry:toolbar_allowed_origins", ["*.nugettrends.com"])

        res = self.client.get(self.url)
        assert res.status_code == 200
        assert res.headers.get("X-Frame-Options") == "DENY"
        assert "frame-ancestors 'none'" in _get_csp_parts(res)
        assert _has_nonce(res)

        self.assertTemplateUsed(res, TEMPLATE)
        assert "const referrer = '';" in res.content.decode("utf-8")
        assert f"const state = '{escapejs('invalid-domain')}';" in res.content.decode("utf-8")


def _get_csp_parts(response):
    # Fallback to `c` for tests in dev.
    csp = response.headers.get("Content-Security-Policy", response.headers.get("c"))
    return [chunk.strip() for chunk in csp.split(";")]


def _has_nonce(response):
    content = response.content.decode("utf-8")
    # Middleware automatically injects the `nonce` attribute onto our <script>
    # tag; so if that attribute is there then we can assume the nonce header and
    # value are set correctly.
    return "<script nonce=" in content
