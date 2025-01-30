from sentry.workflow_engine.models.data_condition import DataCondition, is_slow_condition


def split_conditions_by_speed(
    conditions: list[DataCondition],
) -> tuple[list[DataCondition], list[DataCondition]]:
    fast_conditions: list[DataCondition] = []
    slow_conditions: list[DataCondition] = []

    for condition in conditions:
        if is_slow_condition(condition):
            slow_conditions.append(condition)
        else:
            fast_conditions.append(condition)

    return fast_conditions, slow_conditions
