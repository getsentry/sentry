import logging
from typing import TypeVar

from sentry.utils.function_cache import cache_func_for_models
from sentry.utils.tracing import trace
from sentry.workflow_engine.models import DataCondition, DataConditionGroup
from sentry.workflow_engine.models.data_condition import is_slow_condition
from sentry.workflow_engine.processors.data_condition import split_conditions_by_speed
from sentry.workflow_engine.processors.evaluations import (
    DataConditionEvaluation,
    DataConditionGroupEvaluation,
    TriggerResult,
)
from sentry.workflow_engine.types import ConditionError
from sentry.workflow_engine.utils import scopedstats

logger = logging.getLogger(__name__)

T = TypeVar("T")


DataConditionGroupResult = tuple[DataConditionGroupEvaluation, list[DataCondition]]


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


@scopedstats.timer()
def _get_data_conditions_for_group_shim(data_condition_group_id: int) -> list[DataCondition]:
    """
    Wrapper for single item use case so we can easily time it.
    We can't timer() get_data_conditions_for_group because it's a CachedFunction, and
    decorating it would turn it into a regular function and make `.batch()` unusable.
    """
    return get_data_conditions_for_group(data_condition_group_id)


@trace
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
    condition_results: list[DataConditionEvaluation],
    logic_type: DataConditionGroup.Type,
) -> DataConditionGroupEvaluation:
    logic_result = TriggerResult.FALSE
    outcomes = [condition_result.outcome for condition_result in condition_results]

    match logic_type:
        case DataConditionGroup.Type.NONE:
            logic_result = TriggerResult.none(outcomes)
        case DataConditionGroup.Type.ANY | DataConditionGroup.Type.ANY_SHORT_CIRCUIT:
            logic_result = TriggerResult.any(outcomes)
        case DataConditionGroup.Type.ALL:
            logic_result = TriggerResult.all(outcomes)

    # When the group didn't trigger, or it's a NONE group (which triggers precisely
    # when nothing matched), this is empty.
    passing_evaluations = (
        [
            condition_result
            for condition_result in condition_results
            if condition_result.outcome.triggered
        ]
        if logic_result.triggered
        else []
    )

    return DataConditionGroupEvaluation(
        result=logic_result.triggered,
        data={
            "condition_evaluations": passing_evaluations,
            "logic_type": logic_type,
        },
        triggered=logic_result.triggered,
        error=logic_result.error,
    )


@scopedstats.timer()
def evaluate_data_conditions(
    conditions_to_evaluate: list[tuple[DataCondition, T]],
    logic_type: DataConditionGroup.Type,
) -> DataConditionGroupEvaluation:
    """
    Evaluate a list of conditions. Each condition is a tuple with the value to evaluate the condition against.
    Next we apply the logic_type to get the results of the list of conditions.
    """
    condition_evaluations: list[DataConditionEvaluation] = []

    if not conditions_to_evaluate:
        # if there are no conditions on the group, always return True.
        return DataConditionGroupEvaluation(
            result=True,
            triggered=True,
            data={
                "condition_evaluations": condition_evaluations,
                "logic_type": logic_type,
            },
        )

    for condition, value in conditions_to_evaluate:
        evaluation = condition.evaluate_value(value)

        # Check for short-circuiting evaluations
        if evaluation.outcome.triggered:
            match logic_type:
                case DataConditionGroup.Type.ANY_SHORT_CIRCUIT:
                    # The first matching condition conclusively satisfies the group.
                    return DataConditionGroupEvaluation(
                        result=True,
                        triggered=True,
                        error=evaluation.outcome.error,
                        data={
                            "condition_evaluations": [evaluation],
                            "logic_type": logic_type,
                        },
                    )
                case DataConditionGroup.Type.NONE:
                    # A NONE group requires that no condition matches; a match
                    # makes the group conclusively not triggered.
                    return DataConditionGroupEvaluation(
                        result=False,
                        triggered=False,
                        error=evaluation.outcome.error,
                        data={
                            "condition_evaluations": [],
                            "logic_type": logic_type,
                        },
                    )

        condition_evaluations.append(evaluation)

    # Apply the grouping logic to the condition evaluation results.
    return evaluate_condition_group_results(condition_evaluations, logic_type)


def _resolve_group_conditions(group: DataConditionGroup) -> list[DataCondition]:
    if (
        hasattr(group, "_prefetched_objects_cache")
        and "conditions" in group._prefetched_objects_cache
    ):
        return list(group.conditions.all())

    return _get_data_conditions_for_group_shim(group.id)


def _is_conclusive_evaluation(evaluation: DataConditionGroupEvaluation) -> bool:
    """
    Determines if a given group evaluation is completed based on the logic_type
    and the results of the conditions in the evaluation.
    """
    logic_type = evaluation.data.get("logic_type")

    match logic_type:
        case DataConditionGroup.Type.ALL | DataConditionGroup.Type.NONE:
            return not evaluation.outcome.triggered
        case DataConditionGroup.Type.ANY | DataConditionGroup.Type.ANY_SHORT_CIRCUIT:
            return evaluation.outcome.triggered

    return False


@scopedstats.timer()
def process_data_condition_group(
    group: DataConditionGroup,
    value: T,
    data_conditions_for_group: list[DataCondition] | None = None,
) -> DataConditionGroupResult:
    condition_results: list[DataConditionEvaluation] = []
    all_conditions: list[DataCondition]

    try:
        logic_type = DataConditionGroup.Type(group.logic_type)
    except ValueError:
        return DataConditionGroupEvaluation(
            result=False,
            triggered=False,
            data={
                "condition_evaluations": condition_results,
                "logic_type": group.logic_type,
            },
            error=ConditionError(msg="Invalid DataConditionGroup.logic_type"),
        ), []

    all_conditions = (
        _resolve_group_conditions(group)
        if data_conditions_for_group is None
        else data_conditions_for_group
    )
    conditions = split_conditions_by_speed(all_conditions)

    if not conditions.fast and conditions.slow:
        # There are only slow conditions to evaluate. Don't evaluate an empty list
        # of fast conditions, which would incorrectly resolve to triggered=True
        # before the slow conditions have been evaluated.
        return DataConditionGroupEvaluation(
            result=False,
            triggered=False,
            data={
                "condition_evaluations": condition_results,
                "logic_type": logic_type,
            },
        ), conditions.slow

    conditions_to_evaluate = [(condition, value) for condition in conditions.fast]
    group_evaluation = evaluate_data_conditions(conditions_to_evaluate, logic_type)

    if _is_conclusive_evaluation(group_evaluation):
        return group_evaluation, []

    return group_evaluation, conditions.slow
