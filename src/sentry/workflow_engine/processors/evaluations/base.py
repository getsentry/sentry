from abc import ABC, abstractmethod
from collections.abc import Callable, Iterable
from dataclasses import dataclass, field, replace
from enum import StrEnum
from typing import Any

from sentry.workflow_engine.types import ConditionError


class EvaluationType(StrEnum):
    DETECTOR = "detector"
    WORKFLOW = "workflow"


class EvaluationPhase(StrEnum):
    INITIAL = "initial"
    DELAYED = "delayed"


def _find_error(
    items: list["BaseWorkflowEngineEvaluation[Any, Any]"],
    predicate: Callable[["BaseWorkflowEngineEvaluation[Any, Any]"], bool],
) -> ConditionError | None:
    """Helper to find an error from items matching the predicate."""
    return next((item.error for item in items if predicate(item)), None)


@dataclass(frozen=True, kw_only=True)
class BaseWorkflowEngineEvaluation[R, D](ABC):
    """
    This is a shared base class for all Evaluation classes.

    - result: R - the result of the evaluation, this is what should be consumed.
    - data: D - this is to store data used to generate the evaluation.
    - error: ConditionError - if there is an error while evaluating something in workflow engine, create a condition error
    - triggered: bool - The authoritative triggered state, set by whoever creates the evaluation.
        A group can trigger with an empty `result` - e.g. it has no conditions, or it's a NONE
        group where nothing matched - and `len(result)` can't tell that apart from an ANY/ALL group
        that failed, so the triggered state is stored explicitly rather than inferred from `result`.
        Excluded from equality so evaluations still compare on `result` and `error`.

    The static `any`/`all`/`none` and `choose_tainted` helpers implement taint-aware boolean
    algebra over evaluations: when an input had an error that could affect the result, the returned
    `(triggered, error)` carries a representative error so the taint propagates.

    Concrete evaluations provide `artifact_fields` to select safe, useful fields from their
    result and data. `to_artifact` combines those fields with the common evaluation state.
    """

    result: R
    data: D
    error: ConditionError | None = None

    triggered: bool = field(compare=False)

    def is_tainted(self) -> bool:
        """
        Returns True if this result is less trustworthy due to an error during
        evaluation.
        """
        return self.error is not None

    def to_artifact(self) -> dict[str, Any]:
        return {
            **self.artifact_fields,
            "triggered": self.triggered,
            "error": self.error.msg if self.error else None,
        }

    @property
    @abstractmethod
    def artifact_fields(self) -> dict[str, Any]:
        """The evaluation-specific fields included in the artifact."""
        raise NotImplementedError

    def with_error(self, error: ConditionError) -> "BaseWorkflowEngineEvaluation[R, D]":
        """
        Returns a copy of this evaluation with the given error. If the evaluation is
        already tainted, the error is ignored.
        """
        if self.is_tainted():
            return self
        return replace(self, error=error)

    @staticmethod
    def choose_tainted[E: "BaseWorkflowEngineEvaluation[Any, Any]"](a: E, b: E) -> E:
        """
        Returns the first tainted evaluation, or `a` if neither is tainted.
        Useful for tracking whether any evaluation in a series was tainted.
        """
        if a.is_tainted():
            return a
        if b.is_tainted():
            return b
        return a

    @staticmethod
    def any(
        items: Iterable["BaseWorkflowEngineEvaluation[Any, Any]"],
    ) -> tuple[bool, ConditionError | None]:
        """
        Like `any()`, but taint-aware. Returns the combined `(triggered, error)`; if any inputs
        had errors that could impact the result, the error will be one of them.
        """
        items_list = list(items)
        result = any(item.triggered for item in items_list)

        if result:
            # Result is True. If we have any untainted True, the result is clean.
            # Only tainted if all Trues are tainted.
            if any(item.triggered and not item.is_tainted() for item in items_list):
                return True, None
            # All Trues are tainted
            return True, _find_error(items_list, lambda x: x.triggered)
        else:
            # Result is False. Any tainted item could have changed the result.
            return False, _find_error(items_list, lambda x: x.is_tainted())

    @staticmethod
    def all(
        items: Iterable["BaseWorkflowEngineEvaluation[Any, Any]"],
    ) -> tuple[bool, ConditionError | None]:
        """
        Like `all()`, but taint-aware. Returns the combined `(triggered, error)`; if any inputs
        had errors that could impact the result, the error will be one of them.
        """
        items_list = list(items)
        result = all(item.triggered for item in items_list)

        if result:
            # Result is True. Any tainted item could have changed the result.
            return True, _find_error(items_list, lambda x: x.is_tainted())
        else:
            # Result is False. If we have any untainted False, the result is clean.
            # Only tainted if all Falses are tainted.
            if any(not item.triggered and not item.is_tainted() for item in items_list):
                return False, None
            # All Falses are tainted
            return False, _find_error(items_list, lambda x: not x.triggered)

    @staticmethod
    def none(
        items: Iterable["BaseWorkflowEngineEvaluation[Any, Any]"],
    ) -> tuple[bool, ConditionError | None]:
        """
        Like `not any()`, but taint-aware. Returns the combined `(triggered, error)`; if any inputs
        had errors that could impact the result, the error will be one of them.
        """
        items_list = list(items)

        # No items is guaranteed True, no possible error.
        if not items_list:
            return True, None

        result = all(not item.triggered for item in items_list)

        if result:
            # Result is True (no conditions triggered)
            # Any tainted item could have changed the result
            return True, _find_error(items_list, lambda x: x.is_tainted())
        else:
            # Result is False (at least one condition triggered)
            # If we have any untainted True, the result is clean
            if any(item.triggered and not item.is_tainted() for item in items_list):
                return False, None
            # All triggered items are tainted
            return False, _find_error(items_list, lambda x: x.triggered)
