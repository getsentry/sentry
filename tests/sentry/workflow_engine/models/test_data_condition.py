from enum import IntEnum
from unittest import mock
from unittest.mock import patch

import pytest

from sentry.testutils.cases import TestCase
from sentry.utils.registry import Registry
from sentry.workflow_engine.models.data_condition import Condition
from sentry.workflow_engine.types import (
    DataConditionHandler,
    DetectorPriorityLevel,
    WorkflowEventData,
)
from tests.sentry.workflow_engine.test_base import BaseWorkflowTest


class MockDataConditionEnum(IntEnum):
    FOO = 1
    BAR = 2


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


class EvaluateValueTest(BaseWorkflowTest):
    def setUp(self) -> None:
        super().setUp()
        self.registry = Registry[DataConditionHandler](enable_reverse_lookup=False)
        self.registry_patcher = patch(
            "sentry.workflow_engine.registry.condition_handler_registry",
            new=self.registry,
        )
        self.registry_patcher.start()

        # @self.registry.register(Condition.REAPPEARED_EVENT)

    class MockDataConditionHandlerDictComparison(DataConditionHandler):
        group = DataConditionHandler.Group.DETECTOR_TRIGGER
        comparison_json_schema = {
            "type": "object",
            "properties": {
                "baz": {"type": "int", "enum": [*MockDataConditionEnum]},
            },
            "required": ["baz"],
            "additionalProperties": False,
        }

        @staticmethod
        def evaluate_value(
            event_data: WorkflowEventData, comparison: dict[str, MockDataConditionEnum]
        ) -> DetectorPriorityLevel:
            return (
                DetectorPriorityLevel.HIGH
                if comparison["baz"].value > 1
                else DetectorPriorityLevel.OK
            )

    def tearDown(self) -> None:
        super().tearDown()
        self.registry_patcher.stop()

    def test(self):
        dc = self.create_data_condition(
            type=Condition.GREATER, comparison=1.0, condition_result=DetectorPriorityLevel.HIGH
        )
        assert dc.evaluate_value(2) == DetectorPriorityLevel.HIGH
        assert dc.evaluate_value(1) is None

    @mock.patch(
        "sentry.workflow_engine.registry.condition_handler_registry.get",
        return_value=MockDataConditionHandlerDictComparison,
    )
    def test_dict_comparison_result_high(self, mock_dc_handler):
        self.workflow_triggers = self.create_data_condition_group()
        self.dict_comparison_dc = self.create_data_condition(
            type=Condition.REAPPEARED_EVENT,
            comparison={
                "baz": MockDataConditionEnum.FOO,
            },
            condition_result=DetectorPriorityLevel.HIGH,
            condition_group=self.workflow_triggers,
        )

        assert self.dict_comparison_dc.evaluate_value(2) == DetectorPriorityLevel.HIGH

    # @mock.patch(
    #     "sentry.workflow_engine.registry.condition_handler_registry.get",
    #     return_value=MockDataConditionHandlerDictComparison,
    # )
    def test_dict_comparison_result_ok(self):
        assert self.dict_comparison_dc.evaluate_value(0) == DetectorPriorityLevel.OK

    def test_bad_condition(self):
        with pytest.raises(ValueError):
            # Raises ValueError because the condition is invalid
            self.create_data_condition(
                type="invalid", comparison=1.0, condition_result=DetectorPriorityLevel.HIGH
            )

    def test_bad_comparison(self):
        dc = self.create_data_condition(
            type=Condition.GREATER, comparison="hi", condition_result=DetectorPriorityLevel.HIGH
        )

        # Raises a TypeError because str vs int comparison
        with mock.patch("sentry.workflow_engine.models.data_condition.logger") as mock_logger:
            dc.evaluate_value(2)
            assert mock_logger.exception.call_args[0][0] == "Invalid comparison for data condition"

    def test_condition_result_comparison_fails(self):
        dc = self.create_data_condition(
            type=Condition.GREATER, comparison=1.0, condition_result="wrong"
        )
        assert dc.evaluate_value(2) is None
