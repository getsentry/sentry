from collections import namedtuple
from unittest.mock import Mock, patch

import orjson
import pytest
from django.conf import settings
from requests import Response
from requests.exceptions import Timeout

from sentry.notifications.platform.service import NotificationService
from sentry.sentry_apps.api.serializers.app_platform_event import AppPlatformEvent
from sentry.sentry_apps.models.sentry_app import MASKED_VALUE
from sentry.sentry_apps.utils.webhooks import IssueActionType, SentryAppResourceType
from sentry.shared_integrations.exceptions import ApiHostError, ClientError
from sentry.testutils.asserts import assert_failure_metric
from sentry.testutils.cases import TestCase
from sentry.testutils.helpers.features import with_feature
from sentry.testutils.helpers.options import override_options
from sentry.testutils.silo import cell_silo_test
from sentry.utils import redis
from sentry.utils.circuit_breaker2 import CircuitBreaker
from sentry.utils.sentry_apps import SentryAppWebhookRequestsBuffer
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
    "sentry-apps.webhook.timeout.sec": 1.0,
    "sentry-apps.webhook.restricted-webhook-sending": [],
    "notifications.platform-rollout.internal-testing": {
        "sentry-app-webhook-disabled": 1.0,
    },
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
    @patch("sentry.utils.sentry_apps.webhooks.CircuitBreaker")
    def test_blocking_mode_returns_empty_response(self, MockBreaker, mock_safe_urlopen):
        """A broken circuit blocks the webhook."""
        mock_breaker_instance = MockBreaker.return_value
        mock_breaker_instance.should_allow_request.return_value = False

        send_and_save_webhook_request(self.sentry_app, self._make_event())
        # Webhook is blocked — no HTTP call made
        mock_safe_urlopen.assert_not_called()

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

    @with_feature("organizations:sentry-apps-custom-webhook-headers")
    @override_options(CIRCUIT_BREAKER_OPTIONS)
    @patch("sentry.utils.sentry_apps.webhooks.safe_urlopen")
    def test_error_response_buffers_masked_custom_headers(self, mock_safe_urlopen):
        """A failed delivery records masked custom headers in the request buffer, so the
        debug UI shows which custom headers were sent without persisting their secrets."""
        sentry_app = self.create_sentry_app(
            name="HeaderApp",
            organization=self.organization,
            webhook_url="https://example.com/webhook",
            published=True,
            webhook_headers=["Authorization: Bearer super-secret"],
        )
        install = self.create_sentry_app_installation(
            organization=self.organization, slug=sentry_app.slug
        )
        event = AppPlatformEvent(
            resource=SentryAppResourceType.ISSUE,
            action=IssueActionType.CREATED,
            install=install,
            data={"test": "data"},
        )
        mock_safe_urlopen.return_value = _MockResponse(
            {}, "{}", "", False, 401, _raise_status_false, None
        )

        with pytest.raises(ClientError):
            send_and_save_webhook_request(sentry_app, event)

        requests = SentryAppWebhookRequestsBuffer(sentry_app).get_requests(errors_only=True)
        assert len(requests) == 1
        headers = requests[0].get("request_headers")
        assert headers is not None
        # The custom header name is recorded but its value is masked.
        assert headers["Authorization"] == MASKED_VALUE
        assert "Bearer super-secret" not in headers.values()
        # Sentry's own headers are still recorded in the clear.
        assert headers["Content-Type"] == "application/json"

    @override_options(CIRCUIT_BREAKER_OPTIONS)
    @patch("sentry.utils.sentry_apps.webhooks.safe_urlopen")
    def test_custom_headers_not_sent_or_logged_without_flag(self, mock_safe_urlopen):
        """Without the feature flag, custom headers are stripped from both the request
        and the buffer log."""
        sentry_app = self.create_sentry_app(
            name="HeaderApp",
            organization=self.organization,
            webhook_url="https://example.com/webhook",
            published=True,
            webhook_headers=["Authorization: Bearer super-secret"],
        )
        install = self.create_sentry_app_installation(
            organization=self.organization, slug=sentry_app.slug
        )
        event = AppPlatformEvent(
            resource=SentryAppResourceType.ISSUE,
            action=IssueActionType.CREATED,
            install=install,
            data={"test": "data"},
        )
        mock_safe_urlopen.return_value = _MockResponse(
            {}, "{}", "", False, 401, _raise_status_false, None
        )

        with pytest.raises(ClientError):
            send_and_save_webhook_request(sentry_app, event)

        # Custom header must not appear in the outbound request.
        call_headers = mock_safe_urlopen.call_args.kwargs["headers"]
        assert "Authorization" not in call_headers

        # Custom header must not appear in the buffer log either.
        requests = SentryAppWebhookRequestsBuffer(sentry_app).get_requests(errors_only=True)
        assert len(requests) == 1
        headers = requests[0].get("request_headers")
        assert headers is not None
        assert "Authorization" not in headers
        assert headers["Content-Type"] == "application/json"


@cell_silo_test
class WebhookCircuitBreakerNotifyTest(TestCase):
    def setUp(self):
        self.user = self.create_user(email="creator@example.com")
        self.organization = self.create_organization(owner=self.user)
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

    def _make_event(self, install=None):
        return AppPlatformEvent(
            resource=SentryAppResourceType.ISSUE,
            action=IssueActionType.CREATED,
            install=install or self.install,
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

    @with_feature("organizations:notification-platform.internal-testing")
    @override_options(CIRCUIT_BREAKER_OPTIONS)
    @patch.object(NotificationService, "notify_async")
    @patch("sentry.utils.sentry_apps.webhooks.safe_urlopen")
    @patch("sentry.utils.sentry_apps.webhooks.CircuitBreaker")
    def test_timeout_with_trip_calls_notify_async(
        self, MockBreaker, mock_safe_urlopen, mock_notify_async
    ):
        """When the breaker trips during a timeout, an email is dispatched."""
        self._configure_breaker(MockBreaker, is_open=True)
        mock_safe_urlopen.side_effect = WebhookTimeoutError()

        with pytest.raises(WebhookTimeoutError):
            send_and_save_webhook_request(self.sentry_app, self._make_event())

        mock_notify_async.assert_called_once()

    @override_options(CIRCUIT_BREAKER_OPTIONS)
    @patch.object(NotificationService, "notify_async")
    @patch("sentry.utils.sentry_apps.webhooks.safe_urlopen")
    @patch("sentry.utils.sentry_apps.webhooks.CircuitBreaker")
    def test_timeout_without_trip_does_not_notify(
        self, MockBreaker, mock_safe_urlopen, mock_notify_async
    ):
        """A timeout that doesn't trip the breaker should not email."""
        self._configure_breaker(MockBreaker, is_open=False)
        mock_safe_urlopen.side_effect = WebhookTimeoutError()

        with pytest.raises(WebhookTimeoutError):
            send_and_save_webhook_request(self.sentry_app, self._make_event())

        mock_notify_async.assert_not_called()

    @with_feature("organizations:notification-platform.internal-testing")
    @override_options(CIRCUIT_BREAKER_OPTIONS)
    @patch.object(NotificationService, "notify_async")
    @patch("sentry.utils.sentry_apps.webhooks.safe_urlopen")
    @patch("sentry.utils.sentry_apps.webhooks.CircuitBreaker")
    def test_concurrent_trips_emit_single_email_within_24h(
        self, MockBreaker, mock_safe_urlopen, mock_notify_async
    ):
        self._configure_breaker(MockBreaker, is_open=True)
        mock_safe_urlopen.side_effect = WebhookTimeoutError()

        for _ in range(5):
            with pytest.raises(WebhookTimeoutError):
                send_and_save_webhook_request(self.sentry_app, self._make_event())

        assert mock_notify_async.call_count == 1

        client = redis.redis_clusters.get(settings.SENTRY_RATE_LIMIT_REDIS_CLUSTER)
        dedup_key = f"sentry-app.webhook.circuit-breaker.notified.{self.sentry_app.slug}"
        assert client.ttl(dedup_key) >= 86400

    @with_feature("organizations:notification-platform.internal-testing")
    @override_options(CIRCUIT_BREAKER_OPTIONS)
    @patch.object(NotificationService, "notify_async")
    @patch("sentry.utils.sentry_apps.webhooks.safe_urlopen")
    @patch("sentry.utils.sentry_apps.webhooks.CircuitBreaker")
    def test_creator_is_active_verified_org_member_sends_to_creator(
        self, MockBreaker, mock_safe_urlopen, mock_notify_async
    ):
        """When creator is a valid org member, email goes to creator."""
        self._configure_breaker(MockBreaker, is_open=True)
        mock_safe_urlopen.side_effect = WebhookTimeoutError()

        with pytest.raises(WebhookTimeoutError):
            send_and_save_webhook_request(self.sentry_app, self._make_event())

        mock_notify_async.assert_called_once()
        targets = mock_notify_async.call_args.kwargs["targets"]
        assert len(targets) == 1
        assert targets[0].resource_id == "creator@example.com"

    @with_feature("organizations:notification-platform.internal-testing")
    @override_options(CIRCUIT_BREAKER_OPTIONS)
    @patch.object(NotificationService, "notify_async")
    @patch("sentry.utils.sentry_apps.webhooks.safe_urlopen")
    @patch("sentry.utils.sentry_apps.webhooks.CircuitBreaker")
    def test_creator_not_org_member_falls_back_to_owners(
        self, MockBreaker, mock_safe_urlopen, mock_notify_async
    ):
        """When creator is not a valid org member, falls back to org owner."""
        non_member = self.create_user(email="non-member@example.com")
        sentry_app = self.create_sentry_app(
            name="NonMemberApp",
            organization=self.organization,
            user=non_member,
            webhook_url="https://example.com/webhook",
            published=True,
        )
        install = self.create_sentry_app_installation(
            organization=self.organization, slug=sentry_app.slug
        )

        self._configure_breaker(MockBreaker, is_open=True)
        mock_safe_urlopen.side_effect = WebhookTimeoutError()

        with pytest.raises(WebhookTimeoutError):
            send_and_save_webhook_request(sentry_app, self._make_event(install=install))

        mock_notify_async.assert_called_once()
        targets = mock_notify_async.call_args.kwargs["targets"]
        assert len(targets) == 1
        assert targets[0].resource_id == "creator@example.com"

    @override_options(CIRCUIT_BREAKER_OPTIONS)
    @patch.object(NotificationService, "notify_async")
    @patch("sentry.utils.sentry_apps.webhooks.safe_urlopen")
    @patch("sentry.utils.sentry_apps.webhooks.CircuitBreaker")
    def test_no_valid_recipients_skips_email(
        self, MockBreaker, mock_safe_urlopen, mock_notify_async
    ):
        """When no valid recipients exist, no email is sent."""
        org = self.create_organization()
        non_member = self.create_user(email="ghost@example.com")
        sentry_app = self.create_sentry_app(
            name="NoOwnerApp",
            organization=org,
            user=non_member,
            webhook_url="https://example.com/webhook",
            published=True,
        )
        install = self.create_sentry_app_installation(organization=org, slug=sentry_app.slug)

        self._configure_breaker(MockBreaker, is_open=True)
        mock_safe_urlopen.side_effect = WebhookTimeoutError()

        with pytest.raises(WebhookTimeoutError):
            send_and_save_webhook_request(sentry_app, self._make_event(install=install))

        mock_notify_async.assert_not_called()

    @with_feature("organizations:notification-platform.internal-testing")
    @override_options(CIRCUIT_BREAKER_OPTIONS)
    @patch.object(NotificationService, "notify_async")
    @patch("sentry.utils.sentry_apps.webhooks.safe_urlopen")
    @patch("sentry.utils.sentry_apps.webhooks.CircuitBreaker")
    def test_new_trip_after_dedup_expires_emails_again(
        self, MockBreaker, mock_safe_urlopen, mock_notify_async
    ):
        """After the dedup key expires, a fresh BROKEN trip should email again."""
        self._configure_breaker(MockBreaker, is_open=True)
        mock_safe_urlopen.side_effect = WebhookTimeoutError()

        with pytest.raises(WebhookTimeoutError):
            send_and_save_webhook_request(self.sentry_app, self._make_event())

        # Simulate dedup TTL expiry by deleting the key.
        client = redis.redis_clusters.get(settings.SENTRY_RATE_LIMIT_REDIS_CLUSTER)
        client.delete(f"sentry-app.webhook.circuit-breaker.notified.{self.sentry_app.slug}")

        with pytest.raises(WebhookTimeoutError):
            send_and_save_webhook_request(self.sentry_app, self._make_event())

        assert mock_notify_async.call_count == 2

    @with_feature("organizations:notification-platform.internal-testing")
    @override_options(CIRCUIT_BREAKER_OPTIONS)
    @patch("sentry.integrations.utils.metrics.EventLifecycle.record_event")
    @patch.object(NotificationService, "notify_async", side_effect=RuntimeError("email boom"))
    @patch("sentry.utils.sentry_apps.webhooks.safe_urlopen")
    @patch("sentry.utils.sentry_apps.webhooks.CircuitBreaker")
    def test_email_failure_records_failure_and_propagates(
        self, MockBreaker, mock_safe_urlopen, mock_notify_async, mock_record
    ):
        """If the email notification fails, the error is recorded as a failure and propagated."""
        self._configure_breaker(MockBreaker, is_open=True)
        mock_safe_urlopen.side_effect = WebhookTimeoutError("hard timeout")

        with pytest.raises(RuntimeError, match="email boom"):
            send_and_save_webhook_request(self.sentry_app, self._make_event())

        assert_failure_metric(mock_record=mock_record, error_msg=RuntimeError("email boom"))


@cell_silo_test
class ClaudeRoutineTextSummaryTest(TestCase):
    ROUTINE_URL = "https://api.anthropic.com/v1/claude_code/routines/trig_123/fire"

    def setUp(self):
        self.organization = self.create_organization()

    def _send(self, mock_safe_urlopen, webhook_url: str) -> dict:
        """Send an issue.created webhook and return the JSON body that went out."""
        sentry_app = self.create_sentry_app(
            name="RoutineApp",
            organization=self.organization,
            webhook_url=webhook_url,
            published=True,
        )
        install = self.create_sentry_app_installation(
            organization=self.organization, slug=sentry_app.slug
        )
        event = AppPlatformEvent(
            resource=SentryAppResourceType.ISSUE,
            action=IssueActionType.CREATED,
            install=install,
            data={"issue": {"id": "123"}},
        )
        mock_response = Mock(spec=Response)
        mock_response.status_code = 200
        mock_response.headers = {}
        mock_safe_urlopen.return_value = mock_response

        send_and_save_webhook_request(sentry_app, event)
        return orjson.loads(mock_safe_urlopen.call_args.kwargs["data"])

    @with_feature("organizations:sentry-apps-claude-routine-webhooks")
    @override_options(CIRCUIT_BREAKER_OPTIONS)
    @patch("sentry.utils.sentry_apps.webhooks.safe_urlopen")
    def test_routine_url_with_flag_appends_text(self, mock_safe_urlopen):
        body = self._send(mock_safe_urlopen, self.ROUTINE_URL)

        # Summary format is pinned by the AppPlatformEvent tests; only gating matters here.
        assert "text" in body
        # The standard payload still rides along.
        assert body["action"] == "created"
        assert body["data"]["issue"]["id"] == "123"

    @override_options(CIRCUIT_BREAKER_OPTIONS)
    @patch("sentry.utils.sentry_apps.webhooks.safe_urlopen")
    def test_routine_url_without_flag_sends_standard_body(self, mock_safe_urlopen):
        body = self._send(mock_safe_urlopen, self.ROUTINE_URL)

        assert "text" not in body

    @with_feature("organizations:sentry-apps-claude-routine-webhooks")
    @override_options(CIRCUIT_BREAKER_OPTIONS)
    @patch("sentry.utils.sentry_apps.webhooks.safe_urlopen")
    def test_non_routine_url_with_flag_sends_standard_body(self, mock_safe_urlopen):
        body = self._send(mock_safe_urlopen, "https://example.com/webhook")

        assert "text" not in body
