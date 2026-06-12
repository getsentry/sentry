from unittest import mock

from sentry.notifications.notification_action.activity_registry.slack import SlackActivityHandler
from sentry.notifications.notification_action.registry import activity_handler_registry
from sentry.notifications.platform.target import IntegrationNotificationTarget
from sentry.notifications.platform.types import (
    NotificationProviderKey,
    NotificationTargetResourceType,
)
from sentry.types.activity import ActivityType
from sentry.workflow_engine.models import Action
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
        self.group = self.create_group()
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

    @mock.patch(
        "sentry.notifications.notification_action.activity_registry.slack.send_activity_notification"
    )
    def test_invoke_action_channel(self, mock_send: mock.MagicMock) -> None:
        activity = self.create_group_activity(
            group=self.group,
            type=ActivityType.SEER_RCA_STARTED.value,
            data={"some_key": "some_value"},
        )
        invocation = self.create_action_invocation(
            event=activity,
            group=self.group,
            action=self.action,
            detector=self.detector,
            workflow_id=self.workflow.id,
        )

        SlackActivityHandler.invoke_action(invocation=invocation, activity=activity)

        mock_send.assert_called_once()
        call_args = mock_send.call_args
        assert call_args[0][0] is invocation
        assert call_args[0][1] is activity

        target = call_args[0][2]
        assert isinstance(target, IntegrationNotificationTarget)
        assert target.provider_key == NotificationProviderKey.SLACK
        assert target.resource_type == NotificationTargetResourceType.CHANNEL
        assert target.resource_id == "C12345"
        assert target.integration_id == self.integration.id
        assert target.organization_id == self.organization.id

    @mock.patch(
        "sentry.notifications.notification_action.activity_registry.slack.send_activity_notification"
    )
    def test_invoke_action_direct_message(self, mock_send: mock.MagicMock) -> None:
        self.action.config = {
            "target_identifier": "U12345",
            "target_display": "@user",
            "target_type": 0,
        }
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

        SlackActivityHandler.invoke_action(invocation=invocation, activity=activity)

        mock_send.assert_called_once()
        target = mock_send.call_args[0][2]
        assert isinstance(target, IntegrationNotificationTarget)
        assert target.resource_type == NotificationTargetResourceType.DIRECT_MESSAGE
        assert target.resource_id == "U12345"
