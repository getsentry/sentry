from unittest import mock

from sentry.grouping.grouptype import ErrorGroupType
from sentry.incidents.grouptype import MetricIssue
from sentry.types.group import PriorityLevel
from sentry.utils.registry import NoRegistrationExistsError
from sentry.workflow_engine.models import Action
from sentry.workflow_engine.types import ActionInvocation, WorkflowEventData
from tests.sentry.notifications.notification_action.test_metric_alert_registry_handlers import (
    MetricAlertHandlerBase,
)


class TestNotificationActionHandler(MetricAlertHandlerBase):
    def setUp(self) -> None:
        super().setUp()
        self.project = self.create_project()
        self.detector = self.create_detector(project=self.project)
        self.action = Action(type=Action.Type.DISCORD)
        self.group, self.event, self.group_event = self.create_group_event()
        self.event_data = WorkflowEventData(event=self.group_event, group=self.group)

    @mock.patch(
        "sentry.notifications.notification_action.registry.group_type_notification_registry.get"
    )
    def test_execute_error_group_type(self, mock_registry_get: mock.MagicMock) -> None:
        """Test that execute calls correct handler for ErrorGroupType"""
        self.detector.type = ErrorGroupType.slug
        self.detector.save()

        mock_handler = mock.Mock()
        mock_registry_get.return_value = mock_handler

        self.action.trigger(self.event_data)

        mock_registry_get.assert_called_once_with(ErrorGroupType.slug)
        assert mock_handler.handle_workflow_action.call_count == 1
        invocation = mock_handler.handle_workflow_action.call_args[0][0]
        assert isinstance(invocation, ActionInvocation)
        assert invocation.event_data == self.event_data
        assert invocation.action == self.action
        assert invocation.detector == self.detector

    @mock.patch(
        "sentry.notifications.notification_action.registry.group_type_notification_registry.get"
    )
    def test_execute_metric_alert_type(self, mock_registry_get: mock.MagicMock) -> None:
        """Test that execute calls correct handler for MetricIssue"""
        self.detector.type = MetricIssue.slug
        self.detector.config = {"threshold_period": 1, "detection_type": "static"}
        self.detector.save()

        self.group.type = MetricIssue.type_id
        self.group.save()

        group, _, group_event = self.create_group_event(
            group_type_id=MetricIssue.type_id,
            occurrence=self.create_issue_occurrence(
                priority=PriorityLevel.HIGH.value,
                level="error",
                evidence_data={
                    "detector_id": self.detector.id,
                },
            ),
        )
        self.event_data = WorkflowEventData(event=group_event, group=group)

        mock_handler = mock.Mock()
        mock_registry_get.return_value = mock_handler

        self.action.trigger(self.event_data)

        mock_registry_get.assert_called_once_with(MetricIssue.slug)
        assert mock_handler.handle_workflow_action.call_count == 1
        invocation = mock_handler.handle_workflow_action.call_args[0][0]
        assert isinstance(invocation, ActionInvocation)
        assert invocation.event_data == self.event_data
        assert invocation.action == self.action
        assert invocation.detector == self.detector

    @mock.patch("sentry.notifications.notification_action.utils.execute_via_issue_alert_handler")
    @mock.patch(
        "sentry.notifications.notification_action.registry.group_type_notification_registry.get",
        side_effect=NoRegistrationExistsError,
    )
    @mock.patch("sentry.notifications.notification_action.utils.logger")
    def test_execute_unknown_detector(
        self,
        mock_logger: mock.MagicMock,
        mock_registry_get: mock.MagicMock,
        mock_execute_via_issue_alert_handler: mock.MagicMock,
    ) -> None:
        """Test that execute does nothing when we can't find the detector"""

        self.action.trigger(self.event_data)

        mock_logger.warning.assert_called_once_with(
            "group_type_notification_registry.get.NoRegistrationExistsError",
            extra={"detector_id": self.detector.id, "action_id": self.action.id},
        )
