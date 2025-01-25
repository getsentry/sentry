import logging
from typing import Any, TypeVar

from sentry.utils.function_cache import cache_func_for_models
from sentry.workflow_engine.models import DataCondition, DataConditionGroup
from sentry.workflow_engine.models.data_condition import split_fast_slow_conditions
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


def process_condition_group_results(
    logic_type: DataConditionGroup.Type,
    results: list[ProcessedDataConditionResult],
) -> tuple[bool, ProcessedDataConditionResult]:
    logic_result = False
    condition_results: ProcessedDataConditionResult = []

    if logic_type == DataConditionGroup.Type.NONE:
        # if we get to this point, no conditions were met
        logic_result = True
        condition_results = []

    elif logic_type == DataConditionGroup.Type.ANY:
        logic_result = any([result[0] for result in results])

        if logic_result:
            condition_results = [result[1] for result in results if result[0]]

    elif logic_type == DataConditionGroup.Type.ALL:
        conditions_met = [result[0] for result in results]
        logic_result = all(conditions_met)

        if logic_result:
            condition_results = [result[1] for result in results if result[0]]

    return logic_result, condition_results


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
        conditions, remaining_conditions = split_fast_slow_conditions(conditions)
    else:
        conditions = get_slow_conditions(conditions)
        remaining_conditions = []

    if len(conditions) == 0:
        # if we don't have any conditions, always return True
        return True, []

    for condition in conditions:
        evaluation_result = condition.evaluate_value(value)
        is_condition_triggered = evaluation_result is not None

        if is_condition_triggered:
            # Check for short-circuiting evaluations
            if data_condition_group.logic_type == data_condition_group.Type.ANY_SHORT_CIRCUIT:
                return is_condition_triggered, [evaluation_result], []

            if data_condition_group.logic_type == data_condition_group.Type.NONE:
                return False, [], []

        results.append((is_condition_triggered, evaluation_result))

    logic_result, condition_results = process_condition_group_results(
        data_condition_group.logic_type, results
    )

    if data_condition_group.logic_type == DataConditionGroup.Type.ALL and not logic_result:
        # if we have an ALL condition group and the logic result is False,
        # then we don't need to evaluate any more conditions
        remaining_conditions = []

    return logic_result, condition_results, remaining_conditions


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

    return evaluate_condition_group(group, value, is_fast)
