from unittest import mock

from sentry.notifications.notification_action.activity_registry.email import EmailActivityHandler
from sentry.notifications.notification_action.registry import activity_handler_registry
from sentry.notifications.platform.target import GenericNotificationTarget
from sentry.notifications.platform.types import (
    NotificationProviderKey,
    NotificationTargetResourceType,
)
from sentry.types.activity import ActivityType
from sentry.workflow_engine.models import Action
from tests.sentry.workflow_engine.test_base import BaseWorkflowTest


class TestEmailActivityHandlerRegistration:
    def test_email_registered(self) -> None:
        assert activity_handler_registry.get(Action.Type.EMAIL) is EmailActivityHandler


class TestEmailActivityHandler(BaseWorkflowTest):
    def setUp(self) -> None:
        super().setUp()
        self.group = self.create_group()
        self.workflow, self.detector, _, _ = self.create_detector_and_workflow()
        self.action = self.create_action(
            type=Action.Type.EMAIL,
            config={
                "target_type": 1,
                "target_identifier": str(self.user.id),
            },
        )

    @mock.patch(
        "sentry.notifications.notification_action.activity_registry.email.send_activity_notification"
    )
    def test_invoke_action(self, mock_send: mock.MagicMock) -> None:
        activity = self.create_group_activity(
            group=self.group,
            type=ActivityType.SEER_RCA_STARTED.value,
        )
        invocation = self.create_action_invocation(
            event=activity,
            group=self.group,
            action=self.action,
            detector=self.detector,
            workflow_id=self.workflow.id,
        )

        EmailActivityHandler.invoke_action(invocation=invocation, activity=activity)

        mock_send.assert_called_once()
        call_args = mock_send.call_args
        assert call_args[0][0] is invocation
        assert call_args[0][1] is activity

        target = call_args[0][2]
        assert isinstance(target, GenericNotificationTarget)
        assert target.provider_key == NotificationProviderKey.EMAIL
        assert target.resource_type == NotificationTargetResourceType.EMAIL
        assert target.resource_id == str(self.user.id)
