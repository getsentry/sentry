import signal
import time
from unittest.mock import Mock, patch

import pytest
from requests import Response

from sentry.sentry_apps.api.serializers.app_platform_event import AppPlatformEvent
from sentry.sentry_apps.metrics import SentryAppWebhookHaltReason
from sentry.testutils.asserts import assert_halt_metric
from sentry.testutils.cases import TestCase
from sentry.testutils.helpers.features import with_feature
from sentry.testutils.helpers.options import override_options
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

    @with_feature("organizations:sentry-app-webhook-hard-timeout")
    @override_options(
        {
            "sentry-apps.webhook.hard-timeout.sec": 5.0,
            "sentry-apps.webhook.timeout.sec": 1.0,
            "sentry-apps.webhook.restricted-webhook-sending": [],
            "sentry-apps.webhook-logging.enabled": {"installation_uuid": [], "sentry_app_slug": []},
        }
    )
    @patch("sentry.utils.sentry_apps.webhooks.safe_urlopen")
    def test_webhook_completes_before_timeout(self, mock_safe_urlopen):
        # Mock successful response
        mock_response = Mock(spec=Response)
        mock_response.status_code = 200
        mock_response.headers = {}
        mock_safe_urlopen.return_value = mock_response

        app_platform_event = AppPlatformEvent(
            resource="issue", action="created", install=self.install, data={"test": "data"}
        )

        # Should complete without raising WebhookTimeoutError
        response = send_and_save_webhook_request(self.sentry_app, app_platform_event)

        assert response == mock_response
        mock_safe_urlopen.assert_called_once()

    @with_feature("organizations:sentry-app-webhook-hard-timeout")
    @override_options(
        {
            "sentry-apps.webhook.hard-timeout.sec": 1.0,
            "sentry-apps.webhook.timeout.sec": 10.0,
            "sentry-apps.webhook.restricted-webhook-sending": [],
            "sentry-apps.webhook-logging.enabled": {"installation_uuid": [], "sentry_app_slug": []},
        }
    )
    @patch("sentry.utils.sentry_apps.webhooks.safe_urlopen")
    def test_webhook_interrupted_by_hard_timeout(self, mock_safe_urlopen):
        # Make safe_urlopen sleep longer than the timeout
        def slow_urlopen(*args, **kwargs):
            time.sleep(6.0)  # Sleep longer than 1 second timeout
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

    @with_feature("organizations:sentry-app-webhook-hard-timeout")
    @override_options(
        {
            "sentry-apps.webhook.hard-timeout.sec": 1.0,
            "sentry-apps.webhook.timeout.sec": 10.0,
            "sentry-apps.webhook.restricted-webhook-sending": [],
        }
    )
    @patch("sentry.utils.sentry_apps.webhooks.safe_urlopen")
    def test_timeout_exception_propagates(self, mock_safe_urlopen):
        # Make safe_urlopen sleep
        def slow_urlopen(*args, **kwargs):
            time.sleep(2.0)
            return Mock(spec=Response)

        mock_safe_urlopen.side_effect = slow_urlopen

        app_platform_event = AppPlatformEvent(
            resource="issue", action="created", install=self.install, data={"test": "data"}
        )

        with pytest.raises(WebhookTimeoutError):
            send_and_save_webhook_request(self.sentry_app, app_platform_event)

    @with_feature("organizations:sentry-app-webhook-hard-timeout")
    @override_options(
        {
            "sentry-apps.webhook.hard-timeout.sec": 1.0,
            "sentry-apps.webhook.timeout.sec": 10.0,
            "sentry-apps.webhook.restricted-webhook-sending": [],
        }
    )
    @patch("sentry.utils.sentry_apps.webhooks.safe_urlopen")
    @patch("sentry.integrations.utils.metrics.EventLifecycle.record_event")
    def test_lifecycle_record_halt_called_on_timeout(self, mock_record, mock_safe_urlopen):
        # Make safe_urlopen sleep
        def slow_urlopen(*args, **kwargs):
            time.sleep(2.0)
            return Mock(spec=Response)

        mock_safe_urlopen.side_effect = slow_urlopen

        app_platform_event = AppPlatformEvent(
            resource="issue", action="created", install=self.install, data={"test": "data"}
        )

        with pytest.raises(WebhookTimeoutError):
            send_and_save_webhook_request(self.sentry_app, app_platform_event)

        assert_halt_metric(
            mock_record=mock_record,
            error_msg=f"send_and_save_webhook_request.{SentryAppWebhookHaltReason.HARD_TIMEOUT}",
        )

    @with_feature("organizations:sentry-app-webhook-hard-timeout")
    @override_options(
        {
            "sentry-apps.webhook.hard-timeout.sec": 5.0,
            "sentry-apps.webhook.timeout.sec": 10.0,
            "sentry-apps.webhook.restricted-webhook-sending": [],
            "sentry-apps.webhook-logging.enabled": {"installation_uuid": [], "sentry_app_slug": []},
        }
    )
    @patch("sentry.utils.sentry_apps.webhooks.safe_urlopen")
    def test_timeout_alarm_restores_signal_handler(self, mock_safe_urlopen):
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

    @with_feature("organizations:sentry-app-webhook-hard-timeout")
    @override_options(
        {
            "sentry-apps.webhook.hard-timeout.sec": 5.0,
            "sentry-apps.webhook.timeout.sec": 1.0,
            "sentry-apps.webhook.restricted-webhook-sending": [],
            "sentry-apps.webhook-logging.enabled": {"installation_uuid": [], "sentry_app_slug": []},
        }
    )
    @patch("sentry.utils.sentry_apps.webhooks.safe_urlopen")
    def test_alarm_cancelled_after_successful_webhook(self, mock_safe_urlopen):
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
