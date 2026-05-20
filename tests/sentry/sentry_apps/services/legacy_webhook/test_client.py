import uuid

import responses

from sentry.sentry_apps.services.legacy_webhook.client import LegacyWebhookClient
from sentry.sentry_apps.services.legacy_webhook.service import build_legacy_webhook_payload
from sentry.utils import json
from sentry.workflow_engine.models import Action
from sentry.workflow_engine.types import ActionInvocation, WorkflowEventData
from tests.sentry.workflow_engine.test_base import BaseWorkflowTest


class TestLegacyWebhookClient(BaseWorkflowTest):
    def setUp(self) -> None:
        super().setUp()
        self.detector = self.create_detector(project=self.project)
        self.workflow = self.create_workflow(environment=self.environment)
        self.action = self.create_action(
            type=Action.Type.WEBHOOK,
            config={"target_identifier": "webhooks"},
        )
        self.group, self.event, self.group_event = self.create_group_event()
        self.event_data = WorkflowEventData(
            event=self.group_event, workflow_env=self.environment, group=self.group
        )
        self.invocation = ActionInvocation(
            event_data=self.event_data,
            action=self.action,
            detector=self.detector,
            notification_uuid=str(uuid.uuid4()),
            workflow_id=self.workflow.id,
        )
        self.payload = build_legacy_webhook_payload(self.invocation)

    @responses.activate
    def test_posts_json_payload(self) -> None:
        responses.add(responses.POST, "http://example.com/hook")

        client = LegacyWebhookClient(self.payload)
        client.request("http://example.com/hook")

        assert len(responses.calls) == 1
        request = responses.calls[0].request
        assert request.method == "POST"
        body = json.loads(request.body)
        assert body["id"] == str(self.group.id)
        assert body["message"] == self.group_event.message

    @responses.activate
    def test_no_redirects(self) -> None:
        responses.add(responses.POST, "http://example.com/hook", status=301)

        client = LegacyWebhookClient(self.payload)
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

        client = LegacyWebhookClient(self.payload)
        try:
            client.request("http://example.com/hook")
        except Exception:
            pass

        assert len(responses.calls) == 1
