import logging
from typing import Any, TypeVar

from sentry.utils.function_cache import cache_func_for_models
from sentry.workflow_engine.models import DataCondition, DataConditionGroup
from sentry.workflow_engine.processors.data_condition import split_conditions_by_speed
from sentry.workflow_engine.types import DataConditionResult, ProcessedDataConditionResult

logger = logging.getLogger(__name__)

T = TypeVar("T")

DataConditionGroupResult = tuple[bool, list[DataConditionResult], list[DataCondition]]


@cache_func_for_models(
    [(DataCondition, lambda condition: (condition.condition_group_id,))],
    recalculate=False,
)
def get_data_conditions_for_group(data_condition_group_id: int) -> list[DataCondition]:
    return list(DataCondition.objects.filter(condition_group_id=data_condition_group_id))


def process_condition_group_results(
    results: list[tuple[bool, DataConditionResult]],
    logic_type: str,
) -> ProcessedDataConditionResult:
    logic_result = False
    condition_results = []

    if logic_type == DataConditionGroup.Type.NONE:
        # if we get to this point, no conditions were met
        # because we would have short-circuited
        logic_result = True

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
) -> DataConditionGroupResult:
    """
    Evaluate the conditions for a given group and value.
    """
    results: list[tuple[bool, DataConditionResult]] = []
    conditions = get_data_conditions_for_group(data_condition_group.id)

    if is_fast:
        conditions, remaining_conditions = split_conditions_by_speed(conditions)
    else:
        _, conditions = split_conditions_by_speed(conditions)
        remaining_conditions = []

    if len(conditions) == 0:
        # if we don't have any conditions, always return True
        return True, [], remaining_conditions

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

    logic_type = data_condition_group.logic_type
    logic_result, condition_results = process_condition_group_results(
        results,
        logic_type,
    )

    if (not logic_result and logic_type == DataConditionGroup.Type.ALL) or (
        logic_result and logic_type == DataConditionGroup.Type.ANY
    ):
        # if we have a logic type of all and a False result,
        # or if we have a logic type of any and a True result
        # then we can short-circuit any remaining conditions since we have a completd logic result
        remaining_conditions = []

    return logic_result, condition_results, remaining_conditions


def process_data_condition_group(
    data_condition_group_id: int,
    value: Any,
) -> DataConditionGroupResult:
    try:
        group = DataConditionGroup.objects.get_from_cache(id=data_condition_group_id)
    except DataConditionGroup.DoesNotExist:
        logger.exception(
            "DataConditionGroup does not exist",
            extra={"id": data_condition_group_id},
        )
        return False, [], []

    return evaluate_condition_group(group, value)
