from sentry.workflow_engine.processors.workflow import process_workflows
from sentry.workflow_engine.types import DetectorType
from tests.sentry.workflow_engine.test_base import BaseWorkflowTest


class TestProcessWorkflows(BaseWorkflowTest):
    def setUp(self):
        self.workflow, self.detector, self.detector_workflow, self.workflow_triggers = (
            self.create_detector_and_workflow()
        )
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
