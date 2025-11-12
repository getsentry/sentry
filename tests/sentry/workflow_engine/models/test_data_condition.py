from enum import IntEnum
from unittest import mock

import pytest

from sentry.testutils.cases import TestCase
from sentry.workflow_engine.models.data_condition import Condition, DataConditionEvaluationException
from sentry.workflow_engine.types import ConditionError, DetectorPriorityLevel
from tests.sentry.workflow_engine.test_base import BaseWorkflowTest, DataConditionHandlerMixin


class MockDataConditionEnum(IntEnum):
    FOO = 1
    BAR = 2


class GetConditionResultTest(TestCase):
    def test_str(self) -> None:
        dc = self.create_data_condition(condition_result="wrong")
        with mock.patch("sentry.workflow_engine.models.data_condition.logger") as mock_logger:
            assert dc.get_condition_result() == ConditionError(msg="Invalid condition result")
            assert mock_logger.error.call_args[0][0] == "Invalid condition result"

    def test_int(self) -> None:
        dc = self.create_data_condition(condition_result=1)
        assert dc.get_condition_result() == 1

    def test_float(self) -> None:
        dc = self.create_data_condition(condition_result=1.0)
        assert dc.get_condition_result() == 1.0

    def test_int__overlaps_with_priority_low(self) -> None:
        dc = self.create_data_condition(condition_result=25)
        assert dc.get_condition_result() == 25
        assert dc.get_condition_result() == DetectorPriorityLevel.LOW

    def test_priority_level__as_level(self) -> None:
        dc = self.create_data_condition(condition_result=DetectorPriorityLevel.HIGH)
        assert dc.get_condition_result() == DetectorPriorityLevel.HIGH
        assert dc.get_condition_result() == 75

    def test_boolean(self) -> None:
        dc = self.create_data_condition(condition_result=True)
        assert dc.get_condition_result() is True


class EvaluateValueTest(DataConditionHandlerMixin, BaseWorkflowTest):
    def test(self) -> None:
        dc = self.create_data_condition(
            type=Condition.GREATER, comparison=1.0, condition_result=DetectorPriorityLevel.HIGH
        )
        assert dc.evaluate_value(2) == DetectorPriorityLevel.HIGH
        assert dc.evaluate_value(1) is None

    def test_dict_comparison_result(self) -> None:
        def evaluate_value(
            value: int, comparison: dict[str, DetectorPriorityLevel]
        ) -> DetectorPriorityLevel:
            return (
                DetectorPriorityLevel.HIGH
                if comparison["baz"].value > 1
                else DetectorPriorityLevel.OK
            )

        dc = self.setup_condition_mocks(
            evaluate_value, ["sentry.workflow_engine.models.data_condition"]
        )
        dc.update(comparison={"baz": MockDataConditionEnum.BAR})
        assert dc.evaluate_value(2) == DetectorPriorityLevel.HIGH

        dc.update(comparison={"baz": MockDataConditionEnum.FOO})
        result = dc.evaluate_value(0)
        assert result == DetectorPriorityLevel.OK
        self.teardown_condition_mocks()

    def test_bad_condition(self) -> None:
        with pytest.raises(ValueError):
            # Raises ValueError because the condition is invalid
            self.create_data_condition(
                type="invalid", comparison=1.0, condition_result=DetectorPriorityLevel.HIGH
            )

    def test_bad_comparison(self) -> None:
        dc = self.create_data_condition(
            type=Condition.GREATER, comparison="hi", condition_result=DetectorPriorityLevel.HIGH
        )

        # Raises a TypeError because str vs int comparison
        with mock.patch("sentry.workflow_engine.models.data_condition.logger") as mock_logger:
            dc.evaluate_value(2)
            assert mock_logger.exception.call_args[0][0] == "Invalid comparison for data condition"

    def test_condition_result_comparison_fails(self) -> None:
        dc = self.create_data_condition(
            type=Condition.GREATER, comparison=1.0, condition_result="wrong"
        )
        assert dc.evaluate_value(2) == ConditionError(msg="Invalid condition result")

    def test_condition_evaluation__data_condition_exception(self) -> None:
        def evaluate_value(value: int, comparison: int) -> bool:
            raise DataConditionEvaluationException("A known error occurred")

        dc = self.setup_condition_mocks(
            evaluate_value, ["sentry.workflow_engine.models.data_condition"]
        )

        with mock.patch("sentry.workflow_engine.models.data_condition.logger.info") as mock_logger:
            dc.evaluate_value(2)
            assert (
                mock_logger.call_args[0][0]
                == "A known error occurred while evaluating a data condition"
            )

        self.teardown_condition_mocks()

    def test_condition_evaluation___exception(self) -> None:
        def evaluate_value(value: int, comparison: int) -> bool:
            raise Exception("Something went wrong")

        dc = self.setup_condition_mocks(
            evaluate_value, ["sentry.workflow_engine.models.data_condition"]
        )

        with pytest.raises(Exception):
            dc.evaluate_value(2)

        self.teardown_condition_mocks()
