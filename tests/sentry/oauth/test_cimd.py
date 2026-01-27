from __future__ import annotations

from unittest.mock import patch

import pytest
import responses
from requests.exceptions import ConnectionError as RequestsConnectionError
from requests.exceptions import Timeout

from sentry.exceptions import RestrictedIPAddress
from sentry.oauth.cimd import CIMDClient, CIMDFetchError
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
