from unittest import mock

from sentry.testutils.cases import TestCase
from sentry.workflow_engine.types import DetectorPriorityLevel


class GetConditionResultTest(TestCase):
    def test_str(self):
        dc = self.create_data_condition(condition_result="wrong")
        with mock.patch("sentry.workflow_engine.models.data_condition.logger") as mock_logger:
            assert dc.get_condition_result() is None
            assert mock_logger.error.call_args[0][0] == "Invalid condition result"

    def test_int(self):
        dc = self.create_data_condition(condition_result=1)
        assert dc.get_condition_result() == 1

    def test_float(self):
        dc = self.create_data_condition(condition_result=1.0)
        assert dc.get_condition_result() == 1.0

    def test_int__overlaps_with_priority_low(self):
        dc = self.create_data_condition(condition_result=25)
        assert dc.get_condition_result() == 25
        assert dc.get_condition_result() == DetectorPriorityLevel.LOW

    def test_priority_level__as_level(self):
        dc = self.create_data_condition(condition_result=DetectorPriorityLevel.HIGH)
        assert dc.get_condition_result() == DetectorPriorityLevel.HIGH
        assert dc.get_condition_result() == 75

    def test_boolean(self):
        dc = self.create_data_condition(condition_result=True)
        assert dc.get_condition_result() is True


class EvaluateValueTest(TestCase):
    def test(self):
        dc = self.create_data_condition(
            condition="gt", comparison=1.0, condition_result=DetectorPriorityLevel.HIGH
        )
        assert dc.evaluate_value(2) == DetectorPriorityLevel.HIGH
        assert dc.evaluate_value(1) is None

    def test_bad_condition(self):
        dc = self.create_data_condition(
            condition="invalid", comparison=1.0, condition_result=DetectorPriorityLevel.HIGH
        )
        with mock.patch("sentry.workflow_engine.models.data_condition.logger") as mock_logger:
            assert dc.evaluate_value(2) is None
            assert mock_logger.exception.call_args[0][0] == "Invalid condition"

    def test_bad_comparison(self):
        dc = self.create_data_condition(
            condition="gt", comparison="hi", condition_result=DetectorPriorityLevel.HIGH
        )
        with mock.patch("sentry.workflow_engine.models.data_condition.logger") as mock_logger:
            assert dc.evaluate_value(2) is None
            assert mock_logger.exception.call_args[0][0] == "Invalid comparison value"

    def test_bad_condition_result(self):
        dc = self.create_data_condition(condition="gt", comparison=1.0, condition_result="wrong")
        with mock.patch("sentry.workflow_engine.models.data_condition.logger") as mock_logger:
            assert dc.evaluate_value(2) is None
            assert mock_logger.error.call_args[0][0] == "Invalid condition result"
