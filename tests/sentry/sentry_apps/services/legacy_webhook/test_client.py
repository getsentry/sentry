import responses

from sentry.sentry_apps.services.legacy_webhook.client import LegacyWebhookClient
from sentry.sentry_apps.services.legacy_webhook.service import build_legacy_webhook_payload
from sentry.testutils.cases import TestCase
from sentry.utils import json


class TestLegacyWebhookClient(TestCase):
    @responses.activate
    def test_posts_json_payload(self) -> None:
        responses.add(responses.POST, "http://example.com/hook")

        payload = build_legacy_webhook_payload(
            group=self.group, event=self.event, triggering_rules=["test-rule"]
        )
        client = LegacyWebhookClient(payload)
        client.request("http://example.com/hook")

        assert len(responses.calls) == 1
        request = responses.calls[0].request
        assert request.method == "POST"
        body = json.loads(request.body)
        assert body["id"] == str(self.group.id)
        assert body["message"] == self.event.message

    @responses.activate
    def test_no_redirects(self) -> None:
        responses.add(responses.POST, "http://example.com/hook", status=301)

        payload = build_legacy_webhook_payload(
            group=self.group, event=self.event, triggering_rules=["test-rule"]
        )
        client = LegacyWebhookClient(payload)
        client.request("http://example.com/hook")

        assert len(responses.calls) == 1
        assert responses.calls[0].response.status_code == 301

    @responses.activate
    def test_handles_timeout_and_connection_errors(self) -> None:
        responses.add(
            responses.POST,
            "http://example.com/hook",
            body=ConnectionError("connection refused"),
        )

        payload = build_legacy_webhook_payload(
            group=self.group, event=self.event, triggering_rules=["test-rule"]
        )
        client = LegacyWebhookClient(payload)
        try:
            client.request("http://example.com/hook")
        except Exception:
            pass

        assert len(responses.calls) == 1
