from unittest import mock

from sentry.testutils.cases import TestCase
from sentry.workflow_engine.types import DetectorPriorityLevel


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
            assert mock_logger.exception.call_args[0][0] == "Invalid condition result"
