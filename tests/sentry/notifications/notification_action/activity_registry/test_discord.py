import uuid
from unittest import mock

import pytest

from sentry.models.activity import Activity
from sentry.notifications.notification_action.activity_registry.discord import (
    DiscordActivityHandler,
)
from sentry.notifications.notification_action.registry import activity_handler_registry
from sentry.notifications.platform.target import IntegrationNotificationTarget
from sentry.notifications.platform.types import (
    NotificationProviderKey,
    NotificationTargetResourceType,
)
from sentry.services.eventstore.models import GroupEvent
from sentry.types.activity import ActivityType
from sentry.workflow_engine.models import Action
from sentry.workflow_engine.types import ActionInvocation, WorkflowEventData
from tests.sentry.workflow_engine.test_base import BaseWorkflowTest


class TestDiscordActivityHandlerRegistration:
    def test_discord_registered(self) -> None:
        assert activity_handler_registry.get(Action.Type.DISCORD) is DiscordActivityHandler


class TestDiscordActivityHandler(BaseWorkflowTest):
    def setUp(self) -> None:
        super().setUp()
        self.project = self.create_project()
        self.group, self.event, self.group_event = self.create_group_event()
        self.detector = self.create_detector(project=self.project)
        self.workflow = self.create_workflow()
        self.integration = self.create_integration(
            organization=self.organization, provider="discord", external_id="discord_ext_id"
        )
        self.action = self.create_action(
            type=Action.Type.DISCORD,
            integration_id=self.integration.id,
            config={
                "target_identifier": "987654321",
                "target_type": 0,
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

    @mock.patch(
        "sentry.notifications.notification_action.activity_registry.base.NotificationService"
    )
    def test_invoke_action_sends_notification(self, mock_service_cls: mock.MagicMock) -> None:
        activity = self.create_group_activity(
            group=self.group,
            type=ActivityType.SEER_RCA_STARTED.value,
            data={"some_key": "some_value"},
        )
        invocation = self._make_invocation(activity)

        DiscordActivityHandler.invoke_action(invocation=invocation, activity=activity)

        mock_subscripted = mock_service_cls.__getitem__.return_value
        mock_subscripted.assert_called_once()

        mock_instance = mock_subscripted.return_value
        mock_instance.notify_sync.assert_called_once()
        targets = mock_instance.notify_sync.call_args[1]["targets"]

        assert len(targets) == 1
        target = targets[0]
        assert isinstance(target, IntegrationNotificationTarget)
        assert target.provider_key == NotificationProviderKey.DISCORD
        assert target.resource_type == NotificationTargetResourceType.CHANNEL
        assert target.resource_id == "987654321"

    def test_missing_target_identifier_raises(self) -> None:
        activity = self.create_group_activity(
            group=self.group, type=ActivityType.SEER_RCA_STARTED.value
        )
        self.action.config = {"target_type": 0}
        invocation = self._make_invocation(activity)

        with pytest.raises(ValueError, match="No target_identifier"):
            DiscordActivityHandler.invoke_action(invocation=invocation, activity=activity)
