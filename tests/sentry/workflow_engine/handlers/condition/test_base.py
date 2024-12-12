from typing import Any

from sentry.rules.base import RuleBase
from sentry.testutils.cases import TestCase
from sentry.testutils.factories import DataCondition
from sentry.workflow_engine.conditions.dual_write import (
    translate_to_data_condition as dual_write_condition,
)
from sentry.workflow_engine.models.data_condition import Condition
from sentry.workflow_engine.models.data_condition_group import DataConditionGroup


class ConditionTestCase(TestCase):
    @property
    def condition(self) -> Condition:
        raise NotImplementedError

    @property
    def rule_cls(self) -> RuleBase:
        # for mapping purposes, can delete later
        pass

    @property
    def payload(self) -> dict[str, Any]:
        # for dual write, can delete later
        raise NotImplementedError

    def translate_to_data_condition(
        self, data: dict[str, Any], dcg: DataConditionGroup
    ) -> DataCondition:
        return dual_write_condition(data, dcg)

    def assert_passes(self, data_condition: DataCondition, value, **kwargs):
        assert (
            data_condition.evaluate_value(value, **kwargs) == data_condition.get_condition_result()
        )

    def assert_does_not_pass(self, data_condition: DataCondition, value, **kwargs):
        assert (
            data_condition.evaluate_value(value, **kwargs) != data_condition.get_condition_result()
        )

    # TODO: activity
