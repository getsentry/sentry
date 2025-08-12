import hashlib
import hmac
from unittest.mock import patch

import orjson
from django.test import RequestFactory

from sentry.integrations.cursor.webhooks.handler import CursorWebhookEndpoint
from sentry.testutils.cases import APITestCase


class CursorWebhookTest(APITestCase):

    def setUp(self):
        super().setUp()
        self.url = "/extensions/cursor/webhook/"
        self.webhook_endpoint = CursorWebhookEndpoint()
        self.factory = RequestFactory()

    def test_post_valid_payload(self):
        payload = {"event_type": "launch_complete", "session_id": "test_123", "status": "success"}

        with (
            patch(
                "sentry.integrations.cursor.webhooks.handler.CursorWebhookEndpoint._process_webhook"
            ) as mock_process,
            patch(
                "sentry.integrations.cursor.webhooks.handler.CursorWebhookEndpoint._validate_signature",
                return_value=True,
            ),
        ):
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

        with (
            patch(
                "sentry.integrations.cursor.webhooks.handler.CursorWebhookEndpoint._process_webhook"
            ) as mock_process,
            patch(
                "sentry.integrations.cursor.webhooks.handler.CursorWebhookEndpoint._validate_signature",
                return_value=True,
            ),
        ):
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

    def test_webhook_signature_validation_no_signature_no_secret(self):
        """Test webhook passes validation when no signature and no secret configured"""
        request = self.factory.post("/", {}, content_type="application/json")
        request.META = {}
        raw_body = b'{"event": "test"}'

        with patch.object(
            self.webhook_endpoint, "_get_cursor_integration_secret", return_value=None
        ):
            result = self.webhook_endpoint._validate_signature(request, raw_body)

        assert result is True

    def test_webhook_signature_validation_no_signature_with_secret(self):
        """Test webhook fails validation when no signature but secret is configured"""
        request = self.factory.post("/", {}, content_type="application/json")
        request.META = {}
        raw_body = b'{"event": "test"}'

        with patch.object(
            self.webhook_endpoint, "_get_cursor_integration_secret", return_value="test_secret"
        ):
            result = self.webhook_endpoint._validate_signature(request, raw_body)

        assert result is False

    def test_webhook_signature_validation_signature_no_secret(self):
        """Test webhook fails validation when signature provided but no secret configured"""
        request = self.factory.post("/", {}, content_type="application/json")
        request.META = {"HTTP_X_WEBHOOK_SIGNATURE": "sha256=somehash"}
        raw_body = b'{"event": "test"}'

        with patch.object(
            self.webhook_endpoint, "_get_cursor_integration_secret", return_value=None
        ):
            result = self.webhook_endpoint._validate_signature(request, raw_body)

        assert result is False

    def test_webhook_signature_validation_valid_signature(self):
        """Test webhook passes validation with correct signature"""
        secret = "test_secret_key_123"
        raw_body = b'{"event": "test", "data": "payload"}'
        expected_signature = hmac.new(secret.encode("utf-8"), raw_body, hashlib.sha256).hexdigest()

        request = self.factory.post("/", {}, content_type="application/json")
        request.META = {"HTTP_X_WEBHOOK_SIGNATURE": f"sha256={expected_signature}"}

        with patch.object(
            self.webhook_endpoint, "_get_cursor_integration_secret", return_value=secret
        ):
            result = self.webhook_endpoint._validate_signature(request, raw_body)

        assert result is True

    def test_webhook_signature_validation_invalid_signature(self):
        """Test webhook fails validation with incorrect signature"""
        secret = "test_secret_key_123"
        raw_body = b'{"event": "test", "data": "payload"}'
        wrong_signature = "invalid_signature_hash"

        request = self.factory.post("/", {}, content_type="application/json")
        request.META = {"HTTP_X_WEBHOOK_SIGNATURE": f"sha256={wrong_signature}"}

        with patch.object(
            self.webhook_endpoint, "_get_cursor_integration_secret", return_value=secret
        ):
            result = self.webhook_endpoint._validate_signature(request, raw_body)

        assert result is False

    def test_webhook_signature_validation_signature_without_prefix(self):
        """Test webhook works with signature without 'sha256=' prefix"""
        secret = "test_secret_key_123"
        raw_body = b'{"event": "test", "data": "payload"}'
        expected_signature = hmac.new(secret.encode("utf-8"), raw_body, hashlib.sha256).hexdigest()

        request = self.factory.post("/", {}, content_type="application/json")
        request.META = {"HTTP_X_WEBHOOK_SIGNATURE": expected_signature}

        with patch.object(
            self.webhook_endpoint, "_get_cursor_integration_secret", return_value=secret
        ):
            result = self.webhook_endpoint._validate_signature(request, raw_body)

        assert result is True

    @patch("sentry.integrations.cursor.webhooks.handler.integration_service")
    def test_get_cursor_integration_secret_with_organization(self, mock_integration_service):
        """Test integration secret lookup with organization ID"""
        mock_integration = type(
            "MockIntegration",
            (),
            {"provider": "cursor", "metadata": {"webhook_secret": "org_specific_secret"}},
        )()

        mock_integration_service.get_integrations.return_value = [mock_integration]

        result = self.webhook_endpoint._get_cursor_integration_secret(organization_id=123)

        assert result == "org_specific_secret"
        mock_integration_service.get_integrations.assert_called_once_with(
            organization_id=123, providers=["cursor"]
        )

    @patch("sentry.integrations.cursor.webhooks.handler.integration_service")
    def test_get_cursor_integration_secret_fallback_any_org(self, mock_integration_service):
        """Test integration secret lookup fallback to any org when no org specified"""
        mock_integration = type(
            "MockIntegration",
            (),
            {"provider": "cursor", "metadata": {"webhook_secret": "fallback_secret"}},
        )()

        mock_integration_service.get_integrations.return_value = [mock_integration]

        result = self.webhook_endpoint._get_cursor_integration_secret(organization_id=None)

        assert result == "fallback_secret"
        mock_integration_service.get_integrations.assert_called_once_with(providers=["cursor"])

    @patch("sentry.integrations.cursor.webhooks.handler.integration_service")
    def test_get_cursor_integration_secret_no_integrations(self, mock_integration_service):
        """Test integration secret lookup returns None when no integrations found"""
        mock_integration_service.get_integrations.return_value = []

        result = self.webhook_endpoint._get_cursor_integration_secret(organization_id=123)

        assert result is None

    @patch("sentry.integrations.cursor.webhooks.handler.integration_service")
    def test_get_cursor_integration_secret_no_webhook_secret(self, mock_integration_service):
        """Test integration secret lookup returns None when integration has no webhook_secret"""
        mock_integration = type(
            "MockIntegration",
            (),
            {"provider": "cursor", "metadata": {"api_key": "some_key"}},  # No webhook_secret
        )()

        mock_integration_service.get_integrations.return_value = [mock_integration]

        result = self.webhook_endpoint._get_cursor_integration_secret(organization_id=123)

        assert result is None
