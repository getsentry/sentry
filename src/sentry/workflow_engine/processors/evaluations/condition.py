from __future__ import annotations

from dataclasses import dataclass
from functools import cached_property
from typing import TYPE_CHECKING, Any

from sentry.workflow_engine.types import ConditionError, DataConditionResult

from .base import BaseWorkflowEngineEvaluation
from .trigger_result import TriggerResult

if TYPE_CHECKING:
    from sentry.workflow_engine.models.data_condition import DataCondition


class DataConditionEvaluationException(Exception):
    pass


@dataclass(frozen=True, kw_only=True)
class DataConditionEvaluation(BaseWorkflowEngineEvaluation[DataConditionResult, ConditionError]):
    """
    This class is used to track the evaluation of a DataCondition's logic.

    This is created by DataCondition.evaluate_value(value) as a result.

    Attributes
    - value: Any - this is the value that was evaluated against.
    - condition: DataCondition - This is the condition that was evaluated.

    Inherits `result`, `error`, and `outcome`.
    """

    value: Any
    condition: DataCondition

    @cached_property
    def outcome(self) -> TriggerResult:
        """
        TODO - @saponifi3d - The TriggerResult and the BaseWorkflowEngineEvaluation
        can likely serve the same purpose, looking at the result / errors and providing
        helpful interactions.

        For now, using the `TriggerResult` to move a little faster through the refactoring.
        """
        return TriggerResult(
            triggered=(self.result is not None),
            error=self.error,
        )
