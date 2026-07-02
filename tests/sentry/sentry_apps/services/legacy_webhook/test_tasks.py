import uuid

import responses

from sentry.sentry_apps.services.legacy_webhook.service import build_legacy_webhook_payload
from sentry.sentry_apps.services.legacy_webhook.tasks import send_legacy_webhook_task
from sentry.utils import json
from sentry.workflow_engine.models import Action
from sentry.workflow_engine.types import ActionInvocation, WorkflowEventData
from tests.sentry.workflow_engine.test_base import BaseWorkflowTest


class TestSendLegacyWebhookTask(BaseWorkflowTest):
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

    @responses.activate
    def test_task_sends_webhook(self) -> None:
        responses.add(responses.POST, "http://example.com/hook")

        payload = build_legacy_webhook_payload(self.invocation)
        send_legacy_webhook_task(url="http://example.com/hook", payload=payload)

        assert len(responses.calls) == 1
        body = json.loads(responses.calls[0].request.body)
        assert body["id"] == str(self.group.id)
        assert body["message"] == self.group_event.message
