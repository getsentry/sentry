from unittest.mock import Mock, patch

import pytest
from requests import Response
from requests.exceptions import Timeout

from sentry.sentry_apps.api.serializers.app_platform_event import AppPlatformEvent
from sentry.sentry_apps.utils.webhooks import IssueActionType, SentryAppResourceType
from sentry.testutils.cases import TestCase
from sentry.testutils.helpers.features import with_feature
from sentry.testutils.helpers.options import override_options
from sentry.testutils.silo import cell_silo_test
from sentry.utils.sentry_apps.webhooks import send_and_save_webhook_request

CIRCUIT_BREAKER_OPTIONS = {
    "sentry-apps.webhook.circuit-breaker.config": {
        "error_limit_window": 600,
        "broken_state_duration": 300,
        "threshold": 0.5,
        "floor": 5,  # low floor for testing
    },
    "sentry-apps.webhook.circuit-breaker.dry-run": False,
    "sentry-apps.webhook.timeout.sec": 1.0,
    "sentry-apps.webhook.restricted-webhook-sending": [],
}


@cell_silo_test
class WebhookCircuitBreakerTest(TestCase):
    def setUp(self):
        self.organization = self.create_organization()
        self.sentry_app = self.create_sentry_app(
            name="TestApp",
            organization=self.organization,
            webhook_url="https://example.com/webhook",
            published=True,
        )
        self.install = self.create_sentry_app_installation(
            organization=self.organization, slug=self.sentry_app.slug
        )

    def _make_event(self):
        return AppPlatformEvent(
            resource=SentryAppResourceType.ISSUE,
            action=IssueActionType.CREATED,
            install=self.install,
            data={"test": "data"},
        )

    @override_options(CIRCUIT_BREAKER_OPTIONS)
    @patch("sentry.utils.sentry_apps.webhooks.safe_urlopen")
    def test_no_circuit_breaker_without_feature_flag(self, mock_safe_urlopen):
        """Without feature flag, no circuit breaker is instantiated."""
        mock_response = Mock(spec=Response)
        mock_response.status_code = 200
        mock_response.headers = {}
        mock_safe_urlopen.return_value = mock_response

        response = send_and_save_webhook_request(self.sentry_app, self._make_event())
        assert response is not None
        assert response.status_code == 200

    @with_feature("organizations:sentry-app-webhook-circuit-breaker")
    @override_options(
        {**CIRCUIT_BREAKER_OPTIONS, "sentry-apps.webhook.circuit-breaker.dry-run": True}
    )
    @patch("sentry.utils.sentry_apps.webhooks.safe_urlopen")
    @patch("sentry.utils.sentry_apps.webhooks.CircuitBreaker")
    def test_dry_run_emits_metric_but_sends_webhook(self, MockBreaker, mock_safe_urlopen):
        """In dry-run mode, a broken circuit emits would_block but still sends."""
        mock_breaker_instance = MockBreaker.return_value
        mock_breaker_instance.should_allow_request.return_value = False

        mock_response = Mock(spec=Response)
        mock_response.status_code = 200
        mock_response.headers = {}
        mock_safe_urlopen.return_value = mock_response

        response = send_and_save_webhook_request(self.sentry_app, self._make_event())
        # In dry-run, webhook is still sent
        assert response is not None
        assert response.status_code == 200
        mock_safe_urlopen.assert_called_once()

    @with_feature("organizations:sentry-app-webhook-circuit-breaker")
    @override_options(CIRCUIT_BREAKER_OPTIONS)
    @patch("sentry.utils.sentry_apps.webhooks.safe_urlopen")
    @patch("sentry.utils.sentry_apps.webhooks.CircuitBreaker")
    def test_blocking_mode_returns_empty_response(self, MockBreaker, mock_safe_urlopen):
        """With dry-run OFF, a broken circuit blocks the webhook."""
        mock_breaker_instance = MockBreaker.return_value
        mock_breaker_instance.should_allow_request.return_value = False

        send_and_save_webhook_request(self.sentry_app, self._make_event())
        # Webhook is blocked — no HTTP call made
        mock_safe_urlopen.assert_not_called()

    @with_feature("organizations:sentry-app-webhook-circuit-breaker")
    @override_options(CIRCUIT_BREAKER_OPTIONS)
    @patch("sentry.utils.sentry_apps.webhooks.safe_urlopen")
    @patch("sentry.utils.sentry_apps.webhooks.CircuitBreaker")
    def test_timeout_calls_record_error(self, MockBreaker, mock_safe_urlopen):
        """Timeout exceptions should call record_error()."""
        mock_breaker_instance = MockBreaker.return_value
        mock_breaker_instance.should_allow_request.return_value = True
        mock_safe_urlopen.side_effect = Timeout()

        with pytest.raises(Timeout):
            send_and_save_webhook_request(self.sentry_app, self._make_event())

        mock_breaker_instance.record_error.assert_called_once()

    @with_feature("organizations:sentry-app-webhook-circuit-breaker")
    @override_options(CIRCUIT_BREAKER_OPTIONS)
    @patch("sentry.utils.sentry_apps.webhooks.safe_urlopen")
    @patch("sentry.utils.sentry_apps.webhooks.CircuitBreaker")
    def test_success_calls_record_success(self, MockBreaker, mock_safe_urlopen):
        """Successful responses should call record_success()."""
        mock_breaker_instance = MockBreaker.return_value
        mock_breaker_instance.should_allow_request.return_value = True

        mock_response = Mock(spec=Response)
        mock_response.status_code = 200
        mock_response.headers = {}
        mock_safe_urlopen.return_value = mock_response

        send_and_save_webhook_request(self.sentry_app, self._make_event())
        mock_breaker_instance.record_success.assert_called_once()
