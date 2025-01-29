from unittest import mock

from sentry.grouping.grouptype import ErrorGroupType
from sentry.issues.grouptype import MetricIssuePOC
from sentry.workflow_engine.handlers.action.notification import NotificationActionHandler
from sentry.workflow_engine.models import Action
from sentry.workflow_engine.types import WorkflowJob
from tests.sentry.workflow_engine.test_base import BaseWorkflowTest


class TestNotificationActionHandler(BaseWorkflowTest):
    def setUp(self):
        super().setUp()
        self.project = self.create_project()
        self.detector = self.create_detector(project=self.project)
        self.action = Action(type=Action.Type.DISCORD)
        self.job = WorkflowJob({"event": {}})

    def test_execute_without_group_type(self):
        """Test that execute does nothing when detector has no group_type"""
        self.detector.type = None
        NotificationActionHandler.execute(self.job, self.action, self.detector)
        # Test passes if no exception is raised

    def test_execute_with_unregistered_group_type(self):
        """Test that execute handles unregistered group types gracefully"""

        class UnregisteredGroupType:
            slug = "unregistered"

        self.detector.type = UnregisteredGroupType
        self.detector.save()
        NotificationActionHandler.execute(self.job, self.action, self.detector)
        # Test passes if no exception is raised

    @mock.patch("sentry.workflow_engine.handlers.action.notification.invoke_issue_alert_registry")
    def test_execute_error_group_type(self, mock_issue_alert):
        """Test that execute calls correct handler for ErrorGroupType"""
        self.detector.type = ErrorGroupType.slug
        self.detector.save()
        NotificationActionHandler.execute(self.job, self.action, self.detector)

        mock_issue_alert.assert_called_once_with(self.job, self.action, self.detector)

    @mock.patch("sentry.workflow_engine.handlers.action.notification.invoke_metric_alert_registry")
    def test_execute_metric_alert_type(self, mock_metric_alert):
        """Test that execute calls correct handler for MetricAlertFire"""
        self.detector.type = MetricIssuePOC
        self.detector.save()
        NotificationActionHandler.execute(self.job, self.action, self.detector)

        mock_metric_alert.assert_called_once_with(self.job, self.action, self.detector)
