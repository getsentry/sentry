import uuid
from unittest.mock import Mock, patch

import pytest
from taskbroker_client.retry import RetryTaskError
from taskbroker_client.worker.workerchild import ProcessingDeadlineExceeded

from sentry.eventstream.base import GroupState
from sentry.services.eventstore.models import GroupEvent
from sentry.testutils.cases import TestCase
from sentry.workflow_engine.models import Action
from sentry.workflow_engine.tasks.actions import build_trigger_action_task_params, trigger_action
from sentry.workflow_engine.types import WorkflowEventData


class TestBuildTriggerActionTaskParams(TestCase):
    def setUp(self) -> None:
        self.project = self.create_project()
        self.group = self.create_group(project=self.project)

    def test_build_trigger_action_task_params_basic(self) -> None:
        mock_group_event = Mock(spec=GroupEvent)
        mock_group_event.event_id = "event-123"
        mock_group_event.occurrence_id = "occurrence-456"
        mock_group_event.group_id = self.group.id

        event_data = WorkflowEventData(event=mock_group_event, group=self.group)
        action = Action(id=1, type=Action.Type.SLACK)

        params = build_trigger_action_task_params(action, event_data, {}, workflow_id=42)

        assert params["action_id"] == 1
        assert params["workflow_id"] == 42
        assert params["event_id"] == "event-123"
        assert params["occurrence_id"] == "occurrence-456"
        assert params["group_id"] == self.group.id
        assert "notification_uuid" not in params

    def test_build_trigger_action_task_params_with_workflow_uuid_map(self) -> None:
        mock_group_event = Mock(spec=GroupEvent)
        mock_group_event.event_id = "event-123"
        mock_group_event.occurrence_id = "occurrence-456"
        mock_group_event.group_id = self.group.id

        event_data = WorkflowEventData(event=mock_group_event, group=self.group)
        action = Action(id=1, type=Action.Type.SLACK)

        expected_notification_uuid = str(uuid.uuid4())
        workflow_uuid_map = {42: expected_notification_uuid}

        params = build_trigger_action_task_params(
            action, event_data, workflow_uuid_map, workflow_id=42
        )

        assert params["action_id"] == 1
        assert params["workflow_id"] == 42
        assert params["notification_uuid"] == expected_notification_uuid

    def test_build_trigger_action_task_params_workflow_not_in_map(self) -> None:
        mock_group_event = Mock(spec=GroupEvent)
        mock_group_event.event_id = "event-123"
        mock_group_event.occurrence_id = "occurrence-456"
        mock_group_event.group_id = self.group.id

        event_data = WorkflowEventData(event=mock_group_event, group=self.group)
        action = Action(id=1, type=Action.Type.SLACK)

        workflow_uuid_map = {99: str(uuid.uuid4())}

        params = build_trigger_action_task_params(
            action, event_data, workflow_uuid_map, workflow_id=42
        )

        assert params["action_id"] == 1
        assert params["workflow_id"] == 42
        assert "notification_uuid" not in params


class TestTriggerAction(TestCase):
    def call_trigger_action(self, action: Mock, retries_remaining: bool) -> None:
        event_data = Mock()
        detector = Mock(type="error")

        with (
            patch("sentry.workflow_engine.tasks.actions.Action.objects.get", return_value=action),
            patch(
                "sentry.workflow_engine.tasks.actions.build_workflow_event_data_from_event",
                return_value=event_data,
            ),
            patch(
                "sentry.workflow_engine.processors.detector.get_preferred_detector",
                return_value=detector,
            ),
            patch(
                "taskbroker_client.retry.current_task",
                return_value=Mock(retries_remaining=retries_remaining),
            ),
        ):
            trigger_action(
                action_id=action.id,
                workflow_id=1,
                event_id="event-id",
                activity_id=None,
                group_id=1,
                occurrence_id=None,
                group_state=GroupState(
                    id=1,
                    is_new=True,
                    is_regression=False,
                    is_new_group_environment=False,
                ),
                has_escalated=False,
            )

    @patch("sentry.workflow_engine.tasks.actions.sentry_sdk.capture_exception")
    def test_reports_and_suppresses_trigger_exception_on_final_attempt(
        self, mock_capture_exception: Mock
    ) -> None:
        error = RuntimeError("action failed")
        action = Mock(id=1, type=Action.Type.SLACK)
        action.trigger.side_effect = error

        self.call_trigger_action(action, retries_remaining=False)

        mock_capture_exception.assert_called_once_with(error)

    @patch("sentry.workflow_engine.tasks.actions.sentry_sdk.capture_exception")
    def test_reports_and_suppresses_processing_deadline_on_final_attempt(
        self, mock_capture_exception: Mock
    ) -> None:
        error = ProcessingDeadlineExceeded("action timed out")
        action = Mock(id=1, type=Action.Type.SLACK)
        action.trigger.side_effect = error

        self.call_trigger_action(action, retries_remaining=False)

        mock_capture_exception.assert_called_once_with(error)

    @patch("sentry.workflow_engine.tasks.actions.sentry_sdk.capture_exception")
    def test_suppresses_ignored_trigger_exception(self, mock_capture_exception: Mock) -> None:
        action = Mock(id=1, type=Action.Type.SLACK)
        action.trigger.side_effect = Action.DoesNotExist()

        self.call_trigger_action(action, retries_remaining=True)

        mock_capture_exception.assert_not_called()

    @patch("sentry.workflow_engine.tasks.actions.sentry_sdk.capture_exception")
    def test_raises_trigger_exception_when_retries_remain(
        self, mock_capture_exception: Mock
    ) -> None:
        error = RuntimeError("action failed")
        action = Mock(id=1, type=Action.Type.SLACK)
        action.trigger.side_effect = error

        with pytest.raises(RetryTaskError):
            self.call_trigger_action(action, retries_remaining=True)

        mock_capture_exception.assert_not_called()

    @patch("sentry.workflow_engine.tasks.actions.sentry_sdk.capture_exception")
    def test_raises_processing_deadline_when_retries_remain(
        self, mock_capture_exception: Mock
    ) -> None:
        action = Mock(id=1, type=Action.Type.SLACK)
        action.trigger.side_effect = ProcessingDeadlineExceeded("action timed out")

        with pytest.raises(RetryTaskError):
            self.call_trigger_action(action, retries_remaining=True)

        mock_capture_exception.assert_not_called()
