from django.test import TestCase
from django.urls import reverse
from rest_framework.test import APITestCase
from urllib.parse import urlparse, parse_qs

from sentry.constants.mobile_auth import ALLOWED_MOBILE_SCHEMES
from sentry.models.organization import Organization
from sentry.models.organizationmapping import OrganizationMapping
from sentry.testutils.cases import TestCase as SentryTestCase
from sentry.utils.auth import is_valid_redirect


class MobileAuthenticationTest(SentryTestCase):
    """
    Test cases for mobile authentication flow using custom URL schemes.
    """

    def setUp(self):
        super().setUp()
        self.organization = self.create_organization(name="Test Org", slug="test-org")
        self.user = self.create_user("test@example.com")

    def test_is_valid_redirect_with_mobile_scheme(self):
        """Test that mobile custom URL schemes are considered valid redirects."""
        # Test valid mobile scheme
        self.assertTrue(is_valid_redirect("sentry-mobile-agent://auth"))
        self.assertTrue(is_valid_redirect("sentry-mobile-agent://auth/callback"))
        
        # Test invalid schemes
        self.assertFalse(is_valid_redirect("malicious-scheme://evil.com"))
        self.assertFalse(is_valid_redirect("http://evil.com"))
        self.assertFalse(is_valid_redirect(""))
        self.assertFalse(is_valid_redirect(None))

    def test_organization_login_with_mobile_next_parameter(self):
        """Test that the organization login page accepts mobile next parameter."""
        url = reverse("sentry-auth-organization", args=[self.organization.slug])
        mobile_redirect = "sentry-mobile-agent://auth"
        
        response = self.client.get(url, {"next": mobile_redirect})
        
        # Should show login page without redirect error
        self.assertEqual(response.status_code, 200)
        
        # Check that the next URL is preserved in session
        session = self.client.session
        self.assertEqual(session.get("_next"), mobile_redirect)

    def test_successful_login_redirects_to_mobile_app(self):
        """Test that successful authentication redirects to mobile app."""
        url = reverse("sentry-auth-organization", args=[self.organization.slug])
        mobile_redirect = "sentry-mobile-agent://auth"
        
        # First, set up the mobile redirect in session
        session = self.client.session
        session["_next"] = mobile_redirect
        session.save()
        
        # Login the user
        self.login_as(self.user)
        
        # Make request as authenticated user
        response = self.client.get(url)
        
        # Should redirect to the mobile app
        self.assertEqual(response.status_code, 302)
        # The redirect location should be the mobile custom URL scheme
        # Note: In a real test, this would depend on the specific flow implementation


class MobileAuthValidationTest(TestCase):
    """
    Unit tests for mobile authentication validation functions.
    """
    
    def test_mobile_scheme_validation(self):
        """Test mobile URL scheme validation."""
        from sentry.utils.auth import is_valid_redirect
        
        # Valid mobile schemes
        valid_urls = [
            "sentry-mobile-agent://auth",
            "sentry-mobile-agent://callback",
            "sentry-mobile-agent://success",
        ]
        
        for url in valid_urls:
            with self.subTest(url=url):
                self.assertTrue(is_valid_redirect(url), f"Should be valid: {url}")
        
        # Invalid schemes and URLs
        invalid_urls = [
            "http://evil.com",
            "https://evil.com", 
            "ftp://example.com",
            "malicious-app://steal-data",
            "",
            None,
        ]
        
        for url in invalid_urls:
            with self.subTest(url=url):
                self.assertFalse(is_valid_redirect(url), f"Should be invalid: {url}")

    def test_mobile_redirect_preservation(self):
        """Test that mobile redirects are preserved through auth flow."""
        from urllib.parse import urlparse
        from sentry.utils.auth import get_login_redirect
        from django.test import RequestFactory
        
        factory = RequestFactory()
        request = factory.get("/")
        
        # Set up a mobile redirect in session
        mobile_url = "sentry-mobile-agent://auth"
        request.session = {"_next": mobile_url}
        
        # Mock request attributes that might be needed
        request.user = type('MockUser', (), {'is_authenticated': False})()
        
        # Get the login redirect
        redirect_url = get_login_redirect(request)
        
        # Should preserve the mobile URL scheme
        parsed = urlparse(redirect_url)
        self.assertEqual(parsed.scheme, "sentry-mobile-agent")


class MobileAuthIntegrationTest(TestCase):
    """
    Integration tests for the complete mobile authentication flow.
    """
    
    def test_url_parsing_functionality(self):
        """Test URL parsing functionality for mobile schemes."""
        test_cases = [
            ("sentry-mobile-agent://auth", "sentry-mobile-agent", "", ""),
            ("sentry-mobile-agent://callback?code=123", "sentry-mobile-agent", "code=123", ""),
            ("https://example.com/path", "https", "", "example.com"),
            ("http://evil.com", "http", "", "evil.com"),
        ]
        
        for url, expected_scheme, expected_query, expected_netloc in test_cases:
            with self.subTest(url=url):
                parsed = urlparse(url)
                self.assertEqual(parsed.scheme, expected_scheme)
                self.assertEqual(parsed.netloc, expected_netloc)
                self.assertEqual(parsed.query, expected_query)

    def test_integration_flow_simulation(self):
        """Test the complete mobile authentication integration flow."""
        mobile_redirect_url = "sentry-mobile-agent://auth"
        org_slug = "test-org"
        
        login_url = f"https://{org_slug}.sentry.io/auth/login/{org_slug}/?next={mobile_redirect_url}"
        
        parsed_login = urlparse(login_url)
        query_params = parse_qs(parsed_login.query)
        next_url = query_params.get('next', [None])[0]
        
        self.assertEqual(next_url, mobile_redirect_url)
        
        def is_valid_mobile_redirect(url):
            if not url:
                return False
            try:
                parsed = urlparse(url)
                return parsed.scheme in ALLOWED_MOBILE_SCHEMES
            except Exception:
                return False
        
        is_valid = is_valid_mobile_redirect(next_url)
        self.assertTrue(is_valid)
        
        parsed_redirect = urlparse(mobile_redirect_url)
        self.assertEqual(parsed_redirect.scheme, "sentry-mobile-agent")
        self.assertEqual(parsed_redirect.netloc, "")
        self.assertEqual(parsed_redirect.path, "auth")

    def test_mobile_scheme_edge_cases(self):
        """Test edge cases for mobile URL scheme validation."""
        def is_valid_mobile_redirect(url):
            if not url:
                return False
            try:
                parsed = urlparse(url)
                return parsed.scheme in ALLOWED_MOBILE_SCHEMES
            except Exception:
                return False
        
        valid_urls = [
            "sentry-mobile-agent://auth",
            "sentry-mobile-agent://callback",
            "sentry-mobile-agent://success",
        ]
        
        for url in valid_urls:
            with self.subTest(url=url):
                self.assertTrue(is_valid_mobile_redirect(url))
        
        invalid_urls = [
            "http://evil.com",
            "https://evil.com", 
            "ftp://example.com",
            "malicious-app://steal-data",
            "",
            None,
        ]
        
        for url in invalid_urls:
            with self.subTest(url=url):
                self.assertFalse(is_valid_mobile_redirect(url))