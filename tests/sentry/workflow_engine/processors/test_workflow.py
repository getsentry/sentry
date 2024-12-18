from unittest import mock

from sentry.issues.grouptype import ErrorGroupType
from sentry.workflow_engine.models import DataConditionGroup
from sentry.workflow_engine.models.data_condition import Condition
from sentry.workflow_engine.processors.workflow import evaluate_workflow_triggers, process_workflows
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
                detector_type=ErrorGroupType.slug,
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

    def test_no_detector(self):
        self.group_event.occurrence = self.build_occurrence(evidence_data={})

        with mock.patch("sentry.workflow_engine.processors.workflow.logger") as mock_logger:
            with mock.patch("sentry.workflow_engine.processors.workflow.metrics") as mock_metrics:
                triggered_workflows = process_workflows(self.group_event)

                assert not triggered_workflows

                mock_metrics.incr.assert_called_once_with("workflow_engine.process_workflows.error")
                mock_logger.exception.assert_called_once_with(
                    "Detector not found for event",
                    extra={"event_id": self.event.event_id},
                )


class TestEvaluateWorkflowTriggers(BaseWorkflowTest):
    def setUp(self):
        (
            self.workflow,
            self.detector,
            self.detector_workflow,
            self.workflow_triggers,
        ) = self.create_detector_and_workflow()

        occurrence = self.build_occurrence(evidence_data={"detector_id": self.detector.id})
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
            type=Condition.EVENT_CREATED_BY_DETECTOR,
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
            type=Condition.EVENT_CREATED_BY_DETECTOR,
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
