import logging
from typing import Any, TypeVar

from sentry.utils.function_cache import cache_func_for_models
from sentry.workflow_engine.models import DataCondition, DataConditionGroup
from sentry.workflow_engine.models.workflow import get_slow_conditions
from sentry.workflow_engine.types import ProcessedDataConditionResult

logger = logging.getLogger(__name__)

T = TypeVar("T")


@cache_func_for_models(
    [(DataCondition, lambda condition: (condition.condition_group_id,))],
    recalculate=False,
)
def get_data_conditions_for_group(data_condition_group_id: int) -> list[DataCondition]:
    return list(DataCondition.objects.filter(condition_group_id=data_condition_group_id))


def evaluate_condition_group(
    data_condition_group: DataConditionGroup,
    value: T,
    is_fast: bool = True,
) -> ProcessedDataConditionResult:
    """
    Evaluate the conditions for a given group and value.
    """
    results = []

    conditions = get_data_conditions_for_group(data_condition_group.id)

    if is_fast:
        # filter conditions to fast
        pass
    else:
        # filter conditions to slow
        conditions = get_slow_conditions(conditions)
        pass

    # split fast and slow conditions
    # evaluate fast conditions with code below ... "process_condition_group?"
    if len(conditions) == 0:
        # if we don't have any conditions, always return True
        return True, []

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

    logic_result = False
    condition_results: ProcessedDataConditionResult = []

    if data_condition_group.logic_type == data_condition_group.Type.NONE:
        # if we get to this point, no conditions were met
        logic_result = True
        condition_results = []

    elif data_condition_group.logic_type == data_condition_group.Type.ANY:
        is_any_condition_met = any([result[0] for result in results])

        if is_any_condition_met:
            logic_result = is_any_condition_met
            condition_results = [result[1] for result in results if result[0]]

    elif data_condition_group.logic_type == data_condition_group.Type.ALL:
        conditions_met = [result[0] for result in results]
        logic_result = all(conditions_met)

        if logic_result:
            condition_results = [result[1] for result in results if result[0]]

    if logic_result and is_fast:
        # enqueue fast conditions
        pass

    return logic_result, condition_results


def process_data_condition_group(
    data_condition_group_id: int,
    value: Any,
    is_fast: bool = True,
) -> ProcessedDataConditionResult:
    try:
        group = DataConditionGroup.objects.get_from_cache(id=data_condition_group_id)
    except DataConditionGroup.DoesNotExist:
        logger.exception(
            "DataConditionGroup does not exist",
            extra={"id": data_condition_group_id},
        )
        return False, []

    # should this split the conditions into fast and slow conditions?
    # then we can evaluate_condition_group with data in fast or slow.

    return evaluate_condition_group(group, value, is_fast)
