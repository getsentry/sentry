import uuid
from unittest.mock import Mock

from sentry.services.eventstore.models import GroupEvent
from sentry.testutils.cases import TestCase
from sentry.workflow_engine.models import Action
from sentry.workflow_engine.tasks.actions import build_trigger_action_task_params
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

        # Annotate workflow_id on action as the queryset would
        setattr(action, "workflow_id", 42)

        params = build_trigger_action_task_params(action, event_data, {})

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

        # Annotate workflow_id on action as the queryset would
        setattr(action, "workflow_id", 42)

        expected_notification_uuid = str(uuid.uuid4())
        workflow_uuid_map = {42: expected_notification_uuid}

        params = build_trigger_action_task_params(action, event_data, workflow_uuid_map)

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

        # Annotate workflow_id on action
        setattr(action, "workflow_id", 42)

        # workflow_uuid_map has different workflow_id
        workflow_uuid_map = {99: str(uuid.uuid4())}

        params = build_trigger_action_task_params(action, event_data, workflow_uuid_map)

        assert params["action_id"] == 1
        assert params["workflow_id"] == 42
        assert "notification_uuid" not in params

    def test_build_trigger_action_task_params_no_workflow_id(self) -> None:
        mock_group_event = Mock(spec=GroupEvent)
        mock_group_event.event_id = "event-123"
        mock_group_event.occurrence_id = "occurrence-456"
        mock_group_event.group_id = self.group.id

        event_data = WorkflowEventData(event=mock_group_event, group=self.group)
        action = Action(id=1, type=Action.Type.SLACK)

        # No workflow_id annotation

        workflow_uuid_map = {42: str(uuid.uuid4())}

        params = build_trigger_action_task_params(action, event_data, workflow_uuid_map)

        assert params["action_id"] == 1
        assert params["workflow_id"] is None
        assert "notification_uuid" not in params
