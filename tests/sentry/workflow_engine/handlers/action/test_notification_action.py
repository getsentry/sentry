from unittest import mock

import pytest

from sentry.grouping.grouptype import ErrorGroupType
from sentry.issues.grouptype import MetricIssuePOC
from sentry.utils.registry import NoRegistrationExistsError
from sentry.workflow_engine.handlers.action.notification.handler import (
    IssueAlertRegistryInvoker,
    NotificationActionHandler,
    NotificationHandlerException,
)
from sentry.workflow_engine.models import Action
from sentry.workflow_engine.types import WorkflowJob
from tests.sentry.workflow_engine.test_base import BaseWorkflowTest


class TestNotificationActionHandler(BaseWorkflowTest):
    def setUp(self):
        super().setUp()
        self.project = self.create_project()
        self.detector = self.create_detector(project=self.project)
        self.action = Action(type=Action.Type.DISCORD)
        self.group, self.event, self.group_event = self.create_group_event()
        self.job = WorkflowJob({"event": self.group_event})

    def test_execute_without_group_type(self):
        """Test that execute does nothing when detector has no group_type"""
        self.detector.type = ""
        NotificationActionHandler.execute(self.job, self.action, self.detector)
        # Test passes if no exception is raised

    @mock.patch(
        "sentry.workflow_engine.handlers.action.notification.handler.group_type_notification_registry.get"
    )
    def test_execute_error_group_type(self, mock_registry_get):
        """Test that execute calls correct handler for ErrorGroupType"""
        self.detector.type = ErrorGroupType.slug
        self.detector.save()

        mock_handler = mock.Mock()
        mock_registry_get.return_value = mock_handler

        NotificationActionHandler.execute(self.job, self.action, self.detector)

        mock_registry_get.assert_called_once_with(ErrorGroupType.slug)
        mock_handler.handle_workflow_action.assert_called_once_with(
            self.job, self.action, self.detector
        )

    @mock.patch(
        "sentry.workflow_engine.handlers.action.notification.handler.group_type_notification_registry.get"
    )
    def test_execute_metric_alert_type(self, mock_registry_get):
        """Test that execute calls correct handler for MetricIssuePOC"""
        self.detector.type = MetricIssuePOC.slug
        self.detector.save()

        mock_handler = mock.Mock()
        mock_registry_get.return_value = mock_handler

        NotificationActionHandler.execute(self.job, self.action, self.detector)

        mock_registry_get.assert_called_once_with(MetricIssuePOC.slug)
        mock_handler.handle_workflow_action.assert_called_once_with(
            self.job, self.action, self.detector
        )

    @mock.patch(
        "sentry.workflow_engine.handlers.action.notification.handler.group_type_notification_registry.get",
        side_effect=NoRegistrationExistsError,
    )
    @mock.patch("sentry.workflow_engine.handlers.action.notification.handler.logger")
    def test_execute_unknown_group_type(self, mock_logger, mock_registry_get):
        """Test that execute does nothing when detector has no group_type"""
        NotificationActionHandler.execute(self.job, self.action, self.detector)

        mock_logger.exception.assert_called_once_with(
            "No notification handler found for detector type: %s",
            self.detector.type,
            extra={"detector_id": self.detector.id, "action_id": self.action.id},
        )


class TestIssueAlertRegistryInvoker(BaseWorkflowTest):
    def setUp(self):
        super().setUp()
        self.project = self.create_project()
        self.detector = self.create_detector(project=self.project)
        self.action = Action(type=Action.Type.DISCORD)
        self.group, self.event, self.group_event = self.create_group_event()
        self.job = WorkflowJob({"event": self.group_event})

    @mock.patch(
        "sentry.workflow_engine.handlers.action.notification.handler.issue_alert_handler_registry.get"
    )
    def test_handle_workflow_action_no_handler(self, mock_registry_get):
        """Test that handle_workflow_action raises NoRegistrationExistsError when no handler exists"""
        mock_registry_get.side_effect = NoRegistrationExistsError()

        with pytest.raises(NoRegistrationExistsError):
            IssueAlertRegistryInvoker.handle_workflow_action(self.job, self.action, self.detector)

    @mock.patch(
        "sentry.workflow_engine.handlers.action.notification.handler.issue_alert_handler_registry.get"
    )
    @mock.patch("sentry.workflow_engine.handlers.action.notification.handler.logger")
    def test_handle_workflow_action_general_exception(self, mock_logger, mock_registry_get):
        """Test that handle_workflow_action wraps general exceptions in NotificationHandlerException"""
        mock_handler = mock.Mock()
        mock_handler.invoke_legacy_registry.side_effect = Exception("Something went wrong")
        mock_registry_get.return_value = mock_handler

        with pytest.raises(NotificationHandlerException):
            IssueAlertRegistryInvoker.handle_workflow_action(self.job, self.action, self.detector)

        mock_logger.exception.assert_called_once_with(
            "Error invoking issue alert handler",
            extra={"action_id": self.action.id},
        )
