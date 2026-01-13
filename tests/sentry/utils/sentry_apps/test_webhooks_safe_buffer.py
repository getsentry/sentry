from unittest.mock import Mock, patch

import pytest
from requests.models import Response

from sentry.sentry_apps.api.serializers.app_platform_event import AppPlatformEvent
from sentry.testutils.cases import TestCase
from sentry.testutils.silo import region_silo_test
from sentry.utils.sentry_apps.webhooks import _safe_add_request_to_buffer


@region_silo_test
class TestSafeAddRequestToBuffer(TestCase):
    def setUp(self) -> None:
        self.sentry_app = self.create_sentry_app(
            name="Test App", events=["error.created", "issue.created"]
        )
        self.organization = self.create_organization()
        self.project = self.create_project(organization=self.organization)

    def test_safe_add_request_to_buffer_success(self) -> None:
        """Test that _safe_add_request_to_buffer successfully adds request when no errors occur."""
        from sentry.utils.sentry_apps import SentryAppWebhookRequestsBuffer

        buffer = SentryAppWebhookRequestsBuffer(self.sentry_app)

        # Should not raise any exception
        _safe_add_request_to_buffer(
            buffer,
            response_code=200,
            org_id=self.organization.id,
            event="error.created",
            url="https://example.com/webhook",
        )

        # Verify request was added
        requests = buffer.get_requests()
        assert len(requests) == 1
        assert requests[0]["response_code"] == 200
        assert requests[0]["organization_id"] == self.organization.id

    @patch("sentry.utils.sentry_apps.webhooks.logger")
    def test_safe_add_request_to_buffer_handles_redis_error(self, mock_logger: Mock) -> None:
        """Test that _safe_add_request_to_buffer handles Redis errors gracefully."""
        from sentry.utils.sentry_apps import SentryAppWebhookRequestsBuffer

        buffer = SentryAppWebhookRequestsBuffer(self.sentry_app)

        # Mock the add_request method to raise an exception
        with patch.object(buffer, "add_request", side_effect=Exception("Redis cluster timeout")):
            # Should not raise exception
            _safe_add_request_to_buffer(
                buffer,
                response_code=200,
                org_id=self.organization.id,
                event="error.created",
                url="https://example.com/webhook",
            )

        # Verify warning was logged
        mock_logger.warning.assert_called_once()
        call_args = mock_logger.warning.call_args
        assert call_args[0][0] == "sentry_app.webhook.buffer_add_request_failed"
        assert "Redis cluster timeout" in call_args[1]["extra"]["error"]
        assert call_args[1]["extra"]["error_type"] == "Exception"
        assert call_args[1]["extra"]["event"] == "error.created"
        assert call_args[1]["extra"]["org_id"] == self.organization.id
        assert call_args[1]["extra"]["response_code"] == 200

    @patch("sentry.utils.sentry_apps.webhooks.logger")
    def test_safe_add_request_to_buffer_handles_processing_deadline_exceeded(
        self, mock_logger: Mock
    ) -> None:
        """Test that _safe_add_request_to_buffer handles ProcessingDeadlineExceeded errors."""
        from sentry.taskworker.workerchild import ProcessingDeadlineExceeded
        from sentry.utils.sentry_apps import SentryAppWebhookRequestsBuffer

        buffer = SentryAppWebhookRequestsBuffer(self.sentry_app)

        # Mock the add_request method to raise ProcessingDeadlineExceeded
        with patch.object(
            buffer,
            "add_request",
            side_effect=ProcessingDeadlineExceeded("execution deadline exceeded"),
        ):
            # Should not raise exception
            _safe_add_request_to_buffer(
                buffer,
                response_code=200,
                org_id=self.organization.id,
                event="error.created",
                url="https://example.com/webhook",
            )

        # Verify warning was logged
        mock_logger.warning.assert_called_once()
        call_args = mock_logger.warning.call_args
        assert call_args[0][0] == "sentry_app.webhook.buffer_add_request_failed"
        assert "execution deadline exceeded" in call_args[1]["extra"]["error"]
        assert call_args[1]["extra"]["error_type"] == "ProcessingDeadlineExceeded"

    @patch("sentry.utils.sentry_apps.webhooks.safe_urlopen")
    @patch("sentry.utils.sentry_apps.webhooks.logger")
    def test_send_and_save_webhook_request_continues_on_buffer_error(
        self, mock_logger: Mock, mock_safe_urlopen: Mock
    ) -> None:
        """Test that send_and_save_webhook_request completes successfully even if buffer fails."""
        from sentry.sentry_apps.api.serializers.app_platform_event import AppPlatformEvent
        from sentry.utils.sentry_apps.webhooks import send_and_save_webhook_request

        # Create installation
        installation = self.create_sentry_app_installation(
            organization=self.organization, slug=self.sentry_app.slug
        )

        # Mock successful HTTP response
        mock_response = Mock(spec=Response)
        mock_response.status_code = 200
        mock_response.headers = {}
        mock_response.request = Mock()
        mock_safe_urlopen.return_value = mock_response

        # Create app platform event
        event_data = {"error": {"event_id": "test123"}}
        app_event = AppPlatformEvent(
            resource="error", action="created", install=installation, data=event_data
        )

        # Mock buffer.add_request to raise an exception
        with patch(
            "sentry.utils.sentry_apps.SentryAppWebhookRequestsBuffer.add_request",
            side_effect=Exception("Redis error"),
        ):
            # Should not raise exception - webhook was sent successfully
            response = send_and_save_webhook_request(
                self.sentry_app, app_event, "https://example.com/webhook"
            )

        # Verify webhook was sent
        assert response.status_code == 200
        mock_safe_urlopen.assert_called_once()

        # Verify warning was logged about buffer failure
        assert any(
            call[0][0] == "sentry_app.webhook.buffer_add_request_failed"
            for call in mock_logger.warning.call_args_list
        )
