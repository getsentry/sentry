import signal
import time
from unittest.mock import Mock, patch

import pytest
from requests import Response

from sentry.sentry_apps.api.serializers.app_platform_event import AppPlatformEvent
from sentry.sentry_apps.metrics import SentryAppWebhookHaltReason
from sentry.testutils.cases import TestCase
from sentry.testutils.silo import region_silo_test
from sentry.utils.sentry_apps.webhooks import WebhookTimeoutError, send_and_save_webhook_request


@region_silo_test
class WebhookTimeoutTest(TestCase):
    def setUp(self):
        self.organization = self.create_organization()
        self.sentry_app = self.create_sentry_app(
            name="TestApp",
            organization=self.organization,
            webhook_url="https://example.com/webhook",
        )
        self.install = self.create_sentry_app_installation(
            organization=self.organization, slug=self.sentry_app.slug
        )

    @patch("sentry.utils.sentry_apps.webhooks.safe_urlopen")
    @patch("sentry.utils.sentry_apps.webhooks.options.get")
    def test_webhook_completes_before_timeout(self, mock_options, mock_safe_urlopen):
        """Test that webhook completes successfully when it finishes before timeout"""

        # Configure timeouts
        def options_side_effect(key):
            if key == "sentry-apps.webhook.hard-timeout.sec":
                return 3.0
            elif key == "sentry-apps.webhook.timeout.sec":
                return 1.0
            elif key == "sentry-apps.webhook.restricted-webhook-sending":
                return []
            elif key == "sentry-apps.webhook-logging.enabled":
                return {"installation_uuid": [], "sentry_app_slug": []}
            return None

        mock_options.side_effect = options_side_effect

        # Mock successful response
        mock_response = Mock(spec=Response)
        mock_response.status_code = 200
        mock_response.headers = {}
        mock_safe_urlopen.return_value = mock_response

        # Create event
        app_platform_event = AppPlatformEvent(
            resource="issue", action="created", install=self.install, data={"test": "data"}
        )

        # Should complete without raising WebhookTimeoutError
        response = send_and_save_webhook_request(self.sentry_app, app_platform_event)

        assert response == mock_response
        mock_safe_urlopen.assert_called_once()

    @patch("sentry.utils.sentry_apps.webhooks.safe_urlopen")
    @patch("sentry.utils.sentry_apps.webhooks.options.get")
    def test_webhook_interrupted_by_hard_timeout(self, mock_options, mock_safe_urlopen):
        """Test that webhook is interrupted when it exceeds hard timeout"""

        # Configure timeouts
        def options_side_effect(key):
            if key == "sentry-apps.webhook.hard-timeout.sec":
                return 1.0  # 1 second hard timeout
            elif key == "sentry-apps.webhook.timeout.sec":
                return 10.0
            elif key == "sentry-apps.webhook.restricted-webhook-sending":
                return []
            elif key == "sentry-apps.webhook-logging.enabled":
                return {"installation_uuid": [], "sentry_app_slug": []}
            return None

        mock_options.side_effect = options_side_effect

        # Make safe_urlopen sleep longer than the timeout
        def slow_urlopen(*args, **kwargs):
            time.sleep(2.0)  # Sleep longer than 1 second timeout
            mock_response = Mock(spec=Response)
            mock_response.status_code = 200
            return mock_response

        mock_safe_urlopen.side_effect = slow_urlopen

        # Create event
        app_platform_event = AppPlatformEvent(
            resource="issue", action="created", install=self.install, data={"test": "data"}
        )

        # Should raise WebhookTimeoutError
        with pytest.raises(WebhookTimeoutError, match="Webhook request exceeded hard timeout"):
            send_and_save_webhook_request(self.sentry_app, app_platform_event)

    @patch("sentry.utils.sentry_apps.webhooks.safe_urlopen")
    @patch("sentry.utils.sentry_apps.webhooks.options.get")
    def test_timeout_exception_propagates(self, mock_options, mock_safe_urlopen):
        """Test that WebhookTimeoutError propagates correctly"""

        def options_side_effect(key):
            if key == "sentry-apps.webhook.hard-timeout.sec":
                return 1.0
            elif key == "sentry-apps.webhook.timeout.sec":
                return 10.0
            elif key == "sentry-apps.webhook.restricted-webhook-sending":
                return []
            return None

        mock_options.side_effect = options_side_effect

        # Make safe_urlopen sleep
        def slow_urlopen(*args, **kwargs):
            time.sleep(2.0)
            return Mock(spec=Response)

        mock_safe_urlopen.side_effect = slow_urlopen

        app_platform_event = AppPlatformEvent(
            resource="issue", action="created", install=self.install, data={"test": "data"}
        )

        # Verify exception type and inheritance
        with pytest.raises(BaseException):  # WebhookTimeoutError inherits from BaseException
            send_and_save_webhook_request(self.sentry_app, app_platform_event)

        with pytest.raises(WebhookTimeoutError):
            send_and_save_webhook_request(self.sentry_app, app_platform_event)

    @patch("sentry.utils.sentry_apps.webhooks.safe_urlopen")
    @patch("sentry.utils.sentry_apps.webhooks.options.get")
    @patch("sentry.sentry_apps.metrics.SentryAppInteractionEvent")
    def test_lifecycle_record_halt_called_on_timeout(
        self, mock_interaction_event, mock_options, mock_safe_urlopen
    ):
        """Test that lifecycle.record_halt() is called when timeout occurs"""

        def options_side_effect(key):
            if key == "sentry-apps.webhook.hard-timeout.sec":
                return 1.0
            elif key == "sentry-apps.webhook.timeout.sec":
                return 10.0
            elif key == "sentry-apps.webhook.restricted-webhook-sending":
                return []
            return None

        mock_options.side_effect = options_side_effect

        # Setup mock lifecycle
        mock_lifecycle = Mock()
        mock_interaction_event.return_value.capture.return_value.__enter__.return_value = (
            mock_lifecycle
        )

        # Make safe_urlopen sleep
        def slow_urlopen(*args, **kwargs):
            time.sleep(2.0)
            return Mock(spec=Response)

        mock_safe_urlopen.side_effect = slow_urlopen

        app_platform_event = AppPlatformEvent(
            resource="issue", action="created", install=self.install, data={"test": "data"}
        )

        # Should raise WebhookTimeoutError
        with pytest.raises(WebhookTimeoutError):
            send_and_save_webhook_request(self.sentry_app, app_platform_event)

        # Verify lifecycle.record_halt() was called with correct halt reason
        mock_lifecycle.record_halt.assert_called_once()
        halt_reason = mock_lifecycle.record_halt.call_args[1]["halt_reason"]
        assert SentryAppWebhookHaltReason.HARD_TIMEOUT in halt_reason

    @patch("sentry.utils.sentry_apps.webhooks.safe_urlopen")
    @patch("sentry.utils.sentry_apps.webhooks.options.get")
    def test_timeout_alarm_restores_signal_handler(self, mock_options, mock_safe_urlopen):
        """Test that signal handler is properly restored after timeout"""

        def options_side_effect(key):
            if key == "sentry-apps.webhook.hard-timeout.sec":
                return 1.0
            elif key == "sentry-apps.webhook.timeout.sec":
                return 10.0
            elif key == "sentry-apps.webhook.restricted-webhook-sending":
                return []
            elif key == "sentry-apps.webhook-logging.enabled":
                return {"installation_uuid": [], "sentry_app_slug": []}
            return None

        mock_options.side_effect = options_side_effect

        # Get original handler
        original_handler = signal.signal(signal.SIGALRM, signal.SIG_DFL)
        signal.signal(signal.SIGALRM, original_handler)

        # Mock quick response
        mock_response = Mock(spec=Response)
        mock_response.status_code = 200
        mock_response.headers = {}
        mock_safe_urlopen.return_value = mock_response

        app_platform_event = AppPlatformEvent(
            resource="issue", action="created", install=self.install, data={"test": "data"}
        )

        send_and_save_webhook_request(self.sentry_app, app_platform_event)

        # Verify signal handler was restored
        current_handler = signal.signal(signal.SIGALRM, signal.SIG_DFL)
        signal.signal(signal.SIGALRM, current_handler)
        assert current_handler == original_handler

    @patch("sentry.utils.sentry_apps.webhooks.safe_urlopen")
    @patch("sentry.utils.sentry_apps.webhooks.options.get")
    def test_alarm_cancelled_after_successful_webhook(self, mock_options, mock_safe_urlopen):
        """Test that alarm is cancelled after webhook completes successfully"""

        def options_side_effect(key):
            if key == "sentry-apps.webhook.hard-timeout.sec":
                return 5.0
            elif key == "sentry-apps.webhook.timeout.sec":
                return 1.0
            elif key == "sentry-apps.webhook.restricted-webhook-sending":
                return []
            elif key == "sentry-apps.webhook-logging.enabled":
                return {"installation_uuid": [], "sentry_app_slug": []}
            return None

        mock_options.side_effect = options_side_effect

        mock_response = Mock(spec=Response)
        mock_response.status_code = 200
        mock_response.headers = {}
        mock_safe_urlopen.return_value = mock_response

        app_platform_event = AppPlatformEvent(
            resource="issue", action="created", install=self.install, data={"test": "data"}
        )

        send_and_save_webhook_request(self.sentry_app, app_platform_event)

        # Verify no alarm is pending
        remaining = signal.alarm(0)
        assert remaining == 0  # No alarm was pending
