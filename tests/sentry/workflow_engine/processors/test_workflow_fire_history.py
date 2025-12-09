from sentry.workflow_engine.models import Action, WorkflowFireHistory
from sentry.workflow_engine.processors.workflow_fire_history import create_workflow_fire_histories
from sentry.workflow_engine.types import WorkflowEventData
from tests.sentry.workflow_engine.test_base import BaseWorkflowTest


class TestWorkflowFireHistory(BaseWorkflowTest):
    def setUp(self) -> None:
        (
            self.workflow,
            self.detector,
            self.detector_workflow,
            self.workflow_triggers,
        ) = self.create_detector_and_workflow()

        self.action_group, self.action = self.create_workflow_action(workflow=self.workflow)

        self.group, self.event, self.group_event = self.create_group_event(
            occurrence=self.build_occurrence(evidence_data={"detector_id": self.detector.id})
        )
        self.event_data = WorkflowEventData(event=self.group_event, group=self.group)

    def test_create_workflow_fire_histories(self) -> None:
        create_workflow_fire_histories(
            Action.objects.filter(id=self.action.id),
            self.event_data,
            is_delayed=False,
        )
        assert (
            WorkflowFireHistory.objects.filter(
                detector=None,
                workflow=self.workflow,
                group=self.group,
                event_id=self.group_event.event_id,
            ).count()
            == 1
        )

    def test_create_workflow_fire_histories_only_canonical(self) -> None:
        initial_count = WorkflowFireHistory.objects.count()

        result = create_workflow_fire_histories(
            Action.objects.filter(id=self.action.id),
            self.event_data,
            is_delayed=False,
        )

        assert result == []
        assert WorkflowFireHistory.objects.count() == initial_count

        assert not WorkflowFireHistory.objects.filter(
            workflow=self.workflow,
            group=self.group,
            event_id=self.group_event.event_id,
        ).exists()
