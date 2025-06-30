from unittest import mock

import pytest

from sentry.grouping.grouptype import ErrorGroupType
from sentry.issues.grouptype import MetricIssuePOC
from sentry.utils.registry import NoRegistrationExistsError
from sentry.workflow_engine.models import Action
from sentry.workflow_engine.types import WorkflowEventData
from tests.sentry.workflow_engine.test_base import BaseWorkflowTest


class TestNotificationActionHandler(BaseWorkflowTest):
    def setUp(self):
        super().setUp()
        self.project = self.create_project()
        self.detector = self.create_detector(project=self.project)
        self.action = Action(type=Action.Type.DISCORD)
        self.group, self.event, self.group_event = self.create_group_event()
        self.event_data = WorkflowEventData(event=self.group_event, group=self.group)

    def test_execute_without_group_type(self):
        """Test that execute does nothing when detector has no group_type"""
        self.detector.type = ""
        with pytest.raises(NoRegistrationExistsError):
            self.action.trigger(self.event_data, self.detector)
        # Test passes if no exception is raised

    @mock.patch(
        "sentry.notifications.notification_action.registry.group_type_notification_registry.get"
    )
    def test_execute_error_group_type(self, mock_registry_get):
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
    def test_execute_metric_alert_type(self, mock_registry_get):
        """Test that execute calls correct handler for MetricIssuePOC"""
        self.detector.type = MetricIssuePOC.slug
        self.detector.save()

        mock_handler = mock.Mock()
        mock_registry_get.return_value = mock_handler

        self.action.trigger(self.event_data, self.detector)

        mock_registry_get.assert_called_once_with(MetricIssuePOC.slug)
        mock_handler.handle_workflow_action.assert_called_once_with(
            self.event_data, self.action, self.detector
        )

    @mock.patch(
        "sentry.notifications.notification_action.registry.group_type_notification_registry.get",
        side_effect=NoRegistrationExistsError,
    )
    @mock.patch("sentry.notifications.notification_action.utils.logger")
    def test_execute_unknown_group_type(self, mock_logger, mock_registry_get):
        """Test that execute does nothing when detector has no group_type"""
        with pytest.raises(NoRegistrationExistsError):
            self.action.trigger(self.event_data, self.detector)

        mock_logger.exception.assert_called_once_with(
            "No notification handler found for detector type: %s",
            self.detector.type,
            extra={"detector_id": self.detector.id, "action_id": self.action.id},
        )
