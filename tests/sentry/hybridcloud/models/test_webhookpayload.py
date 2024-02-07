from datetime import timedelta

from django.test import RequestFactory
from django.utils import timezone

from sentry.hybridcloud.models import WebhookPayload
from sentry.testutils.cases import TestCase
from sentry.testutils.silo import control_silo_test


@control_silo_test
class WebhookPayloadTest(TestCase):
    def test_create_from_request(self):
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

    def test_schedule_next_attempt(self):
        start = timezone.now()
        hook = self.create_webhook_payload("jira:123", "us")
        assert hook.attempts == 0
        while hook.attempts < 10:
            previous_attempt = hook.attempts
            previous_schedule = hook.schedule_for
            hook.schedule_next_attempt()
            assert hook.attempts == previous_attempt + 1
            assert hook.schedule_for > previous_schedule
            # Don't check the delta on the first iteration as we default to a time in 2016
            if previous_schedule > start:
                assert (hook.schedule_for - previous_schedule).total_seconds() <= timedelta(
                    hours=1
                ).total_seconds()
