import uuid
from unittest import mock

import responses

from sentry.models.activity import Activity
from sentry.models.options.project_option import ProjectOption
from sentry.notifications.notification_action.action_handler_registry.plugin_handler import (
    PluginActionHandler,
)
from sentry.types.activity import ActivityType
from sentry.utils import json
from sentry.workflow_engine.models import Action
from sentry.workflow_engine.types import ActionInvocation, WorkflowEventData
from tests.sentry.workflow_engine.test_base import BaseWorkflowTest


class TestPluginActionHandlerExecute(BaseWorkflowTest):
    def setUp(self) -> None:
        super().setUp()
        self.detector = self.create_detector(project=self.project)
        self.workflow = self.create_workflow(environment=self.environment)
        self.action = self.create_action(
            type=Action.Type.PLUGIN,
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
        ProjectOption.objects.set_value(self.project, "webhooks:urls", "http://example.com/hook")
        ProjectOption.objects.set_value(self.project, "webhooks:enabled", True)

    @responses.activate
    def test_sends_webhook(self) -> None:
        responses.add(responses.POST, "http://example.com/hook")

        with self.tasks():
            PluginActionHandler.execute(self.invocation)

        assert len(responses.calls) == 1
        body = json.loads(responses.calls[0].request.body)
        assert body["id"] == str(self.group.id)

    @mock.patch(
        "sentry.notifications.notification_action.action_handler_registry.plugin_handler.send_legacy_webhooks_for_invocation"
    )
    def test_non_group_event_does_nothing(self, mock_send: mock.MagicMock) -> None:
        activity = Activity.objects.create(
            project=self.project,
            group=self.group,
            type=ActivityType.SET_RESOLVED.value,
        )
        invocation = ActionInvocation(
            event_data=WorkflowEventData(
                event=activity, workflow_env=self.environment, group=self.group
            ),
            action=self.action,
            detector=self.detector,
            notification_uuid=str(uuid.uuid4()),
            workflow_id=self.workflow.id,
        )

        PluginActionHandler.execute(invocation)

        mock_send.assert_not_called()

    @responses.activate
    def test_disabled_webhooks_does_not_send(self) -> None:
        responses.add(responses.POST, "http://example.com/hook")
        ProjectOption.objects.set_value(self.project, "webhooks:enabled", False)

        with self.tasks():
            PluginActionHandler.execute(self.invocation)

        assert len(responses.calls) == 0
