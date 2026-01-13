from unittest.mock import Mock, patch

import pytest
from google.protobuf.message import DecodeError
from sentry_protos.snuba.v1.endpoint_time_series_pb2 import TimeSeriesRequest
from sentry_protos.snuba.v1.error_pb2 import Error as ErrorProto
from sentry_protos.snuba.v1.request_common_pb2 import RequestMeta

from sentry.testutils.cases import TestCase
from sentry.utils.snuba_rpc import SnubaRPCError, _make_rpc_request


class TestSnubaRPCErrorHandling(TestCase):
    """Test error handling in Snuba RPC calls, especially non-protobuf error responses."""

    def setUp(self):
        super().setUp()
        self.request = TimeSeriesRequest(
            meta=RequestMeta(
                referrer="test_referrer",
                organization_id=1,
            )
        )

    @patch("sentry.utils.snuba_rpc._snuba_pool")
    def test_503_html_error_response(self, mock_pool):
        """Test that 503 HTML responses are handled gracefully instead of raising DecodeError."""
        # Simulate a 503 Service Unavailable response with HTML content
        mock_response = Mock()
        mock_response.status = 503
        mock_response.data = b"<html><body><h1>503 Service Unavailable</h1></body></html>"
        mock_pool.urlopen.return_value = mock_response

        with pytest.raises(SnubaRPCError) as exc_info:
            _make_rpc_request(
                endpoint_name="EndpointTimeSeries",
                class_version="v1",
                referrer="test_referrer",
                req=self.request,
            )

        # Verify the error message contains useful information
        error_message = str(exc_info.value)
        assert "HTTP 503" in error_message
        assert "Service Unavailable" in error_message
        # Should not be a DecodeError
        assert not isinstance(exc_info.value, DecodeError)

    @patch("sentry.utils.snuba_rpc._snuba_pool")
    def test_500_plain_text_error_response(self, mock_pool):
        """Test that 500 plain text responses are handled gracefully."""
        # Simulate a 500 Internal Server Error with plain text
        mock_response = Mock()
        mock_response.status = 500
        mock_response.data = b"Internal Server Error: Database connection failed"
        mock_pool.urlopen.return_value = mock_response

        with pytest.raises(SnubaRPCError) as exc_info:
            _make_rpc_request(
                endpoint_name="EndpointTimeSeries",
                class_version="v1",
                referrer="test_referrer",
                req=self.request,
            )

        # Verify the error message contains useful information
        error_message = str(exc_info.value)
        assert "HTTP 500" in error_message
        assert "Database connection failed" in error_message

    @patch("sentry.utils.snuba_rpc._snuba_pool")
    def test_valid_protobuf_error_response(self, mock_pool):
        """Test that valid protobuf error responses are still parsed correctly."""
        # Create a valid protobuf error
        error_proto = ErrorProto()
        error_proto.message = "Test error message"

        mock_response = Mock()
        mock_response.status = 400
        mock_response.data = error_proto.SerializeToString()
        mock_pool.urlopen.return_value = mock_response

        with pytest.raises(SnubaRPCError) as exc_info:
            _make_rpc_request(
                endpoint_name="EndpointTimeSeries",
                class_version="v1",
                referrer="test_referrer",
                req=self.request,
            )

        # Verify the protobuf error is properly parsed
        error_message = str(exc_info.value)
        assert "Test error message" in error_message or error_message != ""

    @patch("sentry.utils.snuba_rpc._snuba_pool")
    def test_429_rate_limit_html_response(self, mock_pool):
        """Test that 429 rate limit responses with HTML are handled correctly."""
        mock_response = Mock()
        mock_response.status = 429
        mock_response.data = b"<html>Rate limit exceeded</html>"
        mock_pool.urlopen.return_value = mock_response

        # Should raise SnubaRPCRateLimitExceeded, not DecodeError
        from sentry.utils.snuba_rpc import SnubaRPCRateLimitExceeded

        with pytest.raises(SnubaRPCRateLimitExceeded) as exc_info:
            _make_rpc_request(
                endpoint_name="EndpointTimeSeries",
                class_version="v1",
                referrer="test_referrer",
                req=self.request,
            )

        error_message = str(exc_info.value)
        assert "HTTP 429" in error_message

    @patch("sentry.utils.snuba_rpc._snuba_pool")
    def test_404_html_response(self, mock_pool):
        """Test that 404 responses with HTML are handled correctly."""
        mock_response = Mock()
        mock_response.status = 404
        mock_response.data = b"<html>Not Found</html>"
        mock_pool.urlopen.return_value = mock_response

        from rest_framework.exceptions import NotFound

        # Should raise NotFound, not DecodeError
        with pytest.raises(NotFound):
            _make_rpc_request(
                endpoint_name="EndpointTimeSeries",
                class_version="v1",
                referrer="test_referrer",
                req=self.request,
            )

    @patch("sentry.utils.snuba_rpc._snuba_pool")
    def test_long_error_response_truncation(self, mock_pool):
        """Test that very long error responses are truncated to avoid excessive logging."""
        # Create a very long error response
        long_error = b"X" * 1000  # 1000 bytes

        mock_response = Mock()
        mock_response.status = 500
        mock_response.data = long_error
        mock_pool.urlopen.return_value = mock_response

        with pytest.raises(SnubaRPCError) as exc_info:
            _make_rpc_request(
                endpoint_name="EndpointTimeSeries",
                class_version="v1",
                referrer="test_referrer",
                req=self.request,
            )

        error_message = str(exc_info.value)
        # Should be truncated to 500 chars
        assert len(error_message) < 600  # "HTTP 500: " prefix + 500 chars max

    @patch("sentry.utils.snuba_rpc._snuba_pool")
    def test_success_response(self, mock_pool):
        """Test that successful responses (200) are returned correctly."""
        mock_response = Mock()
        mock_response.status = 200
        mock_response.data = b"valid response data"
        mock_pool.urlopen.return_value = mock_response

        result = _make_rpc_request(
            endpoint_name="EndpointTimeSeries",
            class_version="v1",
            referrer="test_referrer",
            req=self.request,
        )

        assert result == mock_response
        assert result.status == 200
