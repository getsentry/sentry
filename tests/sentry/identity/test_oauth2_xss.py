"""Test XSS vulnerability fixes in OAuth2 callback flow."""
from functools import cached_property
from unittest.mock import patch

from django.test import RequestFactory

import sentry.identity
from sentry.identity.oauth2 import OAuth2CallbackView
from sentry.identity.pipeline import IdentityPipeline
from sentry.identity.providers.dummy import DummyProvider
from sentry.testutils.cases import TestCase
from sentry.testutils.silo import control_silo_test


@control_silo_test
@patch("sentry.integrations.utils.metrics.EventLifecycle.record_event")
class OAuth2CallbackXSSTest(TestCase):
    """Tests to ensure XSS payloads are properly escaped in OAuth2 callbacks."""

    def setUp(self) -> None:
        sentry.identity.register(DummyProvider)
        super().setUp()
        self.factory = RequestFactory()

    def tearDown(self) -> None:
        super().tearDown()
        sentry.identity.unregister(DummyProvider)

    @cached_property
    def view(self):
        return OAuth2CallbackView(
            access_token_url="https://example.org/oauth/token",
            client_id=123456,
            client_secret="secret-value",
        )

    def test_error_parameter_xss_esi_include(self, mock_record):
        """Test that ESI include tags in error parameter are escaped."""
        xss_payload = '1<esi:include src="http://bxss.me/rpb.png"/>'
        request = self.factory.get("/", {"error": xss_payload})
        request.subdomain = None
        request.session = {}

        pipeline = IdentityPipeline(request=request, provider_key="dummy")
        response = self.view.dispatch(request, pipeline)

        # Verify the response contains escaped HTML
        content = response.content.decode("utf-8")
        assert "&lt;esi:include" in content
        assert 'src="http://bxss.me/rpb.png"' not in content
        assert "&lt;/esi:include&gt;" in content or "/&gt;" in content
        # Ensure the raw XSS payload is NOT present
        assert '<esi:include src="http://bxss.me/rpb.png"/>' not in content

    def test_error_parameter_xss_script_tag(self, mock_record):
        """Test that script tags in error parameter are escaped."""
        xss_payload = '<script>alert("XSS")</script>'
        request = self.factory.get("/", {"error": xss_payload})
        request.subdomain = None
        request.session = {}

        pipeline = IdentityPipeline(request=request, provider_key="dummy")
        response = self.view.dispatch(request, pipeline)

        # Verify the response contains escaped HTML
        content = response.content.decode("utf-8")
        assert "&lt;script&gt;" in content
        assert "&lt;/script&gt;" in content
        # Ensure the raw script tag is NOT present
        assert '<script>alert("XSS")</script>' not in content

    def test_error_parameter_xss_img_tag(self, mock_record):
        """Test that img tags with onerror in error parameter are escaped."""
        xss_payload = '<img src=x onerror=alert("XSS")>'
        request = self.factory.get("/", {"error": xss_payload})
        request.subdomain = None
        request.session = {}

        pipeline = IdentityPipeline(request=request, provider_key="dummy")
        response = self.view.dispatch(request, pipeline)

        # Verify the response contains escaped HTML
        content = response.content.decode("utf-8")
        assert "&lt;img" in content
        assert "onerror" not in content or "&lt;img src=x onerror=" in content
        # Ensure the raw img tag is NOT present
        assert '<img src=x onerror=alert("XSS")>' not in content

    def test_error_parameter_xss_html_entities(self, mock_record):
        """Test that HTML entities are properly escaped."""
        xss_payload = '"><svg/onload=alert(1)>'
        request = self.factory.get("/", {"error": xss_payload})
        request.subdomain = None
        request.session = {}

        pipeline = IdentityPipeline(request=request, provider_key="dummy")
        response = self.view.dispatch(request, pipeline)

        # Verify the response contains escaped HTML
        content = response.content.decode("utf-8")
        assert "&lt;svg" in content or '"&gt;&lt;svg' in content
        # Ensure the raw payload is NOT present
        assert '"><svg/onload=alert(1)>' not in content

    def test_normal_error_still_displayed(self, mock_record):
        """Test that normal error messages are still displayed correctly."""
        normal_error = "invalid_request"
        request = self.factory.get("/", {"error": normal_error})
        request.subdomain = None
        request.session = {}

        pipeline = IdentityPipeline(request=request, provider_key="dummy")
        response = self.view.dispatch(request, pipeline)

        # Verify the normal error message is displayed
        content = response.content.decode("utf-8")
        assert "invalid_request" in content

    def test_error_parameter_with_ampersand(self, mock_record):
        """Test that error messages with ampersands are correctly escaped."""
        error_with_ampersand = "Error: A & B"
        request = self.factory.get("/", {"error": error_with_ampersand})
        request.subdomain = None
        request.session = {}

        pipeline = IdentityPipeline(request=request, provider_key="dummy")
        response = self.view.dispatch(request, pipeline)

        content = response.content.decode("utf-8")
        # The ampersand should be escaped
        assert "&amp;" in content or "A &amp; B" in content
        # Original text should still be recognizable
        assert "Error:" in content
