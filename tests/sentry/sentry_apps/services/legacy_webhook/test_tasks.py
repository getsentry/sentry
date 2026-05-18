import responses

from sentry.sentry_apps.services.legacy_webhook.service import build_legacy_webhook_payload
from sentry.sentry_apps.services.legacy_webhook.tasks import send_legacy_webhook_task
from sentry.testutils.cases import TestCase
from sentry.utils import json


class TestSendLegacyWebhookTask(TestCase):
    @responses.activate
    def test_task_sends_webhook(self) -> None:
        responses.add(responses.POST, "http://example.com/hook")

        payload = build_legacy_webhook_payload(
            group=self.group, event=self.event, triggering_rules=["test-rule"]
        )
        send_legacy_webhook_task(url="http://example.com/hook", payload=payload)

        assert len(responses.calls) == 1
        body = json.loads(responses.calls[0].request.body)
        assert body["id"] == str(self.group.id)
        assert body["message"] == self.event.message
