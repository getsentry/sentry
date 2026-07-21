from __future__ import annotations

from dataclasses import dataclass
from typing import TYPE_CHECKING, Any

from sentry.workflow_engine.types import ConditionError, DataConditionResult

from .base import BaseWorkflowEngineEvaluation

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

    result: DataConditionResult = None
    value: Any
    condition: DataCondition
