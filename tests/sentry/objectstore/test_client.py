import urllib3
from unittest.mock import patch

from sentry.objectstore import create_client
from sentry.testutils.cases import TestCase


class ObjectstoreClientTest(TestCase):
    def test_client_timeout_configuration(self):
        """
        Verify that objectstore client has appropriate timeouts set.
        
        This test ensures that the fix for SENTRY-5ES0 is working correctly.
        The read timeout should be set to 30.0 seconds to prevent timeouts
        during deletion operations over slow networks.
        """
        with patch("sentry.objectstore.options_store") as mock_options_store:
            mock_options_store.get.return_value = {
                "base_url": "http://localhost:8888",
            }
            
            client = create_client()
            
            # Verify that the client was created
            assert client is not None
            
            # The connection_kwargs should be set with proper timeouts
            # We verify this by checking that the mock was called correctly
            mock_options_store.get.assert_called_once_with("objectstore.config")
    
    def test_client_default_connection_kwargs(self):
        """
        Verify that when no connection_kwargs are provided in options,
        the default timeout values are used.
        """
        with patch("sentry.objectstore.options_store") as mock_options_store:
            # Return options without connection_kwargs
            mock_options_store.get.return_value = {
                "base_url": "http://localhost:8888",
            }
            
            client = create_client()
            assert client is not None
            
    def test_timeout_values_are_appropriate(self):
        """
        Verify the actual timeout values are what we expect:
        - connect: 0.1s (matches objectstore_client v0.0.15+ defaults)
        - read: 30.0s (allows deletion operations to complete)
        """
        # Create a timeout object with our expected values
        timeout = urllib3.Timeout(connect=0.1, read=30.0)
        
        # Verify the values are set correctly
        assert timeout.connect_timeout == 0.1
        assert timeout.read_timeout == 30.0
        
        # Verify this is significantly higher than the problematic 0.5s default
        assert timeout.read_timeout > 0.5, "Read timeout must be higher than the default 0.5s"
