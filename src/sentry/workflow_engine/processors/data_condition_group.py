from typing import Any

from sentry.utils.function_cache import cache_func_for_models
from sentry.workflow_engine.models import DataCondition, DataConditionGroup
from sentry.workflow_engine.types import ProcessedDataConditionResult


@cache_func_for_models(
    [(DataConditionGroup, lambda group: (group.id,))],
)
def get_data_condition_group(data_condition_group_id: int) -> DataConditionGroup | None:
    try:
        group = DataConditionGroup.objects.get(id=data_condition_group_id)
    except DataConditionGroup.DoesNotExist:
        group = None
    return group


@cache_func_for_models(
    [(DataCondition, lambda condition: (condition.condition_group_id,))],
)
def get_data_conditions_for_group(data_condition_group_id: int) -> list[DataCondition]:
    return list(DataCondition.objects.filter(condition_group_id=data_condition_group_id))


def process_data_condition_group(
    data_condition_group_id: int, value
) -> ProcessedDataConditionResult:
    group = get_data_condition_group(data_condition_group_id)

    if group is None:
        return False, []

    conditions = get_data_conditions_for_group(data_condition_group_id)
    return evaluate_condition_group(group, value, conditions=conditions)


def evaluate_condition_group(
    data_condition_group: DataConditionGroup,
    value: Any,
    **kwargs,
) -> ProcessedDataConditionResult:
    """
    Evaluate the conditions for a given group and value.
    """
    results = []
    conditions = kwargs.get("conditions", None)

    if conditions is None:
        conditions = get_data_conditions_for_group(data_condition_group.id)

    # TODO evaluate the condition types to see if we should evaluate slow conditions

    for condition in conditions:
        evaluation_result = condition.evaluate_value(value)
        is_condition_triggered = evaluation_result is not None

        # TODO - Should we break once the first condition is met for ANY?
        results.append((is_condition_triggered, evaluation_result))

    if data_condition_group.logic_type == data_condition_group.Type.ANY:
        is_any_condition_met = any([result[0] for result in results])

        if is_any_condition_met:
            condition_results = [result[1] for result in results if result[0]]
            return is_any_condition_met, condition_results

    if data_condition_group.logic_type == data_condition_group.Type.ALL:
        conditions_met = [result[0] for result in results]
        is_all_conditions_met = all(conditions_met)

        if is_all_conditions_met:
            condition_results = [result[1] for result in results if result[0]]
            return is_all_conditions_met, condition_results

    return False, []
