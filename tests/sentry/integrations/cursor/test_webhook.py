from unittest.mock import patch

import orjson

from sentry.integrations.cursor.webhooks.handler import CursorWebhookEndpoint
from sentry.testutils.cases import APITestCase


class CursorWebhookTest(APITestCase):

    def setUp(self):
        self.url = "/extensions/cursor/webhook/"
        self.webhook_endpoint = CursorWebhookEndpoint()

    def test_post_valid_payload(self):
        payload = {"event_type": "launch_complete", "session_id": "test_123", "status": "success"}

        with patch.object(self.webhook_endpoint, "_process_webhook") as mock_process:
            response = self.client.post(
                self.url, data=orjson.dumps(payload), content_type="application/json"
            )

        assert response.status_code == 204
        mock_process.assert_called_once_with(payload)

    def test_post_invalid_json(self):
        response = self.client.post(self.url, data="invalid json", content_type="application/json")

        assert response.status_code == 400

    def test_post_missing_event_type(self):
        payload = {"session_id": "test_123", "status": "success"}

        with patch.object(self.webhook_endpoint, "_process_webhook") as mock_process:
            response = self.client.post(
                self.url, data=orjson.dumps(payload), content_type="application/json"
            )

        assert response.status_code == 204
        mock_process.assert_called_once_with(payload)

    def test_get_method_not_allowed(self):
        response = self.client.get(self.url)
        assert response.status_code == 405

    @patch("sentry.integrations.cursor.webhooks.handler.logger")
    def test_process_webhook_launch_complete(self, mock_logger):
        payload = {"event_type": "launch_complete", "session_id": "test_123", "status": "success"}

        self.webhook_endpoint._process_webhook(payload)

        mock_logger.info.assert_called_with("cursor_webhook.launch_complete", extra=payload)

    @patch("sentry.integrations.cursor.webhooks.handler.logger")
    def test_process_webhook_session_result(self, mock_logger):
        payload = {
            "event_type": "session_result",
            "session_id": "test_123",
            "results": {"files_modified": 3},
        }

        self.webhook_endpoint._process_webhook(payload)

        mock_logger.info.assert_called_with("cursor_webhook.session_result", extra=payload)

    @patch("sentry.integrations.cursor.webhooks.handler.logger")
    def test_process_webhook_unknown_event(self, mock_logger):
        payload = {"event_type": "unknown_event", "data": "test"}

        self.webhook_endpoint._process_webhook(payload)

        mock_logger.warning.assert_called_with("cursor_webhook.unknown_event", extra=payload)
