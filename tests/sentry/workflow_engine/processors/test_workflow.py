from sentry.workflow_engine.models.data_condition import Condition
from sentry.workflow_engine.processors.workflow import (
    evaluate_workflow_action_filters,
    process_workflows,
)
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


class TestEvaluateWorkflowActionFilters(BaseWorkflowTest):
    def setUp(self):
        (
            self.workflow,
            self.detector,
            self.detector_workflow,
            self.workflow_triggers,
        ) = self.create_detector_and_workflow()

        self.action_group, self.action = self.create_workflow_action(workflow=self.workflow)

        self.group, self.event, self.group_event = self.create_group_event(
            occurrence=self.build_occurrence_data(evidence_data={"detector_id": self.detector.id})
        )

    def test_basic__no_filter(self):
        triggered_actions = evaluate_workflow_action_filters({self.workflow}, self.group_event)
        assert set(triggered_actions) == {self.action}

    def test_basic__with_filter__passes(self):
        self.create_data_condition(
            condition_group=self.action_group,
            type=Condition.GROUP_EVENT_ATTR_COMPARISON,
            condition="group.times_seen",
            comparison=1,
            condition_result=True,
        )

        triggered_actions = evaluate_workflow_action_filters({self.workflow}, self.group_event)
        assert set(triggered_actions) == {self.action}

    def test_basic__with_filter__filtered(self):
        # Add a filter to the action's group
        self.create_data_condition(
            condition_group=self.action_group,
            type=Condition.GROUP_EVENT_ATTR_COMPARISON,
            condition="occurrence.evidence_data.detector_id",
            comparison=self.detector.id + 1,
        )

        triggered_actions = evaluate_workflow_action_filters({self.workflow}, self.group_event)
        assert not triggered_actions
