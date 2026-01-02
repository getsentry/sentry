import dataclasses
import logging
from collections.abc import Callable, Iterable
from typing import ClassVar, NoReturn, TypeVar

import sentry_sdk

from sentry.utils.function_cache import cache_func_for_models
from sentry.workflow_engine.models import DataCondition, DataConditionGroup
from sentry.workflow_engine.models.data_condition import is_slow_condition
from sentry.workflow_engine.processors.data_condition import split_conditions_by_speed
from sentry.workflow_engine.types import ConditionError, DataConditionResult
from sentry.workflow_engine.utils import scopedstats

logger = logging.getLogger(__name__)

T = TypeVar("T")


def _find_error(
    items: list["TriggerResult"], predicate: Callable[["TriggerResult"], bool]
) -> ConditionError | None:
    """Helper to find an error from items matching the predicate."""
    return next((item.error for item in items if predicate(item)), None)


@dataclasses.dataclass(frozen=True)
class TriggerResult:
    """
    Represents the result of a trigger evaluation with taint tracking.

    The triggered field indicates whether the trigger condition was met.

    The error field contains error information if the evaluation was tainted.
    When error is not None, it indicates that the result may not be accurate due to
    errors encountered during evaluation. Note that there may have been additional
    errors beyond the one captured here - this field contains a representative error
    from the evaluation, not necessarily all errors that occurred.
    """

    triggered: bool
    error: ConditionError | None

    # Constant untainted TriggerResult values (initialized after class definition).
    # These represent clean success/failure with no errors.
    TRUE: ClassVar["TriggerResult"]
    FALSE: ClassVar["TriggerResult"]

    def is_tainted(self) -> bool:
        """
        Returns True if this result is less trustworthy due to an error during
        evaluation.
        """
        return self.error is not None

    def with_error(self, error: ConditionError) -> "TriggerResult":
        """
        Returns a new TriggerResult with the same triggered value but the given error.
        If the result is already tainted, the error is ignored.
        """
        if self.is_tainted():
            return self
        return TriggerResult(triggered=self.triggered, error=error)

    @staticmethod
    def any(items: Iterable["TriggerResult"]) -> "TriggerResult":
        """
        Like `any()`, but for TriggerResult. If any inputs had errors that could
        impact the result, the result will contain an error from one of them.
        """
        items_list = list(items)
        result = any(item.triggered for item in items_list)

        if result:
            # Result is True. If we have any untainted True, the result is clean.
            # Only tainted if all Trues are tainted.
            if any(item.triggered and not item.is_tainted() for item in items_list):
                return TriggerResult(triggered=True, error=None)
            # All Trues are tainted
            return TriggerResult(
                triggered=True, error=_find_error(items_list, lambda x: x.triggered)
            )
        else:
            # Result is False. Any tainted item could have changed the result.
            return TriggerResult(
                triggered=False,
                error=_find_error(items_list, lambda x: x.is_tainted()),
            )

    @staticmethod
    def all(items: Iterable["TriggerResult"]) -> "TriggerResult":
        """
        Like `all()`, but for TriggerResult. If any inputs had errors that could
        impact the result, the result will contain an error from one of them.
        """
        items_list = list(items)
        result = all(item.triggered for item in items_list)

        if result:
            # Result is True. Any tainted item could have changed the result.
            return TriggerResult(
                triggered=True,
                error=_find_error(items_list, lambda x: x.is_tainted()),
            )
        else:
            # Result is False. If we have any untainted False, the result is clean.
            # Only tainted if all Falses are tainted.
            if any(not item.triggered and not item.is_tainted() for item in items_list):
                return TriggerResult(triggered=False, error=None)
            # All Falses are tainted
            return TriggerResult(
                triggered=False,
                error=_find_error(items_list, lambda x: not x.triggered),
            )

    @staticmethod
    def none(items: Iterable["TriggerResult"]) -> "TriggerResult":
        """
        Like `not any()`, but for TriggerResult. If any inputs had errors that could
        impact the result, the result will contain an error from one of them.
        """
        items_list = list(items)

        # No items is guaranteed True, no possible error.
        if not items_list:
            return TriggerResult(triggered=True, error=None)

        result = all(not item.triggered for item in items_list)

        if result:
            # Result is True (no conditions triggered)
            # Any tainted item could have changed the result
            return TriggerResult(
                triggered=True,
                error=_find_error(items_list, lambda x: x.is_tainted()),
            )
        else:
            # Result is False (at least one condition triggered)
            # If we have any untainted True, the result is clean
            if any(item.triggered and not item.is_tainted() for item in items_list):
                return TriggerResult(triggered=False, error=None)
            # All triggered items are tainted
            return TriggerResult(
                triggered=False,
                error=_find_error(items_list, lambda x: x.triggered),
            )

    def __or__(self, other: "TriggerResult") -> "TriggerResult":
        """
        OR operation, equivalent to TriggerResult.any([self, other]).
        """
        return TriggerResult.any([self, other])

    def __and__(self, other: "TriggerResult") -> "TriggerResult":
        """
        AND operation, equivalent to TriggerResult.all([self, other]).
        """
        return TriggerResult.all([self, other])

    def __bool__(self) -> NoReturn:
        raise AssertionError("TriggerResult cannot be used as a boolean")


# Constant untainted TriggerResult values for common cases.
# These are singleton instances representing clean success/failure with no errors.
TriggerResult.TRUE = TriggerResult(triggered=True, error=None)
TriggerResult.FALSE = TriggerResult(triggered=False, error=None)


@dataclasses.dataclass()
class ProcessedDataCondition:
    logic_result: TriggerResult
    condition: DataCondition
    result: DataConditionResult


@dataclasses.dataclass()
class ProcessedDataConditionGroup:
    logic_result: TriggerResult
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


@scopedstats.timer()
def _get_data_conditions_for_group_shim(data_condition_group_id: int) -> list[DataCondition]:
    """
    Wrapper for single item use case so we can easily time it.
    We can't timer() get_data_conditions_for_group because it's a CachedFunction, and
    decorating it would turn it into a regular function and make `.batch()` unusable.
    """
    return get_data_conditions_for_group(data_condition_group_id)


@sentry_sdk.trace
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
    logic_result = TriggerResult.FALSE
    group_condition_results: list[ProcessedDataCondition] = []

    if logic_type == DataConditionGroup.Type.NONE:
        # if we get to this point, no conditions were met
        # because we would have short-circuited
        logic_result = TriggerResult.none(
            condition_result.logic_result for condition_result in condition_results
        )

    elif logic_type == DataConditionGroup.Type.ANY:
        logic_result = TriggerResult.any(
            condition_result.logic_result for condition_result in condition_results
        )

        if logic_result.triggered:
            group_condition_results = [
                condition_result
                for condition_result in condition_results
                if condition_result.logic_result.triggered
            ]

    elif logic_type == DataConditionGroup.Type.ALL:
        conditions_met = [condition_result.logic_result for condition_result in condition_results]
        logic_result = TriggerResult.all(conditions_met)

        if logic_result.triggered:
            group_condition_results = [
                condition_result
                for condition_result in condition_results
                if condition_result.logic_result.triggered
            ]

    return ProcessedDataConditionGroup(
        logic_result=logic_result,
        condition_results=group_condition_results,
    )


@scopedstats.timer()
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
        return ProcessedDataConditionGroup(logic_result=TriggerResult.TRUE, condition_results=[])

    for condition, value in conditions_to_evaluate:
        evaluation_result = condition.evaluate_value(value)
        cleaned_result: DataConditionResult
        if isinstance(evaluation_result, ConditionError):
            cleaned_result = None
        else:
            cleaned_result = evaluation_result
        trigger_result = TriggerResult(
            triggered=cleaned_result is not None,
            error=evaluation_result if isinstance(evaluation_result, ConditionError) else None,
        )

        if trigger_result.triggered:
            # Check for short-circuiting evaluations
            if logic_type == DataConditionGroup.Type.ANY_SHORT_CIRCUIT:
                condition_result = ProcessedDataCondition(
                    logic_result=trigger_result,
                    condition=condition,
                    result=cleaned_result,
                )

                return ProcessedDataConditionGroup(
                    logic_result=trigger_result,
                    condition_results=[condition_result],
                )

            if logic_type == DataConditionGroup.Type.NONE:
                return ProcessedDataConditionGroup(
                    logic_result=TriggerResult(triggered=False, error=trigger_result.error),
                    condition_results=[],
                )

        result = ProcessedDataCondition(
            logic_result=trigger_result,
            condition=condition,
            result=cleaned_result,
        )
        condition_results.append(result)

    return evaluate_condition_group_results(
        condition_results,
        logic_type,
    )


@scopedstats.timer()
def process_data_condition_group(
    group: DataConditionGroup,
    value: T,
    data_conditions_for_group: list[DataCondition] | None = None,
) -> DataConditionGroupResult:
    condition_results: list[ProcessedDataCondition] = []

    try:
        logic_type = DataConditionGroup.Type(group.logic_type)
    except ValueError:
        logger.exception(
            "Invalid DataConditionGroup.logic_type found in process_data_condition_group",
            extra={"logic_type": group.logic_type},
        )
        trigger_result = TriggerResult(
            triggered=False, error=ConditionError(msg="Invalid DataConditionGroup.logic_type")
        )
        return ProcessedDataConditionGroup(logic_result=trigger_result, condition_results=[]), []

    # Check if conditions are already prefetched before using cache
    all_conditions: list[DataCondition]
    if data_conditions_for_group is not None:
        all_conditions = data_conditions_for_group
    elif (
        hasattr(group, "_prefetched_objects_cache")
        and "conditions" in group._prefetched_objects_cache
    ):
        all_conditions = list(group.conditions.all())
    else:
        all_conditions = _get_data_conditions_for_group_shim(group.id)

    split_conds = split_conditions_by_speed(all_conditions)

    if not split_conds.fast and split_conds.slow:
        # there are only slow conditions to evaluate, do not evaluate an empty list of conditions
        # which would evaluate to True
        condition_group_result = ProcessedDataConditionGroup(
            logic_result=TriggerResult.FALSE,
            condition_results=condition_results,
        )
        return condition_group_result, split_conds.slow

    conditions_to_evaluate = [(condition, value) for condition in split_conds.fast]
    processed_condition_group = evaluate_data_conditions(conditions_to_evaluate, logic_type)

    logic_result = processed_condition_group.logic_result

    # Check to see if we should return any remaining conditions based on the results
    is_short_circuit_all = not logic_result.triggered and logic_type == DataConditionGroup.Type.ALL
    is_short_circuit_any = logic_result.triggered and logic_type in (
        DataConditionGroup.Type.ANY,
        DataConditionGroup.Type.ANY_SHORT_CIRCUIT,
    )

    if is_short_circuit_all or is_short_circuit_any:
        # if we have a logic type of all and a False result,
        # or if we have a logic type of any and a True result, then
        #  we can short-circuit any remaining conditions since we have a completed logic result
        return processed_condition_group, []

    return processed_condition_group, split_conds.slow
