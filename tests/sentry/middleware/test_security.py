from __future__ import annotations

from functools import cached_property
from unittest import TestCase

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
