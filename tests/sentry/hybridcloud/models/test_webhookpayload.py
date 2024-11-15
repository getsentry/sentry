from datetime import timedelta

from django.test import RequestFactory
from django.utils import timezone

from sentry.hybridcloud.models import WebhookPayload
from sentry.hybridcloud.models.webhookpayload import BACKOFF_INTERVAL, BACKOFF_RATE, MAX_ATTEMPTS
from sentry.testutils.cases import TestCase
from sentry.testutils.silo import control_silo_test


@control_silo_test
class WebhookPayloadTest(TestCase):
    def test_create_from_request(self) -> None:
        factory = RequestFactory()
        request = factory.post(
            "/extensions/github/webhook/",
            data={"installation": {"id": "github:1"}},
            content_type="application/json",
        )
        hook = WebhookPayload.create_from_request(
            region="us",
            provider="github",
            identifier=123,
            request=request,
            integration_id=123,
        )
        assert hook.mailbox_name == "github:123"
        assert hook.request_method == request.method
        assert hook.request_path == request.get_full_path()
        assert (
            hook.request_headers
            == '{"Cookie":"","Content-Length":"36","Content-Type":"application/json"}'
        )
        assert hook.request_body == '{"installation": {"id": "github:1"}}'

    def test_schedule_next_attempt_moves_forward(self) -> None:
        hook = self.create_webhook_payload("jira:123", "us")
        start = timezone.now()
        hook.update(schedule_for=start)
        assert hook.attempts == 0

        # Generates a range of 4min - 60min. Total latency for 9 retries is 264m (4h 26m)
        # however, the last retry discards the message instead of delivering it
        expected_deltas = [BACKOFF_INTERVAL * BACKOFF_RATE**i for i in range(1, 11)]
        expected_deltas = [min(i, 60) for i in expected_deltas]

        # attempts is 1-10 so we pad the list one slot
        expected_deltas = [0] + expected_deltas
        while hook.attempts < MAX_ATTEMPTS:
            hook.schedule_next_attempt()

            new_delta = hook.schedule_for.replace(microsecond=0) - start
            assert new_delta <= timedelta(hours=1, minutes=27)
            assert round(expected_deltas[hook.attempts]) == round(
                new_delta.total_seconds() / 60
            ), f"{expected_deltas} attempt: {hook.attempts}"
