import uuid
from unittest import mock

import pytest

from sentry.incidents.grouptype import MetricIssue
from sentry.notifications.notification_action.group_type_notification_registry.handlers.issue_alert_registry_handler import (
    IssueAlertRegistryHandler,
)
from sentry.notifications.notification_action.group_type_notification_registry.handlers.metric_alert_registry_handler import (
    MetricAlertRegistryHandler,
)
from sentry.notifications.notification_action.grouptype import SendTestNotification
from sentry.notifications.notification_action.utils import execute_via_group_type_registry
from sentry.types.activity import ActivityType
from sentry.utils.registry import NoRegistrationExistsError
from sentry.workflow_engine.models import Action
from sentry.workflow_engine.types import ActionInvocation, WorkflowEventData
from tests.sentry.workflow_engine.test_base import BaseWorkflowTest


class TestIssueAlertRegistryInvoker(BaseWorkflowTest):
    def setUp(self) -> None:
        super().setUp()
        self.project = self.create_project()
        self.detector = self.create_detector(project=self.project)
        self.action = Action(type=Action.Type.DISCORD)
        self.group, self.event, self.group_event = self.create_group_event()
        self.event_data = WorkflowEventData(event=self.group_event, group=self.group)

    @mock.patch(
        "sentry.notifications.notification_action.registry.issue_alert_handler_registry.get"
    )
    def test_handle_workflow_action_no_handler(self, mock_registry_get: mock.MagicMock) -> None:
        """Test that handle_workflow_action raises NoRegistrationExistsError when no handler exists"""
        mock_registry_get.side_effect = NoRegistrationExistsError()

        with pytest.raises(NoRegistrationExistsError):
            notification_uuid = str(uuid.uuid4())

            invocation = ActionInvocation(
                event_data=self.event_data,
                action=self.action,
                detector=self.detector,
                notification_uuid=notification_uuid,
            )
            IssueAlertRegistryHandler.handle_workflow_action(invocation)


class TestMetricAlertRegistryInvoker(BaseWorkflowTest):
    def setUp(self) -> None:
        super().setUp()
        self.project = self.create_project()
        self.detector = self.create_detector(project=self.project)
        self.action = Action(type=Action.Type.DISCORD)
        self.group, self.event, self.group_event = self.create_group_event()
        self.event_data = WorkflowEventData(event=self.group_event, group=self.group)

    @mock.patch(
        "sentry.notifications.notification_action.registry.issue_alert_handler_registry.get"
    )
    @mock.patch(
        "sentry.notifications.notification_action.registry.metric_alert_handler_registry.get"
    )
    def test_handle_workflow_action_no_handler(
        self, mock_metric_registry_get: mock.MagicMock, mock_issue_registry_get: mock.MagicMock
    ) -> None:
        """Test that handle_workflow_action raises NoRegistrationExistsError when no handler exists in either registry"""
        mock_metric_registry_get.side_effect = NoRegistrationExistsError()
        mock_issue_registry_get.side_effect = NoRegistrationExistsError()

        with pytest.raises(NoRegistrationExistsError):
            notification_uuid = str(uuid.uuid4())

            invocation = ActionInvocation(
                event_data=self.event_data,
                action=self.action,
                detector=self.detector,
                notification_uuid=notification_uuid,
            )
            MetricAlertRegistryHandler.handle_workflow_action(invocation)

    @mock.patch(
        "sentry.notifications.notification_action.registry.issue_alert_handler_registry.get"
    )
    @mock.patch(
        "sentry.notifications.notification_action.registry.metric_alert_handler_registry.get"
    )
    def test_handle_workflow_action_fallback_to_issue_alert(
        self, mock_metric_registry_get: mock.MagicMock, mock_issue_registry_get: mock.MagicMock
    ) -> None:
        """Test that handle_workflow_action falls back to issue alert handler for unsupported action types"""
        # Simulate plugin action type not being in metric alert registry
        mock_metric_registry_get.side_effect = NoRegistrationExistsError()
        mock_issue_handler = mock.MagicMock()
        mock_issue_registry_get.return_value = mock_issue_handler

        self.action.type = Action.Type.PLUGIN
        notification_uuid = str(uuid.uuid4())

        invocation = ActionInvocation(
            event_data=self.event_data,
            action=self.action,
            detector=self.detector,
            notification_uuid=notification_uuid,
        )
        MetricAlertRegistryHandler.handle_workflow_action(invocation)

        # Verify that issue alert handler was called
        mock_issue_registry_get.assert_called_once_with(Action.Type.PLUGIN)
        mock_issue_handler.invoke_legacy_registry.assert_called_once_with(invocation)

    def test_handle_activity_update(self) -> None:
        self.event_data = WorkflowEventData(event=self.activity, group=self.group)

        with mock.patch.object(self.activity, "send_notification"):
            notification_uuid = str(uuid.uuid4())

            invocation = ActionInvocation(
                event_data=self.event_data,
                action=self.action,
                detector=self.detector,
                notification_uuid=notification_uuid,
            )
            execute_via_group_type_registry(invocation)
            self.activity.send_notification.assert_called_once_with()

    @mock.patch("sentry.notifications.notification_action.utils.execute_via_metric_alert_handler")
    def test_handle_metric_issue_resolution(self, mock_execute_metric_alert_handler) -> None:
        group = self.create_group(type=MetricIssue.type_id)
        activity = self.create_group_activity(
            group=group,
            type=ActivityType.SET_RESOLVED.value,
        )
        self.event_data = WorkflowEventData(event=activity, group=group)

        notification_uuid = str(uuid.uuid4())

        invocation = ActionInvocation(
            event_data=self.event_data,
            action=self.action,
            detector=self.detector,
            notification_uuid=notification_uuid,
        )
        execute_via_group_type_registry(invocation)
        mock_execute_metric_alert_handler.assert_called_once_with(invocation)


class TestGroupTypeNotificationRegistryHandler(BaseWorkflowTest):
    def setUp(self) -> None:
        super().setUp()
        self.project = self.create_project()
        self.detector = self.create_detector(project=self.project, type=SendTestNotification.slug)
        self.action = Action(type=Action.Type.DISCORD)
        self.group, self.event, self.group_event = self.create_group_event(
            group_type_id=SendTestNotification.type_id
        )
        self.event_data = WorkflowEventData(event=self.group_event, group=self.group)

    @mock.patch("sentry.notifications.notification_action.utils.execute_via_issue_alert_handler")
    def test_handle_workflow_action_no_handler(
        self, mock_execute_via_issue_alert_handler: mock.MagicMock
    ) -> None:
        """Test that handle_workflow_action invokes the when no handler exists"""

        notification_uuid = str(uuid.uuid4())

        invocation = ActionInvocation(
            event_data=self.event_data,
            action=self.action,
            detector=self.detector,
            notification_uuid=notification_uuid,
        )
        execute_via_group_type_registry(invocation)
        mock_execute_via_issue_alert_handler.assert_called_once_with(invocation)
