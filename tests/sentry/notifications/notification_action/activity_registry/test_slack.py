import uuid
from unittest import mock

import pytest

from sentry.models.activity import Activity
from sentry.notifications.notification_action.activity_registry.slack import SlackActivityHandler
from sentry.notifications.notification_action.registry import activity_handler_registry
from sentry.notifications.platform.target import IntegrationNotificationTarget
from sentry.notifications.platform.templates.workflow_engine import WorkflowEngineActivityAction
from sentry.notifications.platform.types import (
    NotificationProviderKey,
    NotificationTargetResourceType,
)
from sentry.services.eventstore.models import GroupEvent
from sentry.types.activity import ActivityType
from sentry.workflow_engine.models import Action
from sentry.workflow_engine.types import ActionInvocation, WorkflowEventData
from tests.sentry.workflow_engine.test_base import BaseWorkflowTest


class TestSlackActivityHandlerRegistration:
    def test_slack_registered(self) -> None:
        assert activity_handler_registry.get(Action.Type.SLACK) is SlackActivityHandler

    def test_slack_staging_registered(self) -> None:
        assert activity_handler_registry.get(Action.Type.SLACK_STAGING) is SlackActivityHandler


class TestSlackActivityHandler(BaseWorkflowTest):
    def setUp(self) -> None:
        super().setUp()
        self.project = self.create_project()
        self.group, self.event, self.group_event = self.create_group_event()
        self.detector = self.create_detector(project=self.project)
        self.workflow = self.create_workflow()
        self.integration = self.create_integration(
            organization=self.organization, provider="slack", external_id="slack_ext_id"
        )
        self.action = self.create_action(
            type=Action.Type.SLACK,
            integration_id=self.integration.id,
            config={
                "target_identifier": "C12345",
                "target_display": "#test-channel",
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
    def test_invoke_action_channel(self, mock_service_cls: mock.MagicMock) -> None:
        activity = self.create_group_activity(
            group=self.group,
            type=ActivityType.SEER_RCA_STARTED.value,
            data={"some_key": "some_value"},
        )
        invocation = self._make_invocation(activity)

        SlackActivityHandler.invoke_action(invocation=invocation, activity=activity)

        mock_subscripted = mock_service_cls.__getitem__.return_value
        mock_subscripted.assert_called_once()
        data = mock_subscripted.call_args[1]["data"]

        assert isinstance(data, WorkflowEngineActivityAction)
        assert data.workflow_id == self.workflow.id
        assert data.activity_type == ActivityType.SEER_RCA_STARTED.value
        assert data.activity_id == activity.id
        assert data.detector_id == self.detector.id

        mock_instance = mock_subscripted.return_value
        mock_instance.notify_sync.assert_called_once()
        targets = mock_instance.notify_sync.call_args[1]["targets"]

        assert len(targets) == 1
        target = targets[0]
        assert isinstance(target, IntegrationNotificationTarget)
        assert target.provider_key == NotificationProviderKey.SLACK
        assert target.resource_type == NotificationTargetResourceType.CHANNEL
        assert target.resource_id == "C12345"
        assert target.integration_id == self.integration.id
        assert target.organization_id == self.organization.id

    @mock.patch(
        "sentry.notifications.notification_action.activity_registry.base.NotificationService"
    )
    def test_invoke_action_direct_message(self, mock_service_cls: mock.MagicMock) -> None:
        self.action.config = {
            "target_identifier": "U12345",
            "target_display": "@user",
            "target_type": 0,
        }
        activity = self.create_group_activity(
            group=self.group,
            type=ActivityType.SEER_RCA_STARTED.value,
        )
        invocation = self._make_invocation(activity)

        SlackActivityHandler.invoke_action(invocation=invocation, activity=activity)

        mock_subscripted = mock_service_cls.__getitem__.return_value
        mock_instance = mock_subscripted.return_value
        mock_instance.notify_sync.assert_called_once()
        targets = mock_instance.notify_sync.call_args[1]["targets"]

        assert len(targets) == 1
        target = targets[0]
        assert isinstance(target, IntegrationNotificationTarget)
        assert target.resource_type == NotificationTargetResourceType.DIRECT_MESSAGE
        assert target.resource_id == "U12345"

    @mock.patch(
        "sentry.notifications.notification_action.activity_registry.base.NotificationService"
    )
    def test_invoke_action_slack_staging(self, mock_service_cls: mock.MagicMock) -> None:
        self.action = self.create_action(
            type=Action.Type.SLACK_STAGING,
            integration_id=self.integration.id,
            config={
                "target_identifier": "C12345",
                "target_display": "#test-channel",
                "target_type": 0,
            },
        )
        activity = self.create_group_activity(
            group=self.group,
            type=ActivityType.SEER_RCA_STARTED.value,
        )
        invocation = self._make_invocation(activity)

        SlackActivityHandler.invoke_action(invocation=invocation, activity=activity)

        mock_subscripted = mock_service_cls.__getitem__.return_value
        mock_instance = mock_subscripted.return_value
        mock_instance.notify_sync.assert_called_once()
        targets = mock_instance.notify_sync.call_args[1]["targets"]

        assert len(targets) == 1
        target = targets[0]
        assert target.provider_key == NotificationProviderKey.SLACK_STAGING

    def test_missing_target_identifier_raises(self) -> None:
        self.action.config = {"target_display": "#test", "target_type": 0}
        activity = self.create_group_activity(
            group=self.group, type=ActivityType.SEER_RCA_STARTED.value
        )
        invocation = self._make_invocation(activity)

        with pytest.raises(ValueError, match="No target_identifier"):
            SlackActivityHandler.invoke_action(invocation=invocation, activity=activity)

    def test_missing_integration_id_raises(self) -> None:
        self.action = self.create_action(
            type=Action.Type.SLACK,
            config={
                "target_identifier": "C12345",
                "target_display": "#test",
                "target_type": 0,
            },
        )
        activity = self.create_group_activity(
            group=self.group, type=ActivityType.SEER_RCA_STARTED.value
        )
        invocation = self._make_invocation(activity)

        with pytest.raises(ValueError, match="No integration_id"):
            SlackActivityHandler.invoke_action(invocation=invocation, activity=activity)
