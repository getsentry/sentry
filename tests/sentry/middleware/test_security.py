from __future__ import annotations

from functools import cached_property
from unittest import TestCase, mock

from django.test import RequestFactory, override_settings
from rest_framework.response import Response

from sentry.middleware.security import SecurityHeadersMiddleware
from sentry.utils import json


class SecurityHeadersMiddlewareTest(TestCase):
    middleware = cached_property(SecurityHeadersMiddleware)

    @cached_property
    def factory(self):
        return RequestFactory()

    def test_standard_headers_set(self) -> None:
        request = self.factory.get("/")
        response = Response()
        processed_response = self.middleware.process_response(request, response)

        assert processed_response["X-Content-Type-Options"] == "nosniff"
        assert processed_response["X-XSS-Protection"] == "1; mode=block"
        assert processed_response["X-Frame-Options"] == "deny"

    def test_x_frame_options_not_set_for_jira_extensions(self) -> None:
        request = self.factory.get("/extensions/jira/")
        response = Response()
        processed_response = self.middleware.process_response(request, response)

        assert "X-Frame-Options" not in processed_response
        assert processed_response["X-Content-Type-Options"] == "nosniff"
        assert processed_response["X-XSS-Protection"] == "1; mode=block"

    def test_coop_headers_not_set_when_disabled(self) -> None:
        """Test that COOP headers are not set when COOP_ENABLED=False (default)"""
        request = self.factory.get("/")
        response = Response()
        processed_response = self.middleware.process_response(request, response)

        assert "Cross-Origin-Opener-Policy" not in processed_response
        assert "Cross-Origin-Opener-Policy-Report-Only" not in processed_response
        assert "Report-To" not in processed_response

    @override_settings(COOP_ENABLED=True)
    def test_coop_headers_set_when_enabled_without_report_to(self) -> None:
        """Test that COOP headers are set when COOP_ENABLED=True and COOP_REPORT_TO=None"""
        request = self.factory.get("/")
        response = Response()
        processed_response = self.middleware.process_response(request, response)

        assert processed_response["Cross-Origin-Opener-Policy-Report-Only"] == "same-origin"
        assert "Cross-Origin-Opener-Policy" not in processed_response
        assert "Report-To" not in processed_response

    @override_settings(COOP_ENABLED=True, COOP_REPORT_ONLY=False)
    def test_coop_headers_set_when_enabled_report_only_false_without_report_to(self) -> None:
        """Test that COOP headers are set when COOP_ENABLED=True, COOP_REPORT_ONLY=False, and COOP_REPORT_TO=None"""
        request = self.factory.get("/")
        response = Response()
        processed_response = self.middleware.process_response(request, response)

        assert processed_response["Cross-Origin-Opener-Policy"] == "same-origin"
        assert "Cross-Origin-Opener-Policy-Report-Only" not in processed_response
        assert "Report-To" not in processed_response

    @override_settings(COOP_ENABLED=True, COOP_REPORT_TO="https://example.com/callback/")
    def test_coop_headers_set_when_enabled_with_report_to(self) -> None:
        """Test that COOP headers are set when COOP_ENABLED=True and COOP_REPORT_TO is configured"""
        request = self.factory.get("/")
        response = Response()
        processed_response = self.middleware.process_response(request, response)

        assert (
            processed_response["Cross-Origin-Opener-Policy-Report-Only"]
            == 'same-origin; report-to="coop-endpoint"'
        )

        report_to = json.loads(processed_response["Report-To"])
        assert report_to["group"] == "coop-endpoint"
        assert report_to["max_age"] == 86400
        assert len(report_to["endpoints"]) == 1
        assert report_to["endpoints"][0]["url"] == "https://example.com/callback/"

    @override_settings(
        COOP_ENABLED=True, COOP_REPORT_ONLY=False, COOP_REPORT_TO="https://example.com/callback/"
    )
    def test_coop_headers_set_when_enabled_report_only_false_with_report_to(self) -> None:
        """Test that COOP headers are set when COOP_ENABLED=True, COOP_REPORT_ONLY=False, and COOP_REPORT_TO is configured"""
        request = self.factory.get("/")
        response = Response()
        processed_response = self.middleware.process_response(request, response)

        assert (
            processed_response["Cross-Origin-Opener-Policy"]
            == 'same-origin; report-to="coop-endpoint"'
        )

        report_to = json.loads(processed_response["Report-To"])
        assert report_to["group"] == "coop-endpoint"
        assert report_to["max_age"] == 86400
        assert len(report_to["endpoints"]) == 1
        assert report_to["endpoints"][0]["url"] == "https://example.com/callback/"

    def test_trusted_types_header_not_set_when_disabled(self) -> None:
        """TRUSTED_TYPES_ENABLED defaults to False, so no extra policy is emitted."""
        request = self.factory.get("/")
        response = Response()
        processed_response = self.middleware.process_response(request, response)

        assert "Content-Security-Policy-Report-Only" not in processed_response

    @override_settings(TRUSTED_TYPES_ENABLED=True, CSP_REPORT_ONLY=False)
    def test_trusted_types_header_set_when_enabled(self) -> None:
        request = self.factory.get("/")
        response = Response()
        processed_response = self.middleware.process_response(request, response)

        assert processed_response["Content-Security-Policy-Report-Only"] == (
            "require-trusted-types-for 'script'; trusted-types dompurify sentry-script-url sentry-bundler"
        )

    @override_settings(TRUSTED_TYPES_ENABLED=True, CSP_REPORT_ONLY=False)
    def test_trusted_types_header_does_not_touch_enforced_csp(self) -> None:
        """The enforced Content-Security-Policy must be left completely alone."""
        request = self.factory.get("/")
        response = Response()
        response["Content-Security-Policy"] = "default-src 'none'; script-src 'self'"
        processed_response = self.middleware.process_response(request, response)

        assert (
            processed_response["Content-Security-Policy"] == "default-src 'none'; script-src 'self'"
        )
        assert (
            "require-trusted-types-for" in processed_response["Content-Security-Policy-Report-Only"]
        )

    @override_settings(TRUSTED_TYPES_ENABLED=True, CSP_REPORT_ONLY=True)
    def test_trusted_types_header_skipped_when_django_csp_owns_report_only(self) -> None:
        """
        django-csp emits the -Report-Only header itself when CSP_REPORT_ONLY is on, and
        bails if that header already exists. Claiming the name here would silently drop
        the entire CSP, so the middleware must stand down.
        """
        request = self.factory.get("/")
        response = Response()
        processed_response = self.middleware.process_response(request, response)

        assert "Content-Security-Policy-Report-Only" not in processed_response

    @override_settings(TRUSTED_TYPES_ENABLED=True, CSP_REPORT_ONLY=True)
    def test_trusted_types_warns_once_when_skipped(self) -> None:
        """
        Standing down is correct but invisible, so someone who enables the setting and
        sees nothing gets a log line pointing at why. Once per process, not per request.
        """
        from sentry.middleware import security

        security._warned_about_report_only_csp = False

        request = self.factory.get("/")
        with mock.patch.object(security.logger, "warning") as mock_warning:
            self.middleware.process_response(request, Response())
            self.middleware.process_response(request, Response())

        assert mock_warning.call_count == 1
        assert mock_warning.call_args[0][0] == "trusted_types.disabled_by_report_only_csp"

    @override_settings(TRUSTED_TYPES_ENABLED=True, CSP_REPORT_ONLY=False)
    def test_trusted_types_header_does_not_overwrite_existing(self) -> None:
        request = self.factory.get("/")
        response = Response()
        response["Content-Security-Policy-Report-Only"] = "default-src 'none'"
        processed_response = self.middleware.process_response(request, response)

        assert processed_response["Content-Security-Policy-Report-Only"] == "default-src 'none'"

    @override_settings(
        TRUSTED_TYPES_ENABLED=True,
        CSP_REPORT_ONLY=False,
        TRUSTED_TYPES_REPORT_URI="https://example.com/security/?sentry_key=abc",
    )
    def test_trusted_types_header_includes_report_uri(self) -> None:
        request = self.factory.get("/")
        response = Response()
        processed_response = self.middleware.process_response(request, response)

        assert processed_response["Content-Security-Policy-Report-Only"] == (
            "require-trusted-types-for 'script'; "
            "trusted-types dompurify sentry-script-url sentry-bundler; "
            "report-uri https://example.com/security/?sentry_key=abc"
        )

    @override_settings(TRUSTED_TYPES_ENABLED=True, CSP_REPORT_ONLY=False, TRUSTED_TYPES_POLICIES=[])
    def test_trusted_types_header_omits_empty_policy_allowlist(self) -> None:
        request = self.factory.get("/")
        response = Response()
        processed_response = self.middleware.process_response(request, response)

        assert (
            processed_response["Content-Security-Policy-Report-Only"]
            == "require-trusted-types-for 'script'"
        )
