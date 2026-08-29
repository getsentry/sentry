from __future__ import annotations

from dataclasses import dataclass
from typing import TYPE_CHECKING, Any, TypeAlias

from sentry.workflow_engine.types import DataConditionResult

from .base import BaseWorkflowEngineEvaluation, BaseWorkflowEngineEvaluationArtifact

if TYPE_CHECKING:
    from sentry.workflow_engine.models.data_condition import DataCondition


class DataConditionEvaluationException(Exception):
    pass


ConditionEvaluationData: TypeAlias = Any


@dataclass(frozen=True)
class DataConditionEvaluationArtifact(BaseWorkflowEngineEvaluationArtifact):
    condition_id: int
    condition_type: str
    input_type: str
    input: bool | int | float | str | None
    result: DataConditionResult


@dataclass(frozen=True, kw_only=True)
class DataConditionEvaluation(
    BaseWorkflowEngineEvaluation[
        DataConditionResult,
        ConditionEvaluationData,
        DataConditionEvaluationArtifact,
    ]
):
    """
    This class is used to track the evaluation of a DataCondition's logic.

    This is created by DataCondition.evaluate_value(value) as a result.

    Attributes
    - condition: DataCondition - This is the condition that was evaluated.
    - result - This is set as None by default here.

    Inherits
    - result: DataConditionResult - If the condition failed, this will be set to None.
        Otherwise, it will use the `DataCondition.condition_result` or boolean representation
        of the evaluation.
    - data: Any - The value that was used in the data conditions evaluation
    - error: ConditionError - Set when there's an error while evaluating a condition
    - triggered: bool - If the evaluation should consider this condition "triggered" or not.
    """

    result: DataConditionResult = None
    condition: DataCondition

    def _build_artifact(
        self, *, triggered: bool, error: str | None
    ) -> DataConditionEvaluationArtifact:
        safe_input = self.data if isinstance(self.data, (bool, int, float, str)) else None
        return DataConditionEvaluationArtifact(
            triggered=triggered,
            error=error,
            condition_id=self.condition.id,
            condition_type=self.condition.type,
            input_type=type(self.data).__name__,
            input=safe_input,
            result=getattr(self.result, "value", self.result),
        )
