import urllib3
from unittest.mock import patch

from sentry.objectstore import create_client
from sentry.testutils.cases import TestCase


class ObjectstoreClientTest(TestCase):
    @patch("sentry.objectstore.Client")
    def test_client_timeout_configuration(self, mock_client):
        """Test that objectstore client has both connect and read timeouts set"""
        with self.options(
            {
                "objectstore.config": {
                    "base_url": "http://test-objectstore:8080",
                }
            }
        ):
            create_client()

            # Verify Client was instantiated with correct timeout settings
            mock_client.assert_called_once()
            call_kwargs = mock_client.call_args[1]

            # Check that connection_kwargs contains timeout
            assert "connection_kwargs" in call_kwargs
            timeout = call_kwargs["connection_kwargs"]["timeout"]

            # Verify it's a urllib3.Timeout object
            assert isinstance(timeout, urllib3.Timeout)

            # Verify both connect and read timeouts are set
            assert timeout.connect_timeout == 0.1, "Connect timeout should be 0.1s"
            assert timeout.read_timeout == 5.0, "Read timeout should be 5.0s"
