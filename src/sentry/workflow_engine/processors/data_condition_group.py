import logging
from typing import TypeVar

from sentry.utils.function_cache import cache_func_for_models
from sentry.workflow_engine.models import DataCondition, DataConditionGroup
from sentry.workflow_engine.processors.data_condition import split_conditions_by_speed
from sentry.workflow_engine.types import DataConditionResult, ProcessedDataConditionResult

logger = logging.getLogger(__name__)

T = TypeVar("T")

DataConditionGroupResult = tuple[ProcessedDataConditionResult, list[DataCondition]]


@cache_func_for_models(
    [(DataCondition, lambda condition: (condition.condition_group_id,))],
    recalculate=False,
)
def get_data_conditions_for_group(data_condition_group_id: int) -> list[DataCondition]:
    return list(DataCondition.objects.filter(condition_group_id=data_condition_group_id))


def evaluate_condition_group_results(
    results: list[tuple[bool, DataConditionResult]],
    logic_type: DataConditionGroup.Type,
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


def evaluate_data_conditions(
    conditions_to_evaluate: list[tuple[DataCondition, T]],
    logic_type: DataConditionGroup.Type,
) -> ProcessedDataConditionResult:
    """
    Evaluate a list of conditions, each condition is a tuple with the value to evalute the condition against.
    Then we apply the logic_type to get the results of the list of conditions.
    """
    results: list[tuple[bool, DataConditionResult]] = []

    if len(conditions_to_evaluate) == 0:
        # if we don't have any conditions, always return True
        return True, []

    for condition, value in conditions_to_evaluate:
        evaluation_result = condition.evaluate_value(value)
        is_condition_triggered = evaluation_result is not None

        if is_condition_triggered:
            # Check for short-circuiting evaluations
            if logic_type == DataConditionGroup.Type.ANY_SHORT_CIRCUIT:
                return is_condition_triggered, [evaluation_result]

            if logic_type == DataConditionGroup.Type.NONE:
                return False, []

        results.append((is_condition_triggered, evaluation_result))

    return evaluate_condition_group_results(
        results,
        logic_type,
    )


def process_data_condition_group(
    data_condition_group_id: int,
    value: T,
    is_fast: bool = True,
) -> DataConditionGroupResult:
    invalid_group_result: DataConditionGroupResult = (False, []), []

    try:
        group = DataConditionGroup.objects.get_from_cache(id=data_condition_group_id)
    except DataConditionGroup.DoesNotExist:
        logger.exception(
            "DataConditionGroup does not exist",
            extra={"id": data_condition_group_id},
        )
        return invalid_group_result

    try:
        logic_type = DataConditionGroup.Type(group.logic_type)
    except ValueError:
        logger.exception(
            "Invalid DataConditionGroup.logic_type found in process_data_condition_group",
            extra={"logic_type": group.logic_type},
        )
        return invalid_group_result

    conditions = get_data_conditions_for_group(data_condition_group_id)

    if is_fast:
        conditions, remaining_conditions = split_conditions_by_speed(conditions)
    else:
        _, conditions = split_conditions_by_speed(conditions)
        remaining_conditions = []

    conditions_to_evaluate = [(condition, value) for condition in conditions]
    logic_result, condition_results = evaluate_data_conditions(conditions_to_evaluate, logic_type)

    if (not logic_result and logic_type == DataConditionGroup.Type.ALL) or (
        logic_result and logic_type == DataConditionGroup.Type.ANY
    ):
        # if we have a logic type of all and a False result,
        # or if we have a logic type of any and a True result, then
        #  we can short-circuit any remaining conditions since we have a completed logic result
        remaining_conditions = []

    return (logic_result, condition_results), remaining_conditions
