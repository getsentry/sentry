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
            invocation = ActionInvocation(
                event_data=self.event_data,
                action=self.action,
                detector=self.detector,
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
        "sentry.notifications.notification_action.registry.metric_alert_handler_registry.get"
    )
    def test_handle_workflow_action_no_handler(self, mock_registry_get: mock.MagicMock) -> None:
        """Test that handle_workflow_action raises NoRegistrationExistsError when no handler exists"""
        mock_registry_get.side_effect = NoRegistrationExistsError()

        with pytest.raises(NoRegistrationExistsError):
            invocation = ActionInvocation(
                event_data=self.event_data,
                action=self.action,
                detector=self.detector,
            )
            MetricAlertRegistryHandler.handle_workflow_action(invocation)

    def test_handle_activity_update(self) -> None:
        self.event_data = WorkflowEventData(event=self.activity, group=self.group)

        with mock.patch.object(self.activity, "send_notification"):
            invocation = ActionInvocation(
                event_data=self.event_data,
                action=self.action,
                detector=self.detector,
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

        invocation = ActionInvocation(
            event_data=self.event_data,
            action=self.action,
            detector=self.detector,
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

        invocation = ActionInvocation(
            event_data=self.event_data,
            action=self.action,
            detector=self.detector,
        )
        execute_via_group_type_registry(invocation)
        mock_execute_via_issue_alert_handler.assert_called_once_with(invocation)
