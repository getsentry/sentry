from sentry.workflow_engine.models import DataConditionGroup
from sentry.workflow_engine.models.data_condition import Condition
from sentry.workflow_engine.processors.workflow import evaluate_workflow_triggers, process_workflows
from sentry.workflow_engine.types import DetectorType
from tests.sentry.workflow_engine.test_base import BaseWorkflowTest


class TestProcessWorkflows(BaseWorkflowTest):
    def setUp(self):
        (
            self.workflow,
            self.detector,
            self.detector_workflow,
            self.workflow_triggers,
        ) = self.create_detector_and_workflow()

        self.error_workflow, self.error_detector, self.detector_workflow_error, _ = (
            self.create_detector_and_workflow(
                name_prefix="error",
                workflow_triggers=self.create_data_condition_group(),
                detector_type=DetectorType.ERROR,
            )
        )

        self.group, self.event, self.group_event = self.create_group_event()

    def test_error_event(self):
        triggered_workflows = process_workflows(self.group_event)
        assert triggered_workflows == {self.error_workflow}

    def test_issue_occurrence_event(self):
        issue_occurrence = self.build_occurrence(evidence_data={"detector_id": self.detector.id})
        self.group_event.occurrence = issue_occurrence

        triggered_workflows = process_workflows(self.group_event)
        assert triggered_workflows == {self.workflow}


class TestEvaluateWorkflowTriggers(BaseWorkflowTest):
    def setUp(self):
        (
            self.workflow,
            self.detector,
            self.detector_workflow,
            self.workflow_triggers,
        ) = self.create_detector_and_workflow()

        occurrence = self.build_occurrence_data(evidence_data={"detector_id": self.detector.id})
        self.group, self.event, self.group_event = self.create_group_event(
            occurrence=occurrence,
        )

    def test_workflow_trigger(self):
        triggered_workflows = evaluate_workflow_triggers({self.workflow}, self.group_event)
        assert triggered_workflows == {self.workflow}

    def test_no_workflow_trigger(self):
        triggered_workflows = evaluate_workflow_triggers(set(), self.group_event)
        assert not triggered_workflows

    def test_workflow_many_filters(self):
        if self.workflow.when_condition_group is not None:
            self.workflow.when_condition_group.logic_type = DataConditionGroup.Type.ALL

        self.create_data_condition(
            condition_group=self.workflow.when_condition_group,
            type=Condition.GROUP_EVENT_ATTR_COMPARISON,
            condition="occurrence.evidence_data.detector_id",
            comparison=self.detector.id,
            condition_result=75,
        )

        triggered_workflows = evaluate_workflow_triggers({self.workflow}, self.group_event)
        assert triggered_workflows == {self.workflow}

    def test_workflow_filterd_out(self):
        if self.workflow.when_condition_group is not None:
            self.workflow.when_condition_group.logic_type = DataConditionGroup.Type.ALL

        self.create_data_condition(
            condition_group=self.workflow.when_condition_group,
            type=Condition.GROUP_EVENT_ATTR_COMPARISON,
            condition="occurrence.evidence_data.detector_id",
            comparison=self.detector.id + 1,
        )

        triggered_workflows = evaluate_workflow_triggers({self.workflow}, self.group_event)
        assert not triggered_workflows

    def test_many_workflows(self):
        workflow_two, _, _, _ = self.create_detector_and_workflow(name_prefix="two")
        triggered_workflows = evaluate_workflow_triggers(
            {self.workflow, workflow_two}, self.group_event
        )

        assert triggered_workflows == {self.workflow, workflow_two}
