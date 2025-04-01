from unittest import mock

import pytest

from sentry.notifications.notification_action.exceptions import NotificationHandlerException
from sentry.notifications.notification_action.group_type_notification_registry.handlers.issue_alert_registry_handler import (
    IssueAlertRegistryHandler,
)
from sentry.notifications.notification_action.group_type_notification_registry.handlers.metric_alert_registry_handler import (
    MetricAlertRegistryHandler,
)
from sentry.utils.registry import NoRegistrationExistsError
from sentry.workflow_engine.models import Action
from sentry.workflow_engine.types import WorkflowEventData
from tests.sentry.workflow_engine.test_base import BaseWorkflowTest


class TestIssueAlertRegistryInvoker(BaseWorkflowTest):
    def setUp(self):
        super().setUp()
        self.project = self.create_project()
        self.detector = self.create_detector(project=self.project)
        self.action = Action(type=Action.Type.DISCORD)
        self.group, self.event, self.group_event = self.create_group_event()
        self.event_data = WorkflowEventData(event=self.group_event)

    @mock.patch(
        "sentry.notifications.notification_action.registry.issue_alert_handler_registry.get"
    )
    def test_handle_workflow_action_no_handler(self, mock_registry_get):
        """Test that handle_workflow_action raises NoRegistrationExistsError when no handler exists"""
        mock_registry_get.side_effect = NoRegistrationExistsError()

        with pytest.raises(NoRegistrationExistsError):
            IssueAlertRegistryHandler.handle_workflow_action(
                self.event_data, self.action, self.detector
            )

    @mock.patch(
        "sentry.notifications.notification_action.registry.issue_alert_handler_registry.get"
    )
    @mock.patch(
        "sentry.notifications.notification_action.group_type_notification_registry.handlers.issue_alert_registry_handler.logger"
    )
    def test_handle_workflow_action_general_exception(self, mock_logger, mock_registry_get):
        """Test that handle_workflow_action wraps general exceptions in NotificationHandlerException"""
        mock_handler = mock.Mock()
        mock_handler.invoke_legacy_registry.side_effect = Exception("Something went wrong")
        mock_registry_get.return_value = mock_handler

        with pytest.raises(NotificationHandlerException):
            IssueAlertRegistryHandler.handle_workflow_action(
                self.event_data, self.action, self.detector
            )

        mock_logger.exception.assert_called_once_with(
            "Error invoking issue alert handler",
            extra={"action_id": self.action.id},
        )


class TestMetricAlertRegistryInvoker(BaseWorkflowTest):
    def setUp(self):
        super().setUp()
        self.project = self.create_project()
        self.detector = self.create_detector(project=self.project)
        self.action = Action(type=Action.Type.DISCORD)
        self.group, self.event, self.group_event = self.create_group_event()
        self.event_data = WorkflowEventData(event=self.group_event)

    @mock.patch(
        "sentry.notifications.notification_action.registry.metric_alert_handler_registry.get"
    )
    def test_handle_workflow_action_no_handler(self, mock_registry_get):
        """Test that handle_workflow_action raises NoRegistrationExistsError when no handler exists"""
        mock_registry_get.side_effect = NoRegistrationExistsError()

        with pytest.raises(NoRegistrationExistsError):
            MetricAlertRegistryHandler.handle_workflow_action(
                self.event_data, self.action, self.detector
            )

    @mock.patch(
        "sentry.notifications.notification_action.registry.metric_alert_handler_registry.get"
    )
    @mock.patch(
        "sentry.notifications.notification_action.group_type_notification_registry.handlers.metric_alert_registry_handler.logger"
    )
    def test_handle_workflow_action_general_exception(self, mock_logger, mock_registry_get):
        """Test that handle_workflow_action wraps general exceptions in NotificationHandlerException"""
        mock_handler = mock.Mock()
        mock_handler.invoke_legacy_registry.side_effect = Exception("Something went wrong")
        mock_registry_get.return_value = mock_handler

        with pytest.raises(NotificationHandlerException):
            MetricAlertRegistryHandler.handle_workflow_action(
                self.event_data, self.action, self.detector
            )

        mock_logger.exception.assert_called_once_with(
            "Error invoking metric alert handler",
            extra={"action_id": self.action.id},
        )
