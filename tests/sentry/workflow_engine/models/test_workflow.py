from unittest import mock

from sentry.testutils.cases import TestCase
from sentry.workflow_engine.models import Workflow
from sentry.workflow_engine.types import DetectorPriorityLevel


class TestWorkflowEvlauateTriggerConditions(TestCase):
    def setUp(self):
        self.data_condition_group = self.create_data_condition_group(logic_type="any")

        self.data_condition = self.create_data_condition(
            condition_group=self.data_condition_group,
            condition="gte",
            comparison=DetectorPriorityLevel.HIGH,
            condition_result=DetectorPriorityLevel.HIGH,
        )

        self.workflow = Workflow.objects.create(
            name="test_workflow",
            when_condition_group=self.data_condition_group,
            organization=self.organization,
        )

    def test_evaluate_trigger_conditions__passes(self):
        evaluation, results = self.workflow.evaluate_trigger_conditions(DetectorPriorityLevel.HIGH)
        assert evaluation is True
        assert results == [DetectorPriorityLevel.HIGH]

    def test_evaluate_trigger_conditions__fails(self):
        evaluation, results = self.workflow.evaluate_trigger_conditions(DetectorPriorityLevel.OK)
        assert evaluation is False
        assert results == []

    def test_evaluate_trigger_conditions__no_conditions(self):
        self.workflow.when_condition_group = None
        self.workflow.save()

        evaluation, results = self.workflow.evaluate_trigger_conditions(DetectorPriorityLevel.LOW)
        assert evaluation is True
        assert results == []

    def test_evaluate_trigger_conditions__invalid_condition(self):
        self.data_condition.condition = "invalid"
        self.data_condition.save()

        with mock.patch("sentry.workflow_engine.models.data_condition.logger") as mock_logger:
            evaluation, results = self.workflow.evaluate_trigger_conditions(2)
            assert evaluation is False
            assert results == []
            assert mock_logger.exception.call_args[0][0] == "Invalid condition"

    def test_evaluate_trigger_conditions__many_conditions(self):
        self.create_data_condition(
            condition_group=self.data_condition_group,
            condition="gte",
            comparison=DetectorPriorityLevel.LOW,
            condition_result=DetectorPriorityLevel.LOW,
        )

        evaluation, results = self.workflow.evaluate_trigger_conditions(DetectorPriorityLevel.HIGH)
        assert evaluation is True
        assert results == [DetectorPriorityLevel.HIGH, DetectorPriorityLevel.LOW]
