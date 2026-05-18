from unittest import mock

import responses

from sentry.sentry_apps.services.legacy_webhook.service import build_legacy_webhook_payload
from sentry.sentry_apps.services.legacy_webhook.tasks import send_legacy_webhook_task
from sentry.testutils.cases import TestCase
from sentry.testutils.helpers.features import with_feature
from sentry.utils import json


class TestSendLegacyWebhookTask(TestCase):
    @responses.activate
    def test_task_sends_webhook(self) -> None:
        responses.add(responses.POST, "http://example.com/hook")

        payload = build_legacy_webhook_payload(
            group=self.group, event=self.event, triggering_rules=["test-rule"]
        )
        send_legacy_webhook_task(
            url="http://example.com/hook",
            payload=payload,
            project_id=self.project.id,
        )

        assert len(responses.calls) == 1
        body = json.loads(responses.calls[0].request.body)
        assert body["id"] == str(self.group.id)
        assert body["message"] == self.event.message

    @responses.activate
    @mock.patch("sentry.sentry_apps.services.legacy_webhook.tasks.logger")
    @with_feature("organizations:legacy-webhook-dry-run")
    def test_task_dry_run_logs_instead_of_sending(self, mock_logger: mock.MagicMock) -> None:
        responses.add(responses.POST, "http://example.com/hook")

        payload = build_legacy_webhook_payload(
            group=self.group, event=self.event, triggering_rules=["test-rule"]
        )
        send_legacy_webhook_task(
            url="http://example.com/hook",
            payload=payload,
            project_id=self.project.id,
        )

        assert len(responses.calls) == 0
        mock_logger.info.assert_called_once()
        call_args = mock_logger.info.call_args
        assert call_args[0][0] == "legacy_webhook.dry_run"
        assert call_args[1]["extra"]["project_id"] == self.project.id
        assert call_args[1]["extra"]["url"] == "http://example.com/hook"
        assert call_args[1]["extra"]["payload"] == payload
