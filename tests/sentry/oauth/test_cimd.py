from __future__ import annotations

from unittest.mock import patch

import pytest
import responses
from requests.exceptions import ConnectionError as RequestsConnectionError
from requests.exceptions import Timeout

from sentry.exceptions import RestrictedIPAddress
from sentry.oauth.cimd import (
    CIMDCache,
    CIMDClient,
    CIMDFetchError,
    CIMDValidationError,
    validate_cimd_document,
)
from sentry.testutils.cases import TestCase


class CIMDClientTest(TestCase):
    def setUp(self):
        super().setUp()
        self.client = CIMDClient()
        self.test_url = "https://example.com/oauth/client"

    @responses.activate
    def test_fetch_metadata_success(self):
        """Successfully fetch and parse a valid CIMD metadata document."""
        metadata = {
            "client_id": self.test_url,
            "client_name": "Test Application",
            "redirect_uris": ["https://example.com/callback"],
        }
        responses.add(
            responses.GET,
            self.test_url,
            json=metadata,
            status=200,
            content_type="application/json",
        )

        result = self.client.fetch_metadata(self.test_url)

        assert result == metadata
        assert len(responses.calls) == 1
        assert responses.calls[0].request.headers["Accept"] == "application/json"

    @responses.activate
    def test_fetch_metadata_success_with_charset(self):
        """Accept Content-Type with charset parameter."""
        metadata = {"client_id": self.test_url}
        responses.add(
            responses.GET,
            self.test_url,
            json=metadata,
            status=200,
            content_type="application/json; charset=utf-8",
        )

        result = self.client.fetch_metadata(self.test_url)

        assert result == metadata

    @responses.activate
    def test_fetch_metadata_http_error(self):
        """Raise CIMDFetchError on non-200 HTTP status."""
        responses.add(
            responses.GET,
            self.test_url,
            status=404,
        )

        with pytest.raises(CIMDFetchError) as exc_info:
            self.client.fetch_metadata(self.test_url)

        assert "HTTP 404" in str(exc_info.value)

    @responses.activate
    def test_fetch_metadata_server_error(self):
        """Raise CIMDFetchError on server error."""
        responses.add(
            responses.GET,
            self.test_url,
            status=500,
        )

        with pytest.raises(CIMDFetchError) as exc_info:
            self.client.fetch_metadata(self.test_url)

        assert "HTTP 500" in str(exc_info.value)

    @responses.activate
    def test_fetch_metadata_invalid_content_type(self):
        """Raise CIMDFetchError when Content-Type is not application/json."""
        responses.add(
            responses.GET,
            self.test_url,
            body="<html>Not JSON</html>",
            status=200,
            content_type="text/html",
        )

        with pytest.raises(CIMDFetchError) as exc_info:
            self.client.fetch_metadata(self.test_url)

        assert "Invalid content type" in str(exc_info.value)
        assert "text/html" in str(exc_info.value)

    @responses.activate
    def test_fetch_metadata_missing_content_type(self):
        """Raise CIMDFetchError when Content-Type header is missing."""
        responses.add(
            responses.GET,
            self.test_url,
            body="{}",
            status=200,
            headers={},  # No Content-Type header
        )

        with pytest.raises(CIMDFetchError) as exc_info:
            self.client.fetch_metadata(self.test_url)

        assert "Invalid content type" in str(exc_info.value)

    @responses.activate
    def test_fetch_metadata_response_too_large(self):
        """Raise CIMDFetchError when response exceeds size limit."""
        large_body = b'{"data": "' + b"x" * (CIMDClient.MAX_RESPONSE_SIZE + 1) + b'"}'
        responses.add(
            responses.GET,
            self.test_url,
            body=large_body,
            status=200,
            content_type="application/json",
        )

        with pytest.raises(CIMDFetchError) as exc_info:
            self.client.fetch_metadata(self.test_url)

        assert "too large" in str(exc_info.value)

    @responses.activate
    def test_fetch_metadata_invalid_json(self):
        """Raise CIMDFetchError when response is not valid JSON."""
        responses.add(
            responses.GET,
            self.test_url,
            body="not valid json",
            status=200,
            content_type="application/json",
        )

        with pytest.raises(CIMDFetchError) as exc_info:
            self.client.fetch_metadata(self.test_url)

        assert "Invalid JSON" in str(exc_info.value)

    @responses.activate
    def test_fetch_metadata_json_array_not_object(self):
        """Raise CIMDFetchError when JSON is an array instead of object."""
        responses.add(
            responses.GET,
            self.test_url,
            json=["not", "an", "object"],
            status=200,
            content_type="application/json",
        )

        with pytest.raises(CIMDFetchError) as exc_info:
            self.client.fetch_metadata(self.test_url)

        assert "must be a JSON object" in str(exc_info.value)

    @responses.activate
    def test_fetch_metadata_timeout(self):
        """Raise CIMDFetchError on request timeout."""
        responses.add(
            responses.GET,
            self.test_url,
            body=Timeout("Connection timed out"),
        )

        with pytest.raises(CIMDFetchError) as exc_info:
            self.client.fetch_metadata(self.test_url)

        assert "Timeout" in str(exc_info.value)

    @responses.activate
    def test_fetch_metadata_connection_error(self):
        """Raise CIMDFetchError on connection error."""
        responses.add(
            responses.GET,
            self.test_url,
            body=RequestsConnectionError("Connection refused"),
        )

        with pytest.raises(CIMDFetchError) as exc_info:
            self.client.fetch_metadata(self.test_url)

        assert "Connection error" in str(exc_info.value)

    def test_fetch_metadata_restricted_ip(self):
        """Raise CIMDFetchError when URL resolves to restricted IP."""
        with patch("sentry.oauth.cimd.safe_urlopen") as mock_urlopen:
            mock_urlopen.side_effect = RestrictedIPAddress("127.0.0.1")

            with pytest.raises(CIMDFetchError) as exc_info:
                self.client.fetch_metadata(self.test_url)

            assert "restricted IP" in str(exc_info.value)

    @responses.activate
    def test_fetch_metadata_does_not_follow_redirects(self):
        """Verify that redirects are not followed (security requirement)."""
        responses.add(
            responses.GET,
            self.test_url,
            status=302,
            headers={"Location": "https://evil.com/malicious"},
        )

        with pytest.raises(CIMDFetchError) as exc_info:
            self.client.fetch_metadata(self.test_url)

        assert "HTTP 302" in str(exc_info.value)
        assert len(responses.calls) == 1

    def test_max_response_size_constant(self):
        """Verify MAX_RESPONSE_SIZE is set to 5KB per RFC recommendation."""
        assert CIMDClient.MAX_RESPONSE_SIZE == 5 * 1024

    def test_timeout_constant(self):
        """Verify TIMEOUT is set to a reasonable value."""
        assert CIMDClient.TIMEOUT == 15


class CIMDValidationTest(TestCase):
    """Tests for CIMD metadata document validation."""

    def setUp(self):
        super().setUp()
        self.test_url = "https://example.com/oauth/client"

    def test_validate_valid_minimal_document(self):
        """Validate a minimal valid CIMD document."""
        document = {"client_id": self.test_url}
        # Should not raise
        validate_cimd_document(document, self.test_url)

    def test_validate_valid_full_document(self):
        """Validate a full valid CIMD document with all optional fields."""
        document = {
            "client_id": self.test_url,
            "client_name": "Test Application",
            "redirect_uris": ["https://example.com/callback"],
            "grant_types": ["authorization_code", "refresh_token"],
            "response_types": ["code"],
            "token_endpoint_auth_method": "none",
        }
        # Should not raise
        validate_cimd_document(document, self.test_url)

    def test_validate_missing_client_id(self):
        """Reject document without client_id field."""
        document = {"client_name": "Test Application"}

        with pytest.raises(CIMDValidationError) as exc_info:
            validate_cimd_document(document, self.test_url)

        assert "Missing required field: client_id" in str(exc_info.value)

    def test_validate_client_id_mismatch(self):
        """Reject document where client_id doesn't match fetch URL."""
        document = {"client_id": "https://other.com/client"}

        with pytest.raises(CIMDValidationError) as exc_info:
            validate_cimd_document(document, self.test_url)

        assert "client_id mismatch" in str(exc_info.value)
        assert "https://other.com/client" in str(exc_info.value)
        assert self.test_url in str(exc_info.value)

    def test_validate_client_id_case_sensitive(self):
        """Verify client_id comparison is case-sensitive (per RFC 3986 §6.2.1)."""
        document = {"client_id": "https://EXAMPLE.COM/oauth/client"}

        with pytest.raises(CIMDValidationError) as exc_info:
            validate_cimd_document(document, self.test_url)

        assert "client_id mismatch" in str(exc_info.value)

    def test_validate_prohibited_field_client_secret(self):
        """Reject document containing client_secret."""
        document = {
            "client_id": self.test_url,
            "client_secret": "secret123",
        }

        with pytest.raises(CIMDValidationError) as exc_info:
            validate_cimd_document(document, self.test_url)

        assert "Prohibited field present: client_secret" in str(exc_info.value)

    def test_validate_prohibited_field_client_secret_expires_at(self):
        """Reject document containing client_secret_expires_at."""
        document = {
            "client_id": self.test_url,
            "client_secret_expires_at": 1234567890,
        }

        with pytest.raises(CIMDValidationError) as exc_info:
            validate_cimd_document(document, self.test_url)

        assert "Prohibited field present: client_secret_expires_at" in str(exc_info.value)

    def test_validate_prohibited_auth_method_client_secret_post(self):
        """Reject document with client_secret_post auth method."""
        document = {
            "client_id": self.test_url,
            "token_endpoint_auth_method": "client_secret_post",
        }

        with pytest.raises(CIMDValidationError) as exc_info:
            validate_cimd_document(document, self.test_url)

        assert "Prohibited authentication method: client_secret_post" in str(exc_info.value)

    def test_validate_prohibited_auth_method_client_secret_basic(self):
        """Reject document with client_secret_basic auth method."""
        document = {
            "client_id": self.test_url,
            "token_endpoint_auth_method": "client_secret_basic",
        }

        with pytest.raises(CIMDValidationError) as exc_info:
            validate_cimd_document(document, self.test_url)

        assert "Prohibited authentication method: client_secret_basic" in str(exc_info.value)

    def test_validate_prohibited_auth_method_client_secret_jwt(self):
        """Reject document with client_secret_jwt auth method."""
        document = {
            "client_id": self.test_url,
            "token_endpoint_auth_method": "client_secret_jwt",
        }

        with pytest.raises(CIMDValidationError) as exc_info:
            validate_cimd_document(document, self.test_url)

        assert "Prohibited authentication method: client_secret_jwt" in str(exc_info.value)

    def test_validate_invalid_auth_method(self):
        """Reject document with unknown auth method."""
        document = {
            "client_id": self.test_url,
            "token_endpoint_auth_method": "unknown_method",
        }

        with pytest.raises(CIMDValidationError) as exc_info:
            validate_cimd_document(document, self.test_url)

        assert "Invalid authentication method: unknown_method" in str(exc_info.value)

    def test_validate_valid_auth_method_none(self):
        """Accept document with 'none' auth method."""
        document = {
            "client_id": self.test_url,
            "token_endpoint_auth_method": "none",
        }
        # Should not raise
        validate_cimd_document(document, self.test_url)

    def test_validate_valid_auth_method_private_key_jwt(self):
        """Accept document with 'private_key_jwt' auth method."""
        document = {
            "client_id": self.test_url,
            "token_endpoint_auth_method": "private_key_jwt",
        }
        # Should not raise
        validate_cimd_document(document, self.test_url)

    def test_validate_valid_auth_method_tls_client_auth(self):
        """Accept document with 'tls_client_auth' auth method."""
        document = {
            "client_id": self.test_url,
            "token_endpoint_auth_method": "tls_client_auth",
        }
        # Should not raise
        validate_cimd_document(document, self.test_url)

    def test_validate_redirect_uris_not_array(self):
        """Reject document where redirect_uris is not an array."""
        document = {
            "client_id": self.test_url,
            "redirect_uris": "https://example.com/callback",
        }

        with pytest.raises(CIMDValidationError) as exc_info:
            validate_cimd_document(document, self.test_url)

        assert "redirect_uris must be an array" in str(exc_info.value)

    def test_validate_redirect_uris_contains_non_string(self):
        """Reject document where redirect_uris contains non-strings."""
        document = {
            "client_id": self.test_url,
            "redirect_uris": ["https://example.com/callback", 12345],
        }

        with pytest.raises(CIMDValidationError) as exc_info:
            validate_cimd_document(document, self.test_url)

        assert "redirect_uris must contain only strings" in str(exc_info.value)

    def test_validate_redirect_uri_origin_mismatch(self):
        """Reject document where redirect_uri origin doesn't match client_id origin."""
        document = {
            "client_id": self.test_url,
            "redirect_uris": ["https://other-domain.com/callback"],
        }

        with pytest.raises(CIMDValidationError) as exc_info:
            validate_cimd_document(document, self.test_url)

        assert "redirect_uri origin" in str(exc_info.value)
        assert "does not match client_id origin" in str(exc_info.value)

    def test_validate_redirect_uri_same_origin_different_path(self):
        """Accept redirect_uri with same origin but different path."""
        document = {
            "client_id": self.test_url,
            "redirect_uris": [
                "https://example.com/callback",
                "https://example.com/oauth/complete",
            ],
        }
        # Should not raise
        validate_cimd_document(document, self.test_url)

    def test_validate_redirect_uri_with_port(self):
        """Handle redirect_uris with explicit ports correctly."""
        test_url_with_port = "https://example.com:8443/oauth/client"
        document = {
            "client_id": test_url_with_port,
            "redirect_uris": ["https://example.com:8443/callback"],
        }
        # Should not raise
        validate_cimd_document(document, test_url_with_port)

    def test_validate_redirect_uri_port_mismatch(self):
        """Reject redirect_uri with different port than client_id."""
        document = {
            "client_id": self.test_url,
            "redirect_uris": ["https://example.com:9000/callback"],
        }

        with pytest.raises(CIMDValidationError) as exc_info:
            validate_cimd_document(document, self.test_url)

        assert "redirect_uri origin" in str(exc_info.value)

    def test_validate_grant_types_not_array(self):
        """Reject document where grant_types is not an array."""
        document = {
            "client_id": self.test_url,
            "grant_types": "authorization_code",
        }

        with pytest.raises(CIMDValidationError) as exc_info:
            validate_cimd_document(document, self.test_url)

        assert "grant_types must be an array" in str(exc_info.value)

    def test_validate_grant_types_contains_non_string(self):
        """Reject document where grant_types contains non-strings."""
        document = {
            "client_id": self.test_url,
            "grant_types": ["authorization_code", 123],
        }

        with pytest.raises(CIMDValidationError) as exc_info:
            validate_cimd_document(document, self.test_url)

        assert "grant_types must contain only strings" in str(exc_info.value)

    def test_validate_response_types_not_array(self):
        """Reject document where response_types is not an array."""
        document = {
            "client_id": self.test_url,
            "response_types": "code",
        }

        with pytest.raises(CIMDValidationError) as exc_info:
            validate_cimd_document(document, self.test_url)

        assert "response_types must be an array" in str(exc_info.value)

    def test_validate_response_types_contains_non_string(self):
        """Reject document where response_types contains non-strings."""
        document = {
            "client_id": self.test_url,
            "response_types": ["code", None],
        }

        with pytest.raises(CIMDValidationError) as exc_info:
            validate_cimd_document(document, self.test_url)

        assert "response_types must contain only strings" in str(exc_info.value)

    def test_validate_jwks_uri_not_string(self):
        """Reject document where jwks_uri is not a string."""
        document = {
            "client_id": self.test_url,
            "jwks_uri": {"url": "https://example.com/jwks"},
        }

        with pytest.raises(CIMDValidationError) as exc_info:
            validate_cimd_document(document, self.test_url)

        assert "jwks_uri must be a string" in str(exc_info.value)

    def test_validate_jwks_uri_not_https(self):
        """Reject document where jwks_uri is not HTTPS."""
        document = {
            "client_id": self.test_url,
            "jwks_uri": "http://example.com/jwks",
        }

        with pytest.raises(CIMDValidationError) as exc_info:
            validate_cimd_document(document, self.test_url)

        assert "jwks_uri must use HTTPS" in str(exc_info.value)

    def test_validate_jwks_uri_valid(self):
        """Accept document with valid HTTPS jwks_uri."""
        document = {
            "client_id": self.test_url,
            "jwks_uri": "https://example.com/.well-known/jwks.json",
        }
        # Should not raise
        validate_cimd_document(document, self.test_url)

    def test_validate_jwks_not_object(self):
        """Reject document where jwks is not an object."""
        document = {
            "client_id": self.test_url,
            "jwks": "not an object",
        }

        with pytest.raises(CIMDValidationError) as exc_info:
            validate_cimd_document(document, self.test_url)

        assert "jwks must be an object" in str(exc_info.value)

    def test_validate_jwks_missing_keys(self):
        """Reject document where jwks doesn't contain keys array."""
        document = {
            "client_id": self.test_url,
            "jwks": {"not_keys": []},
        }

        with pytest.raises(CIMDValidationError) as exc_info:
            validate_cimd_document(document, self.test_url)

        assert "jwks must contain a 'keys' array" in str(exc_info.value)

    def test_validate_jwks_keys_not_array(self):
        """Reject document where jwks.keys is not an array."""
        document = {
            "client_id": self.test_url,
            "jwks": {"keys": "not an array"},
        }

        with pytest.raises(CIMDValidationError) as exc_info:
            validate_cimd_document(document, self.test_url)

        assert "jwks must contain a 'keys' array" in str(exc_info.value)

    def test_validate_jwks_valid(self):
        """Accept document with valid jwks structure."""
        document = {
            "client_id": self.test_url,
            "jwks": {
                "keys": [
                    {
                        "kty": "RSA",
                        "use": "sig",
                        "kid": "key-1",
                        "n": "0vx7agoebG...",
                        "e": "AQAB",
                    }
                ]
            },
        }
        # Should not raise
        validate_cimd_document(document, self.test_url)


class CIMDCacheTest(TestCase):
    """Tests for CIMD metadata caching layer."""

    def setUp(self):
        super().setUp()
        self.cache = CIMDCache()
        self.test_url = "https://example.com/oauth/client"
        self.test_metadata = {
            "client_id": self.test_url,
            "client_name": "Test Application",
            "redirect_uris": ["https://example.com/callback"],
        }

    def test_get_cache_key_deterministic(self):
        """Cache key should be deterministic for the same URL."""
        key1 = self.cache.get_cache_key(self.test_url)
        key2 = self.cache.get_cache_key(self.test_url)
        assert key1 == key2

    def test_get_cache_key_unique_for_different_urls(self):
        """Different URLs should produce different cache keys."""
        key1 = self.cache.get_cache_key(self.test_url)
        key2 = self.cache.get_cache_key("https://other.com/client")
        assert key1 != key2

    def test_get_cache_key_format(self):
        """Cache key should have expected prefix."""
        key = self.cache.get_cache_key(self.test_url)
        assert key.startswith("cimd:metadata:")

    def test_set_and_get_metadata(self):
        """Successfully cache and retrieve metadata."""
        self.cache.set(self.test_url, self.test_metadata)
        result = self.cache.get(self.test_url)
        assert result == self.test_metadata

    def test_get_returns_none_for_uncached(self):
        """Return None when metadata is not cached."""
        result = self.cache.get("https://not-cached.com/client")
        assert result is None

    def test_delete_removes_cached_metadata(self):
        """Delete should remove metadata from cache."""
        self.cache.set(self.test_url, self.test_metadata)
        self.cache.delete(self.test_url)
        result = self.cache.get(self.test_url)
        assert result is None

    def test_calculate_ttl_default(self):
        """Use default TTL when no Cache-Control header."""
        ttl = self.cache._calculate_ttl(None)
        assert ttl == CIMDCache.DEFAULT_TTL

    def test_calculate_ttl_from_max_age(self):
        """Parse max-age from Cache-Control header."""
        ttl = self.cache._calculate_ttl("max-age=600")
        assert ttl == 600

    def test_calculate_ttl_from_max_age_with_other_directives(self):
        """Parse max-age even with other Cache-Control directives."""
        ttl = self.cache._calculate_ttl("public, max-age=1800, must-revalidate")
        assert ttl == 1800

    def test_calculate_ttl_enforces_max_bound(self):
        """TTL should not exceed MAX_TTL."""
        ttl = self.cache._calculate_ttl("max-age=999999")
        assert ttl == CIMDCache.MAX_TTL

    def test_calculate_ttl_enforces_min_bound(self):
        """TTL should not be less than MIN_TTL."""
        ttl = self.cache._calculate_ttl("max-age=1")
        assert ttl == CIMDCache.MIN_TTL

    def test_calculate_ttl_handles_zero_max_age(self):
        """Zero max-age should be clamped to MIN_TTL."""
        ttl = self.cache._calculate_ttl("max-age=0")
        assert ttl == CIMDCache.MIN_TTL

    def test_calculate_ttl_handles_non_numeric_max_age(self):
        """Non-numeric max-age should use DEFAULT_TTL (regex won't match)."""
        ttl = self.cache._calculate_ttl("max-age=invalid")
        assert ttl == CIMDCache.DEFAULT_TTL

    def test_calculate_ttl_handles_empty_string(self):
        """Empty string should use DEFAULT_TTL."""
        ttl = self.cache._calculate_ttl("")
        assert ttl == CIMDCache.DEFAULT_TTL

    def test_ttl_bounds_constants(self):
        """Verify TTL bounds are set to expected values."""
        assert CIMDCache.DEFAULT_TTL == 900  # 15 minutes
        assert CIMDCache.MAX_TTL == 3600  # 1 hour
        assert CIMDCache.MIN_TTL == 60  # 1 minute


class CIMDClientCacheIntegrationTest(TestCase):
    """Tests for CIMDClient caching integration."""

    def setUp(self):
        super().setUp()
        self.cache = CIMDCache()
        self.client = CIMDClient(cache=self.cache)
        self.test_url = "https://example.com/oauth/client"
        self.test_metadata = {
            "client_id": self.test_url,
            "client_name": "Test Application",
            "redirect_uris": ["https://example.com/callback"],
        }

    @responses.activate
    def test_fetch_and_validate_caches_valid_metadata(self):
        """Valid metadata should be cached after fetch."""
        responses.add(
            responses.GET,
            self.test_url,
            json=self.test_metadata,
            status=200,
            content_type="application/json",
        )

        self.client.fetch_and_validate(self.test_url)

        # Verify it's in the cache
        cached = self.cache.get(self.test_url)
        assert cached == self.test_metadata

    @responses.activate
    def test_fetch_and_validate_returns_cached_metadata(self):
        """Should return cached metadata without fetching."""
        # Pre-populate cache
        self.cache.set(self.test_url, self.test_metadata)

        # No HTTP responses registered - fetch would fail if attempted
        result = self.client.fetch_and_validate(self.test_url)

        assert result == self.test_metadata
        assert len(responses.calls) == 0

    @responses.activate
    def test_fetch_and_validate_skip_cache_bypasses_cache(self):
        """skip_cache=True should fetch even when cached."""
        # Pre-populate cache with old data
        old_metadata = {
            "client_id": self.test_url,
            "client_name": "Old Name",
        }
        self.cache.set(self.test_url, old_metadata)

        # New data from server
        responses.add(
            responses.GET,
            self.test_url,
            json=self.test_metadata,
            status=200,
            content_type="application/json",
        )

        result = self.client.fetch_and_validate(self.test_url, skip_cache=True)

        assert result == self.test_metadata
        assert len(responses.calls) == 1

    @responses.activate
    def test_fetch_and_validate_respects_cache_control_header(self):
        """Cache TTL should respect Cache-Control header."""
        responses.add(
            responses.GET,
            self.test_url,
            json=self.test_metadata,
            status=200,
            content_type="application/json",
            headers={"Cache-Control": "max-age=1800"},
        )

        with patch.object(self.cache, "set", wraps=self.cache.set) as mock_set:
            self.client.fetch_and_validate(self.test_url)
            mock_set.assert_called_once()
            # Verify the cache_control header was passed
            _, kwargs = mock_set.call_args
            # The third positional arg or cache_control kwarg
            assert "1800" in str(mock_set.call_args)

    @responses.activate
    def test_fetch_and_validate_does_not_cache_on_fetch_error(self):
        """Fetch errors should not result in caching."""
        responses.add(
            responses.GET,
            self.test_url,
            status=500,
        )

        with pytest.raises(CIMDFetchError):
            self.client.fetch_and_validate(self.test_url)

        # Verify nothing was cached
        assert self.cache.get(self.test_url) is None

    @responses.activate
    def test_fetch_and_validate_does_not_cache_on_validation_error(self):
        """Validation errors should not result in caching."""
        invalid_metadata = {
            "client_id": "https://different.com/client",  # Mismatch
            "client_name": "Test",
        }
        responses.add(
            responses.GET,
            self.test_url,
            json=invalid_metadata,
            status=200,
            content_type="application/json",
        )

        with pytest.raises(CIMDValidationError):
            self.client.fetch_and_validate(self.test_url)

        # Verify nothing was cached
        assert self.cache.get(self.test_url) is None

    def test_client_uses_default_cache_when_none_provided(self):
        """CIMDClient should use module-level cache by default."""
        from sentry.oauth.cimd import cimd_cache

        client = CIMDClient()
        assert client._cache is cimd_cache

    def test_client_uses_provided_cache(self):
        """CIMDClient should use provided cache instance."""
        custom_cache = CIMDCache()
        client = CIMDClient(cache=custom_cache)
        assert client._cache is custom_cache
