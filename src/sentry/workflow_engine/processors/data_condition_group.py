import logging
from typing import Any, TypeVar

from sentry.utils.function_cache import cache_func_for_models
from sentry.workflow_engine.models import DataCondition, DataConditionGroup
from sentry.workflow_engine.models.data_condition import split_fast_slow_conditions
from sentry.workflow_engine.types import ProcessedDataConditionResult

logger = logging.getLogger(__name__)

T = TypeVar("T")


@cache_func_for_models(
    [(DataCondition, lambda condition: (condition.condition_group_id,))],
    recalculate=False,
)
def get_data_conditions_for_group(data_condition_group_id: int) -> list[DataCondition]:
    return list(DataCondition.objects.filter(condition_group_id=data_condition_group_id))


def evaluate_conditions(
    data_condition_group: DataConditionGroup, value: T, conditions: list[DataCondition]
) -> ProcessedDataConditionResult:
    results = []

    for condition in conditions:
        evaluation_result = condition.evaluate_value(value)
        is_condition_triggered = evaluation_result is not None

        if is_condition_triggered:
            # Check for short-circuiting evaluations
            if data_condition_group.logic_type == data_condition_group.Type.ANY_SHORT_CIRCUIT:
                return is_condition_triggered, [evaluation_result]

            if data_condition_group.logic_type == data_condition_group.Type.NONE:
                return False, []

        results.append((is_condition_triggered, evaluation_result))

    if data_condition_group.logic_type == data_condition_group.Type.NONE:
        # if we get to this point, no conditions were met
        return True, []

    elif data_condition_group.logic_type == data_condition_group.Type.ANY:
        is_any_condition_met = any([result[0] for result in results])

        if is_any_condition_met:
            condition_results = [result[1] for result in results if result[0]]
            return is_any_condition_met, condition_results

    elif data_condition_group.logic_type == data_condition_group.Type.ALL:
        conditions_met = [result[0] for result in results]
        is_all_conditions_met = all(conditions_met)

        if is_all_conditions_met:
            condition_results = [result[1] for result in results if result[0]]
            return is_all_conditions_met, condition_results

    return False, []


def evaluate_condition_group(
    data_condition_group: DataConditionGroup,
    value: T,
    evaluate_slow_conditions: bool | None = False,
) -> ProcessedDataConditionResult:
    """
    Evaluate the conditions for a given group and value.
    """
    conditions = get_data_conditions_for_group(data_condition_group.id)

    conditions, slow_conditions = split_fast_slow_conditions(conditions)

    if evaluate_slow_conditions:
        conditions = slow_conditions

    if len(conditions) == 0:
        # if we don't have any conditions, always return True
        return True, []

    evaluation: ProcessedDataConditionResult = evaluate_conditions(
        data_condition_group, value, conditions
    )

    if (
        not evaluate_slow_conditions
        and data_condition_group.logic_type == data_condition_group.Type.ALL
        and evaluation[0]
        and bool(slow_conditions)
    ):
        # if all fast conditions pass but we have slow conditions, we can't return True yet
        return False, []

    return evaluation


def process_data_condition_group(
    data_condition_group_id: int,
    value: Any,
) -> ProcessedDataConditionResult:
    try:
        group = DataConditionGroup.objects.get_from_cache(id=data_condition_group_id)
    except DataConditionGroup.DoesNotExist:
        logger.exception(
            "DataConditionGroup does not exist",
            extra={"id": data_condition_group_id},
        )
        return False, []

    return evaluate_condition_group(group, value)
