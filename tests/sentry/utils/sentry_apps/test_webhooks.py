from collections import namedtuple
from unittest.mock import Mock, patch

import pytest
from django.conf import settings
from requests import Response
from requests.exceptions import Timeout

from sentry.sentry_apps.api.serializers.app_platform_event import AppPlatformEvent
from sentry.sentry_apps.utils.webhooks import IssueActionType, SentryAppResourceType
from sentry.shared_integrations.exceptions import ApiHostError
from sentry.testutils.asserts import assert_failure_metric
from sentry.testutils.cases import TestCase
from sentry.testutils.helpers.features import with_feature
from sentry.testutils.helpers.options import override_options
from sentry.testutils.silo import cell_silo_test
from sentry.utils import redis
from sentry.utils.circuit_breaker2 import CircuitBreaker
from sentry.utils.sentry_apps.webhooks import WebhookTimeoutError, send_and_save_webhook_request


def _raise_status_false() -> bool:
    return False


_MockResponse = namedtuple(
    "_MockResponse",
    ["headers", "content", "text", "ok", "status_code", "raise_for_status", "request"],
)

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
    def test_hard_timeout_calls_record_error(self, MockBreaker, mock_safe_urlopen):
        """WebhookTimeoutError (hard timeout) should call record_error() on the circuit breaker."""
        mock_breaker_instance = MockBreaker.return_value
        mock_breaker_instance.should_allow_request.return_value = True
        mock_breaker_instance.is_open.return_value = False
        mock_safe_urlopen.side_effect = WebhookTimeoutError()

        with pytest.raises(WebhookTimeoutError):
            send_and_save_webhook_request(self.sentry_app, self._make_event())

        mock_breaker_instance.record_error.assert_called_once()
        mock_breaker_instance.record_success.assert_not_called()

    @with_feature("organizations:sentry-app-webhook-circuit-breaker")
    @override_options(CIRCUIT_BREAKER_OPTIONS)
    @patch("sentry.utils.sentry_apps.webhooks.safe_urlopen")
    @patch("sentry.utils.sentry_apps.webhooks.CircuitBreaker")
    def test_timeout_does_not_record_error(self, MockBreaker, mock_safe_urlopen):
        """Regular Timeout exceptions are not recorded as circuit breaker errors — only
        WebhookTimeoutError (hard timeout) is. A fast network timeout still counts as
        a completed attempt from the breaker's perspective."""
        mock_breaker_instance = MockBreaker.return_value
        mock_breaker_instance.should_allow_request.return_value = True
        mock_safe_urlopen.side_effect = Timeout()

        with pytest.raises(Timeout):
            send_and_save_webhook_request(self.sentry_app, self._make_event())

        mock_breaker_instance.record_error.assert_not_called()
        mock_breaker_instance.record_success.assert_not_called()

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

    @with_feature("organizations:sentry-app-webhook-circuit-breaker")
    @override_options(CIRCUIT_BREAKER_OPTIONS)
    @patch.object(CircuitBreaker, "record_success")
    @patch("sentry.utils.sentry_apps.webhooks.safe_urlopen")
    def test_http_error_response_records_success_and_raises(
        self, mock_safe_urlopen, mock_record_success
    ):
        """When the circuit breaker allows a request but the response is an HTTP error,
        the breaker records success (the connection completed) and the normal error
        handling still raises the appropriate exception."""
        mock_safe_urlopen.return_value = _MockResponse(
            {}, '{"error": "service unavailable"}', "", False, 503, _raise_status_false, None
        )

        with pytest.raises(ApiHostError):
            send_and_save_webhook_request(self.sentry_app, self._make_event())

        mock_record_success.assert_called_once()


@cell_silo_test
class WebhookCircuitBreakerNotifyTest(TestCase):
    def setUp(self):
        self.organization = self.create_organization()
        self.user = self.create_user(email="creator@example.com")
        self.sentry_app = self.create_sentry_app(
            name="TestApp",
            organization=self.organization,
            user=self.user,
            webhook_url="https://example.com/webhook",
            published=True,
        )
        self.install = self.create_sentry_app_installation(
            organization=self.organization, slug=self.sentry_app.slug
        )
        client = redis.redis_clusters.get(settings.SENTRY_RATE_LIMIT_REDIS_CLUSTER)
        client.flushall()

    def _make_event(self):
        return AppPlatformEvent(
            resource=SentryAppResourceType.ISSUE,
            action=IssueActionType.CREATED,
            install=self.install,
            data={"test": "data"},
        )

    @staticmethod
    def _configure_breaker(MockBreaker, *, is_open):
        mock_breaker_instance = MockBreaker.return_value
        mock_breaker_instance.should_allow_request.return_value = True
        mock_breaker_instance.is_open.return_value = is_open
        mock_breaker_instance.broken_state_duration = 300
        mock_breaker_instance.recovery_duration = 600
        return mock_breaker_instance

    @with_feature("organizations:sentry-app-webhook-circuit-breaker")
    @override_options(CIRCUIT_BREAKER_OPTIONS)
    @patch("sentry.utils.sentry_apps.webhooks.NotificationService")
    @patch("sentry.utils.sentry_apps.webhooks.safe_urlopen")
    @patch("sentry.utils.sentry_apps.webhooks.CircuitBreaker")
    def test_timeout_with_trip_calls_notify_async(
        self, MockBreaker, mock_safe_urlopen, MockService
    ):
        """When the breaker trips during a timeout, an email is dispatched."""
        self._configure_breaker(MockBreaker, is_open=True)
        MockService.has_access.return_value = True
        mock_safe_urlopen.side_effect = WebhookTimeoutError()

        with pytest.raises(WebhookTimeoutError):
            send_and_save_webhook_request(self.sentry_app, self._make_event())

        MockService.return_value.notify_async.assert_called_once()

    @with_feature("organizations:sentry-app-webhook-circuit-breaker")
    @override_options(CIRCUIT_BREAKER_OPTIONS)
    @patch("sentry.utils.sentry_apps.webhooks.NotificationService")
    @patch("sentry.utils.sentry_apps.webhooks.safe_urlopen")
    @patch("sentry.utils.sentry_apps.webhooks.CircuitBreaker")
    def test_timeout_without_trip_does_not_notify(
        self, MockBreaker, mock_safe_urlopen, MockService
    ):
        """A timeout that doesn't trip the breaker should not email."""
        self._configure_breaker(MockBreaker, is_open=False)
        mock_safe_urlopen.side_effect = WebhookTimeoutError()

        with pytest.raises(WebhookTimeoutError):
            send_and_save_webhook_request(self.sentry_app, self._make_event())

        MockService.return_value.notify_async.assert_not_called()

    @with_feature("organizations:sentry-app-webhook-circuit-breaker")
    @override_options(
        {**CIRCUIT_BREAKER_OPTIONS, "sentry-apps.webhook.circuit-breaker.dry-run": True}
    )
    @patch("sentry.utils.sentry_apps.webhooks.NotificationService")
    @patch("sentry.utils.sentry_apps.webhooks.safe_urlopen")
    @patch("sentry.utils.sentry_apps.webhooks.CircuitBreaker")
    def test_dry_run_does_not_dispatch_notify_async(
        self, MockBreaker, mock_safe_urlopen, MockService
    ):
        """Dry-run mode skips delivery even when the breaker trips."""
        self._configure_breaker(MockBreaker, is_open=True)
        mock_safe_urlopen.side_effect = WebhookTimeoutError()

        with pytest.raises(WebhookTimeoutError):
            send_and_save_webhook_request(self.sentry_app, self._make_event())

        MockService.return_value.notify_async.assert_not_called()

    @with_feature("organizations:sentry-app-webhook-circuit-breaker")
    @override_options(CIRCUIT_BREAKER_OPTIONS)
    @patch("sentry.utils.sentry_apps.webhooks.NotificationService")
    @patch("sentry.utils.sentry_apps.webhooks.safe_urlopen")
    @patch("sentry.utils.sentry_apps.webhooks.CircuitBreaker")
    def test_concurrent_trips_emit_single_email_within_24h(
        self, MockBreaker, mock_safe_urlopen, MockService
    ):
        self._configure_breaker(MockBreaker, is_open=True)
        MockService.has_access.return_value = True
        mock_safe_urlopen.side_effect = WebhookTimeoutError()

        for _ in range(5):
            with pytest.raises(WebhookTimeoutError):
                send_and_save_webhook_request(self.sentry_app, self._make_event())

        assert MockService.return_value.notify_async.call_count == 1

        client = redis.redis_clusters.get(settings.SENTRY_RATE_LIMIT_REDIS_CLUSTER)
        dedup_key = f"sentry-app.webhook.circuit-breaker.notified.{self.sentry_app.slug}"
        assert client.ttl(dedup_key) >= 86400

    @with_feature("organizations:sentry-app-webhook-circuit-breaker")
    @override_options(CIRCUIT_BREAKER_OPTIONS)
    @patch("sentry.utils.sentry_apps.webhooks.NotificationService")
    @patch("sentry.utils.sentry_apps.webhooks.safe_urlopen")
    @patch("sentry.utils.sentry_apps.webhooks.CircuitBreaker")
    def test_creator_label_without_at_sign_skips_email(
        self, MockBreaker, mock_safe_urlopen, MockService
    ):
        """If creator_label is a username (no @), we shouldn't email."""
        self.sentry_app.creator_label = "no-email-username"

        self._configure_breaker(MockBreaker, is_open=True)
        mock_safe_urlopen.side_effect = WebhookTimeoutError()

        with pytest.raises(WebhookTimeoutError):
            send_and_save_webhook_request(self.sentry_app, self._make_event())

        MockService.return_value.notify_async.assert_not_called()

    @with_feature("organizations:sentry-app-webhook-circuit-breaker")
    @override_options(CIRCUIT_BREAKER_OPTIONS)
    @patch("sentry.utils.sentry_apps.webhooks.NotificationService")
    @patch("sentry.utils.sentry_apps.webhooks.safe_urlopen")
    @patch("sentry.utils.sentry_apps.webhooks.CircuitBreaker")
    def test_new_trip_after_dedup_expires_emails_again(
        self, MockBreaker, mock_safe_urlopen, MockService
    ):
        """After the dedup key expires, a fresh BROKEN trip should email again."""
        self._configure_breaker(MockBreaker, is_open=True)
        MockService.has_access.return_value = True
        mock_safe_urlopen.side_effect = WebhookTimeoutError()

        with pytest.raises(WebhookTimeoutError):
            send_and_save_webhook_request(self.sentry_app, self._make_event())

        # Simulate dedup TTL expiry by deleting the key.
        client = redis.redis_clusters.get(settings.SENTRY_RATE_LIMIT_REDIS_CLUSTER)
        client.delete(f"sentry-app.webhook.circuit-breaker.notified.{self.sentry_app.slug}")

        with pytest.raises(WebhookTimeoutError):
            send_and_save_webhook_request(self.sentry_app, self._make_event())

        assert MockService.return_value.notify_async.call_count == 2

    @with_feature("organizations:sentry-app-webhook-circuit-breaker")
    @override_options(CIRCUIT_BREAKER_OPTIONS)
    @patch("sentry.integrations.utils.metrics.EventLifecycle.record_event")
    @patch("sentry.utils.sentry_apps.webhooks.NotificationService")
    @patch("sentry.utils.sentry_apps.webhooks.safe_urlopen")
    @patch("sentry.utils.sentry_apps.webhooks.CircuitBreaker")
    def test_email_failure_records_failure_and_propagates(
        self, MockBreaker, mock_safe_urlopen, MockService, mock_record
    ):
        """If the email notification fails, the error is recorded as a failure and propagated."""
        self._configure_breaker(MockBreaker, is_open=True)
        MockService.has_access.side_effect = RuntimeError("email boom")
        mock_safe_urlopen.side_effect = WebhookTimeoutError("hard timeout")

        with pytest.raises(RuntimeError, match="email boom"):
            send_and_save_webhook_request(self.sentry_app, self._make_event())

        assert_failure_metric(mock_record=mock_record, error_msg=RuntimeError("email boom"))
