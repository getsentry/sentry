from django.test.utils import override_settings
from django.urls import reverse

from sentry.testutils.cases import TestCase
from sentry.testutils.helpers import override_options
from sentry.testutils.silo import control_silo_test


@control_silo_test
class ToolbarCspUpdateTest(TestCase):
    view_name = "sentry-organization-home"

    def setUp(self):
        super().setUp()
        self.login_as(user=self.user)
        self.url = reverse(self.view_name, args=[self.organization.slug])

    @override_settings(CSP_REPORT_ONLY=False, CSP_FRAME_SRC=None)
    @override_options({"devtoolbar.csp_iframe_src.allowed_origins": []})
    def test_none_csp_is_not_set(self):
        resp = self.client.get(self.url)
        assert "frame-src" not in _get_csp_parts(resp)

    @override_settings(CSP_REPORT_ONLY=False, CSP_FRAME_SRC=None)
    @override_options({"devtoolbar.csp_iframe_src.allowed_origins": ["special.server"]})
    def test_none_csp_ignored_unknown_host(self):
        resp = self.client.get(self.url)
        assert "frame-src" not in _get_csp_parts(resp)

    @override_settings(CSP_REPORT_ONLY=False, CSP_FRAME_SRC=None)
    @override_options({"devtoolbar.csp_iframe_src.allowed_origins": ["testserver"]})
    def test_none_csp_adds_known_host(self):
        resp = self.client.get(self.url)
        assert "frame-src testserver" not in _get_csp_parts(resp)

    @override_settings(CSP_REPORT_ONLY=False, CSP_FRAME_SRC=["default.example.com"])
    @override_options({"devtoolbar.csp_iframe_src.allowed_origins": []})
    def test_default_csp_is_set(self):
        resp = self.client.get(self.url)
        assert "frame-src default.example.com" in _get_csp_parts(resp)

    @override_settings(CSP_REPORT_ONLY=False, CSP_FRAME_SRC=["default.example.com"])
    @override_options({"devtoolbar.csp_iframe_src.allowed_origins": ["special.server"]})
    def test_default_csp_ignored_unknown_host(self):
        resp = self.client.get(self.url)
        assert "frame-src default.example.com" in _get_csp_parts(resp)

    @override_settings(CSP_REPORT_ONLY=False, CSP_FRAME_SRC=["default.example.com"])
    @override_options({"devtoolbar.csp_iframe_src.allowed_origins": ["testserver"]})
    def test_default_csp_updates_known_host(self):
        resp = self.client.get(self.url)
        assert "frame-src default.example.com testserver" not in _get_csp_parts(resp)


def _get_csp_parts(response):
    # Fallback to `c` for tests in dev.
    csp = response.headers.get("Content-Security-Policy", response.headers.get("c"))
    return [chunk.strip() for chunk in csp.split(";")]
