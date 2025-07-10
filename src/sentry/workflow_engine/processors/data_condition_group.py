import dataclasses
import logging
from typing import TypeVar

from sentry.utils.function_cache import cache_func_for_models
from sentry.workflow_engine.models import DataCondition, DataConditionGroup
from sentry.workflow_engine.models.data_condition import is_slow_condition
from sentry.workflow_engine.processors.data_condition import split_conditions_by_speed
from sentry.workflow_engine.types import DataConditionResult

logger = logging.getLogger(__name__)

T = TypeVar("T")


@dataclasses.dataclass()
class ProcessedDataCondition:
    logic_result: bool
    condition: DataCondition
    result: DataConditionResult


@dataclasses.dataclass()
class ProcessedDataConditionGroup:
    logic_result: bool
    condition_results: list[ProcessedDataCondition]


DataConditionGroupResult = tuple[ProcessedDataConditionGroup, list[DataCondition]]


# We use a defined function rather than a lambda below because otherwise
# parameter type becomes Any.
def _group_id_from_condition(condition: DataCondition) -> tuple[int]:
    return (condition.condition_group_id,)


@cache_func_for_models(
    [(DataCondition, _group_id_from_condition)],
    recalculate=False,
)
def get_data_conditions_for_group(data_condition_group_id: int) -> list[DataCondition]:
    return list(DataCondition.objects.filter(condition_group_id=data_condition_group_id))


def get_slow_conditions_for_groups(
    data_condition_group_ids: list[int],
) -> dict[int, list[DataCondition]]:
    """
    Takes a list of DataConditionGroup IDs and returns a dict with
    the slow conditions associated with each ID.
    """
    args_list = [(group_id,) for group_id in data_condition_group_ids]
    results = get_data_conditions_for_group.batch(args_list)
    return {
        group_id: [cond for cond in conditions if is_slow_condition(cond)]
        for group_id, conditions in zip(data_condition_group_ids, results)
    }


def evaluate_condition_group_results(
    condition_results: list[ProcessedDataCondition],
    logic_type: DataConditionGroup.Type,
) -> ProcessedDataConditionGroup:
    logic_result = False
    group_condition_results: list[ProcessedDataCondition] = []

    if logic_type == DataConditionGroup.Type.NONE:
        # if we get to this point, no conditions were met
        # because we would have short-circuited
        logic_result = True

    elif logic_type == DataConditionGroup.Type.ANY:
        logic_result = any(
            [condition_result.logic_result for condition_result in condition_results]
        )

        if logic_result:
            group_condition_results = [
                condition_result
                for condition_result in condition_results
                if condition_result.logic_result
            ]

    elif logic_type == DataConditionGroup.Type.ALL:
        conditions_met = [condition_result.logic_result for condition_result in condition_results]
        logic_result = all(conditions_met)

        if logic_result:
            group_condition_results = [
                condition_result
                for condition_result in condition_results
                if condition_result.logic_result
            ]

    return ProcessedDataConditionGroup(
        logic_result=logic_result,
        condition_results=group_condition_results,
    )


def evaluate_data_conditions(
    conditions_to_evaluate: list[tuple[DataCondition, T]],
    logic_type: DataConditionGroup.Type,
) -> ProcessedDataConditionGroup:
    """
    Evaluate a list of conditions. Each condition is a tuple with the value to evaluate the condition against.
    Next we apply the logic_type to get the results of the list of conditions.
    """
    condition_results: list[ProcessedDataCondition] = []

    if len(conditions_to_evaluate) == 0:
        # if we don't have any conditions, always return True
        return ProcessedDataConditionGroup(logic_result=True, condition_results=[])

    for condition, value in conditions_to_evaluate:
        evaluation_result = condition.evaluate_value(value)
        is_condition_triggered = evaluation_result is not None

        if is_condition_triggered:
            # Check for short-circuiting evaluations
            if logic_type == DataConditionGroup.Type.ANY_SHORT_CIRCUIT:
                condition_result = ProcessedDataCondition(
                    logic_result=True,
                    condition=condition,
                    result=evaluation_result,
                )

                return ProcessedDataConditionGroup(
                    logic_result=is_condition_triggered,
                    condition_results=[condition_result],
                )

            if logic_type == DataConditionGroup.Type.NONE:
                return ProcessedDataConditionGroup(logic_result=False, condition_results=[])

        result = ProcessedDataCondition(
            logic_result=is_condition_triggered,
            condition=condition,
            result=evaluation_result,
        )
        condition_results.append(result)

    return evaluate_condition_group_results(
        condition_results,
        logic_type,
    )


def process_data_condition_group(
    group: DataConditionGroup,
    value: T,
    is_fast: bool = True,
) -> DataConditionGroupResult:
    invalid_group = ProcessedDataConditionGroup(logic_result=False, condition_results=[])
    remaining_conditions: list[DataCondition] = []
    invalid_group_result: DataConditionGroupResult = (invalid_group, remaining_conditions)

    condition_results: list[ProcessedDataCondition] = []

    try:
        logic_type = DataConditionGroup.Type(group.logic_type)
    except ValueError:
        logger.exception(
            "Invalid DataConditionGroup.logic_type found in process_data_condition_group",
            extra={"logic_type": group.logic_type},
        )
        return invalid_group_result

    conditions = get_data_conditions_for_group(group.id)

    if is_fast:
        conditions, remaining_conditions = split_conditions_by_speed(conditions)
    else:
        _, conditions = split_conditions_by_speed(conditions)
        remaining_conditions = []

    if not conditions and remaining_conditions:
        # there are only slow conditions to evaluate, do not evaluate an empty list of conditions
        # which would evaluate to True
        condition_group_result = ProcessedDataConditionGroup(
            logic_result=False,
            condition_results=condition_results,
        )
        return condition_group_result, remaining_conditions

    conditions_to_evaluate = [(condition, value) for condition in conditions]
    processed_condition_group = evaluate_data_conditions(conditions_to_evaluate, logic_type)

    logic_result = processed_condition_group.logic_result

    # Check to see if we should return any remaining conditions based on the results
    is_short_circuit_all = not logic_result and logic_type == DataConditionGroup.Type.ALL
    is_short_circuit_any = logic_result and logic_type in (
        DataConditionGroup.Type.ANY,
        DataConditionGroup.Type.ANY_SHORT_CIRCUIT,
    )

    if is_short_circuit_all or is_short_circuit_any:
        # if we have a logic type of all and a False result,
        # or if we have a logic type of any and a True result, then
        #  we can short-circuit any remaining conditions since we have a completed logic result
        remaining_conditions = []

    return processed_condition_group, remaining_conditions
