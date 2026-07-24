from unittest import mock

from sentry.notifications.models.notificationaction import ActionTarget
from sentry.notifications.notification_action.activity_registry.email import EmailActivityHandler
from sentry.notifications.notification_action.registry import activity_handler_registry
from sentry.notifications.platform.strategies.issue_owners import (
    IssueOwnersActivityAlertStrategy,
)
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
                "target_type": ActionTarget.USER,
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

    @mock.patch(
        "sentry.notifications.notification_action.activity_registry.email.NotificationService"
    )
    @mock.patch(
        "sentry.notifications.notification_action.activity_registry.email.build_activity_notification_data"
    )
    def test_invoke_action_issue_owners(
        self,
        mock_build_data: mock.MagicMock,
        mock_notification_service: mock.MagicMock,
    ) -> None:
        self.action.config = {
            "target_type": ActionTarget.ISSUE_OWNERS,
        }
        self.action.save()

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

        mock_build_data.assert_called_once_with(activity, workflow_id=self.workflow.id)
        mock_service_instance = mock_notification_service.__getitem__.return_value.return_value
        mock_service_instance.notify_sync.assert_called_once()
        call_kwargs = mock_service_instance.notify_sync.call_args[1]
        strategy = call_kwargs["strategy"]
        assert isinstance(strategy, IssueOwnersActivityAlertStrategy)
        assert strategy.group == activity.group
