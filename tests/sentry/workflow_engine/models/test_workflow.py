from sentry.workflow_engine.models import Workflow
from sentry.workflow_engine.models.data_condition import Condition
from sentry.workflow_engine.types import WorkflowJob
from tests.sentry.workflow_engine.test_base import BaseWorkflowTest


class WorkflowTest(BaseWorkflowTest):
    def setUp(self):
        self.workflow, self.detector, self.detector_workflow, self.data_condition_group = (
            self.create_detector_and_workflow()
        )
        self.data_condition = self.data_condition_group.conditions.first()
        self.group, self.event, self.group_event = self.create_group_event()
        self.job = WorkflowJob({"event": self.group_event})

    def test_evaluate_trigger_conditions__condition_new_event__True(self):
        evaluation, _ = self.workflow.evaluate_trigger_conditions(self.job)
        assert evaluation is True

    def test_evaluate_trigger_conditions__condition_new_event__False(self):
        # Update event to have been seen before
        self.group_event.group.times_seen = 5

        evaluation, _ = self.workflow.evaluate_trigger_conditions(self.job)
        assert evaluation is False

    def test_evaluate_trigger_conditions__no_conditions(self):
        self.workflow.when_condition_group = None
        self.workflow.save()

        evaluation, _ = self.workflow.evaluate_trigger_conditions(self.job)
        assert evaluation is True

    def test_evaluate_trigger_conditions__slow_condition(self):
        # Update group to _all_, since the fast condition is met
        self.data_condition_group.update(logic_type="all")

        slow_condition = self.create_data_condition(
            type=Condition.EVENT_FREQUENCY_COUNT, comparison={"interval": "1d", "value": 7}
        )
        self.data_condition_group.conditions.add(slow_condition)
        evaluation, remaining_conditions = self.workflow.evaluate_trigger_conditions(self.job)

        assert evaluation is True
        assert remaining_conditions == [slow_condition]

    def test_full_clean(self):
        self.create_workflow(
            organization_id=self.organization.id,
            name="test",
            environment_id=None,
            when_condition_group=self.create_data_condition_group(),
            created_by_id=None,
            owner_user_id=None,
            owner_team=None,
            config={"frequency": 5},
        )

        workflow2 = Workflow(
            organization_id=self.organization.id,
            name="test2",
            environment_id=None,
            when_condition_group=self.create_data_condition_group(),
            created_by_id=None,
            owner_user_id=None,
            owner_team=None,
            config={"frequency": 5},
        )
        workflow2.full_clean()
