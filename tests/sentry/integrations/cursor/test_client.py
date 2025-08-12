from unittest.mock import MagicMock, patch

import pytest

from sentry.integrations.cursor.client import CursorAgentClient
from sentry.testutils.cases import TestCase


class CursorClientTest(TestCase):

    def setUp(self):
        self.integration = MagicMock()
        self.client = CursorAgentClient(integration=self.integration, api_key="test_api_key_123")

    @patch("sentry.integrations.cursor.client.CursorAgentClient._request")
    def test_request_adds_auth_headers(self, mock_request):
        mock_request.return_value = {"success": True}

        result = self.client.request("GET", "/test")

        mock_request.assert_called_once_with(
            "GET",
            "https://api.cursor.sh/v1/test",
            headers={
                "Authorization": "Bearer test_api_key_123",
                "Content-Type": "application/json",
            },
        )

        assert result == {"success": True}

    @patch("sentry.integrations.cursor.client.CursorAgentClient.request")
    def test_launch(self, mock_request):
        mock_request.return_value = {"status": "launched"}

        webhook_url = "https://sentry.io/webhook"
        result = self.client.launch(
            webhook_url=webhook_url, context={"event": "test"}, project_id=123
        )

        mock_request.assert_called_once_with(
            "POST",
            "/launch",
            json={"webhook_url": webhook_url, "context": {"event": "test"}, "project_id": 123},
        )

        assert result == {"status": "launched"}

    @patch("sentry.integrations.cursor.client.CursorAgentClient._request")
    def test_request_handles_exceptions(self, mock_request):
        mock_request.side_effect = Exception("API Error")

        with pytest.raises(Exception, match="API Error"):
            self.client.request("GET", "/test")
