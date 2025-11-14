from typing import int, NamedTuple

from sentry.workflow_engine.models.data_condition import DataCondition, is_slow_condition


class SplitConditions(NamedTuple):
    fast: list[DataCondition]
    slow: list[DataCondition]


def split_conditions_by_speed(
    conditions: list[DataCondition],
) -> SplitConditions:
    fast_conditions: list[DataCondition] = []
    slow_conditions: list[DataCondition] = []

    for condition in conditions:
        if is_slow_condition(condition):
            slow_conditions.append(condition)
        else:
            fast_conditions.append(condition)

    return SplitConditions(fast=fast_conditions, slow=slow_conditions)
