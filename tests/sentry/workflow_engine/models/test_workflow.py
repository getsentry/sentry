from unittest import mock

from sentry.testutils.cases import TestCase
from sentry.workflow_engine.models import Workflow
from sentry.workflow_engine.types import DetectorPriorityLevel


class WorkflowTest(TestCase):
    def setUp(self):
        self.org = self.create_organization()
        self.project = self.create_project(organization=self.org)
        self.detector = self.create_detector(project=self.project)
        self.workflow = Workflow.objects.create(name="test_workflow", organization=self.org)

    def tearDown(self):
        self.org.delete()

    def test_evaluate_trigger_conditions__passes(self):
        evaluation = self.workflow.evaluate_trigger_conditions(DetectorPriorityLevel.HIGH)
        assert evaluation is True

    def test_evaluate_trigger_conditions__fails(self):
        evaluation = self.workflow.evaluate_trigger_conditions(DetectorPriorityLevel.OK)
        assert evaluation is False

    def test_evaluate_trigger_conditions__no_conditions(self):
        self.workflow.when_condition_group = None
        self.workflow.save()

        evaluation = self.workflow.evaluate_trigger_conditions(DetectorPriorityLevel.LOW)
        assert evaluation is True

    def test_evaluate_trigger_conditions__invalid_condition(self):
        self.data_condition.condition = "invalid"
        self.data_condition.save()

        with mock.patch("sentry.workflow_engine.models.data_condition.logger") as mock_logger:
            evaluation = self.workflow.evaluate_trigger_conditions(2)
            assert evaluation is False
            assert mock_logger.exception.call_args[0][0] == "Invalid condition"

    def test_evaluate_trigger_conditions__many_conditions(self):
        self.create_data_condition(
            condition_group=self.data_condition_group,
            condition="gte",
            comparison=DetectorPriorityLevel.LOW,
            condition_result=DetectorPriorityLevel.LOW,
        )

        evaluation = self.workflow.evaluate_trigger_conditions(DetectorPriorityLevel.HIGH)
        assert evaluation is True
