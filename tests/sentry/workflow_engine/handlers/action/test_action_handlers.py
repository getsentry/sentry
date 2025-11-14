from typing import int
from unittest import mock

from sentry.grouping.grouptype import ErrorGroupType
from sentry.incidents.grouptype import MetricIssue
from sentry.utils.registry import NoRegistrationExistsError
from sentry.workflow_engine.models import Action
from sentry.workflow_engine.types import WorkflowEventData
from tests.sentry.workflow_engine.test_base import BaseWorkflowTest


class TestNotificationActionHandler(BaseWorkflowTest):
    def setUp(self) -> None:
        super().setUp()
        self.project = self.create_project()
        self.detector = self.create_detector(project=self.project)
        self.action = Action(type=Action.Type.DISCORD)
        self.group, self.event, self.group_event = self.create_group_event()
        self.event_data = WorkflowEventData(event=self.group_event, group=self.group)

    @mock.patch("sentry.notifications.notification_action.utils.execute_via_issue_alert_handler")
    def test_execute_without_group_type(
        self, mock_execute_via_issue_alert_handler: mock.MagicMock
    ) -> None:
        """Test that execute does nothing when detector has no group_type"""
        self.detector.type = ""
        self.action.trigger(self.event_data, self.detector)

        mock_execute_via_issue_alert_handler.assert_called_once_with(
            self.event_data, self.action, self.detector
        )

    @mock.patch(
        "sentry.notifications.notification_action.registry.group_type_notification_registry.get"
    )
    def test_execute_error_group_type(self, mock_registry_get: mock.MagicMock) -> None:
        """Test that execute calls correct handler for ErrorGroupType"""
        self.detector.type = ErrorGroupType.slug
        self.detector.save()

        mock_handler = mock.Mock()
        mock_registry_get.return_value = mock_handler

        self.action.trigger(self.event_data, self.detector)

        mock_registry_get.assert_called_once_with(ErrorGroupType.slug)
        mock_handler.handle_workflow_action.assert_called_once_with(
            self.event_data, self.action, self.detector
        )

    @mock.patch(
        "sentry.notifications.notification_action.registry.group_type_notification_registry.get"
    )
    def test_execute_metric_alert_type(self, mock_registry_get: mock.MagicMock) -> None:
        """Test that execute calls correct handler for MetricIssue"""
        self.detector.type = MetricIssue.slug
        self.detector.config = {"threshold_period": 1, "detection_type": "static"}
        self.detector.save()

        mock_handler = mock.Mock()
        mock_registry_get.return_value = mock_handler

        self.action.trigger(self.event_data, self.detector)

        mock_registry_get.assert_called_once_with(MetricIssue.slug)
        mock_handler.handle_workflow_action.assert_called_once_with(
            self.event_data, self.action, self.detector
        )

    @mock.patch("sentry.notifications.notification_action.utils.execute_via_issue_alert_handler")
    @mock.patch(
        "sentry.notifications.notification_action.registry.group_type_notification_registry.get",
        side_effect=NoRegistrationExistsError,
    )
    @mock.patch("sentry.notifications.notification_action.utils.logger")
    def test_execute_unknown_group_type(
        self,
        mock_logger: mock.MagicMock,
        mock_registry_get: mock.MagicMock,
        mock_execute_via_issue_alert_handler: mock.MagicMock,
    ) -> None:
        """Test that execute does nothing when detector has no group_type"""

        self.action.trigger(self.event_data, self.detector)

        mock_logger.warning.assert_called_once_with(
            "group_type_notification_registry.get.NoRegistrationExistsError",
            extra={"detector_id": self.detector.id, "action_id": self.action.id},
        )
