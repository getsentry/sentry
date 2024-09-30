from typing import Any
from unittest.mock import Mock, patch

from django.test import override_settings
from django.urls import reverse

from sentry.testutils.cases import APITestCase
from sentry.toolbar.utils.testutils import csp_has_directive
from sentry.toolbar.views.iframe_view import INVALID_TEMPLATE, SUCCESS_TEMPLATE


class IframeViewTest(APITestCase):
    view_name = "sentry-toolbar-iframe"

    def setUp(self):
        super().setUp()
        self.login_as(user=self.user)
        self.url = reverse(self.view_name, args=(self.organization.slug, self.project.slug))

    def test_missing_project(self):
        url = reverse(self.view_name, args=(self.organization.slug, "abc123xyz"))
        res = self.client.get(url)
        assert _is_no_project_response(res, None)

    def test_default_no_allowed_origins(self):
        res = self.client.get(self.url, HTTP_REFERER="https://example.com")
        assert _is_invalid_origin_response(res, "https://example.com")

    def test_allowed_origins_basic(self):
        self.project.update_option("sentry:toolbar_allowed_origins", ["sentry.io"])
        for referrer in ["https://sentry.io/issues/?a=b/", "https://sentry.io:127/replays/"]:
            res = self.client.get(self.url, HTTP_REFERER=referrer)
            assert _is_success_response(res, referrer)

    def test_allowed_origins_wildcard_subdomain(self):
        self.project.update_option("sentry:toolbar_allowed_origins", ["*.nugettrends.com"])
        res = self.client.get(self.url, HTTP_REFERER="https://bruno.nugettrends.com")
        assert _is_success_response(res, "https://bruno.nugettrends.com")

        res = self.client.get(self.url, HTTP_REFERER="https://andrew.ryan.nugettrends.com")
        assert _is_invalid_origin_response(res, "https://andrew.ryan.nugettrends.com")

    def test_no_referrer(self):
        self.project.update_option("sentry:toolbar_allowed_origins", ["sentry.io"])
        res = self.client.get(self.url)
        assert _is_invalid_origin_response(res, None)

    def test_calls_url_matches(self):
        """
        The `url_matches` helper fx has more in-depth unit test coverage.
        """
        mock_url_matches = Mock(return_value=False)
        allowed_origins = ["sentry.io", "abc.com"]
        referrer = "https://example.com"
        self.project.update_option("sentry:toolbar_allowed_origins", allowed_origins)
        with patch("sentry.toolbar.utils.url.url_matches", mock_url_matches):
            self.client.get(self.url, HTTP_REFERER=referrer)

        assert mock_url_matches.call_count == 2
        for (i, (args, _)) in enumerate(mock_url_matches.call_args_list):
            assert args[0] == referrer
            assert args[1] == allowed_origins[i]

    def test_x_frame_options(self):
        self.project.update_option("sentry:toolbar_allowed_origins", ["https://sentry.io"])
        res = self.client.get(self.url, HTTP_REFERER="https://sentry.io")
        assert res.headers.get("X-Frame-Options") == "ALLOWALL"

    @override_settings(CSP_REPORT_ONLY=False)
    def test_csp_frame_ancestors(self):
        # Pass res through middleware
        # Check CSP frame-ancestors directive
        referrer = "https://testsite.io"
        self.project.update_option("sentry:toolbar_allowed_origins", [referrer])
        res = self.client.get(self.url, HTTP_REFERER=referrer)
        csp = res.headers.get("Content-Security-Policy", "")
        assert csp_has_directive(csp, "frame-ancestors", [referrer], ["'none'"])

    @override_settings(CSP_REPORT_ONLY=False, CSP_INCLUDE_NONCE_IN=["script-src"])
    def test_csp_script_src_nonce(self):
        referrer = "https://testsite.io"
        self.project.update_option("sentry:toolbar_allowed_origins", [referrer])
        mock_nonce = f"{'a'*22}=="

        def mock_process_request(request):
            request._csp_nonce = mock_nonce
            request.csp_nonce = mock_nonce
            return None

        with patch(
            "csp.middleware.CSPMiddleware.process_request", Mock(side_effect=mock_process_request)
        ):
            res = self.client.get(self.url, HTTP_REFERER=referrer)

        # Header
        csp = res.headers.get("Content-Security-Policy", "")
        assert csp_has_directive(csp, "script-src", [f"'nonce-{mock_nonce}'"], [])

        # Content
        script_tag = f'<script nonce="{mock_nonce}">'
        assert script_tag in res.content.decode("utf-8")


def _has_expected_response(
    response, status_code: int, template_name: str, required_context: dict[str, Any]
):
    return all(
        [
            response.status_code == status_code,
            [t.name for t in response.templates] == [template_name],
            *[response.context[k] == v for (k, v) in required_context.items()],
        ]
    )


def _is_success_response(response, referrer: str):
    return _has_expected_response(response, 200, SUCCESS_TEMPLATE, {"referrer": referrer})


def _is_no_project_response(response, referrer: str | None):
    return _has_expected_response(
        response, 404, INVALID_TEMPLATE, {"has_project": False, "referrer": referrer}
    )


def _is_invalid_origin_response(response, referrer: str | None):
    return _has_expected_response(
        response,
        403,
        INVALID_TEMPLATE,
        {"has_project": True, "allow_origin": False, "referrer": referrer},
    )
