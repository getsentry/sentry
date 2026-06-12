from unittest import mock

from sentry.notifications.notification_action.activity_registry.msteams import (
    MSTeamsActivityHandler,
)
from sentry.notifications.notification_action.registry import activity_handler_registry
from sentry.notifications.platform.target import IntegrationNotificationTarget
from sentry.notifications.platform.types import (
    NotificationProviderKey,
)
from sentry.types.activity import ActivityType
from sentry.workflow_engine.models import Action
from tests.sentry.workflow_engine.test_base import BaseWorkflowTest


class TestMSTeamsActivityHandlerRegistration:
    def test_msteams_registered(self) -> None:
        assert activity_handler_registry.get(Action.Type.MSTEAMS) is MSTeamsActivityHandler


class TestMSTeamsActivityHandler(BaseWorkflowTest):
    def setUp(self) -> None:
        super().setUp()
        self.group = self.create_group()
        self.workflow, self.detector, _, _ = self.create_detector_and_workflow()
        self.integration = self.create_integration(
            organization=self.organization, provider="msteams", external_id="msteams_ext_id"
        )
        self.action = self.create_action(
            type=Action.Type.MSTEAMS,
            integration_id=self.integration.id,
            config={
                "target_display": "General",
                "target_type": 0,
            },
        )

    @mock.patch(
        "sentry.notifications.notification_action.activity_registry.msteams.send_activity_notification"
    )
    def test_invoke_action_uses_target_display(self, mock_send: mock.MagicMock) -> None:
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

        MSTeamsActivityHandler.invoke_action(invocation=invocation, activity=activity)

        mock_send.assert_called_once()
        target = mock_send.call_args[0][2]
        assert isinstance(target, IntegrationNotificationTarget)
        assert target.provider_key == NotificationProviderKey.MSTEAMS
        assert target.resource_id == "General"
