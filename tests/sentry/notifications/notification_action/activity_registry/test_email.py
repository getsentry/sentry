import uuid

import pytest

from sentry.models.activity import Activity
from sentry.notifications.notification_action.activity_registry.email import EmailActivityHandler
from sentry.notifications.notification_action.registry import activity_handler_registry
from sentry.services.eventstore.models import GroupEvent
from sentry.types.activity import ActivityType
from sentry.workflow_engine.models import Action
from sentry.workflow_engine.types import ActionInvocation, WorkflowEventData
from tests.sentry.workflow_engine.test_base import BaseWorkflowTest


class TestEmailActivityHandlerRegistration:
    def test_email_registered(self) -> None:
        assert activity_handler_registry.get(Action.Type.EMAIL) is EmailActivityHandler


class TestEmailActivityHandler(BaseWorkflowTest):
    def setUp(self) -> None:
        super().setUp()
        self.project = self.create_project()
        self.group, self.event, self.group_event = self.create_group_event()
        self.detector = self.create_detector(project=self.project)
        self.workflow = self.create_workflow()
        self.action = self.create_action(
            type=Action.Type.EMAIL,
            config={
                "target_type": 1,
                "target_identifier": str(self.user.id),
            },
        )

    def _make_invocation(self, event: GroupEvent | Activity) -> ActionInvocation:
        return ActionInvocation(
            event_data=WorkflowEventData(event=event, group=self.group),
            action=self.action,
            detector=self.detector,
            notification_uuid=str(uuid.uuid4()),
            workflow_id=self.workflow.id,
        )

    def test_invoke_action_raises_not_implemented(self) -> None:
        activity = self.create_group_activity(
            group=self.group, type=ActivityType.SEER_RCA_STARTED.value
        )
        invocation = self._make_invocation(activity)

        with pytest.raises(NotImplementedError):
            EmailActivityHandler.invoke_action(invocation=invocation, activity=activity)
