from sentry.workflow_engine.models.data_condition import Condition
from sentry.workflow_engine.processors.action import evaluate_workflow_action_filters
from tests.sentry.workflow_engine.test_base import BaseWorkflowTest


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
            occurrence=self.build_occurrence(evidence_data={"detector_id": self.detector.id})
        )

    def test_basic__no_filter(self):
        triggered_actions = evaluate_workflow_action_filters({self.workflow}, self.group_event)
        assert set(triggered_actions) == {self.action}

    def test_basic__with_filter__passes(self):
        self.create_data_condition(
            condition_group=self.action_group,
            type=Condition.EVENT_SEEN_COUNT,
            comparison=1,
            condition_result=True,
        )

        triggered_actions = evaluate_workflow_action_filters({self.workflow}, self.group_event)
        assert set(triggered_actions) == {self.action}

    def test_basic__with_filter__filtered(self):
        # Add a filter to the action's group
        self.create_data_condition(
            condition_group=self.action_group,
            type=Condition.EVENT_CREATED_BY_DETECTOR,
            comparison=self.detector.id + 1,
        )

        triggered_actions = evaluate_workflow_action_filters({self.workflow}, self.group_event)
        assert not triggered_actions
