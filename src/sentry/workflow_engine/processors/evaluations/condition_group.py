from __future__ import annotations

from collections.abc import Sequence
from dataclasses import dataclass
from typing import TYPE_CHECKING, Any, TypedDict

from sentry.workflow_engine.types import ConditionError

from .base import BaseWorkflowEngineEvaluation
from .condition import DataConditionEvaluation

if TYPE_CHECKING:
    from sentry.workflow_engine.models.data_condition_group import DataConditionGroup


class GroupEvaluationData(TypedDict):
    condition_evaluations: list[DataConditionEvaluation]
    logic_type: DataConditionGroup.Type | str


@dataclass(frozen=True, kw_only=True)
class DataConditionGroupEvaluation(BaseWorkflowEngineEvaluation[bool, GroupEvaluationData]):
    """
    This class is used to track the evaluation of a DataConditionGroup.

    The class is created in `processors/data_condition_group.py`'s
    `evaluate_condition_group_results` method, and should be utilized
    anywhere we evaluate a condition group.

    Inherited properties
    - result: bool - evaluation of the logic_type and conditions
    - data: GroupEvaluationData - The list of condition evaluations and the logic used to evaluate it
    - error: ConditionError
    - triggered: bool - whether the group's conditions passed
    """

    log_name = "condition_group"

    @classmethod
    def from_conditions(
        cls,
        *,
        triggered: bool,
        logic_type: DataConditionGroup.Type | str,
        condition_evaluations: Sequence[DataConditionEvaluation] = (),
        error: ConditionError | None = None,
    ) -> DataConditionGroupEvaluation:
        """
        Group evaluations always have `result == triggered`; this factory
        centralizes that invariant.
        """
        return cls(
            result=triggered,
            triggered=triggered,
            error=error,
            data={
                "condition_evaluations": list(condition_evaluations),
                "logic_type": logic_type,
            },
        )

    @property
    def logic_type(self) -> DataConditionGroup.Type | str:
        return self.data["logic_type"]

    @property
    def condition_evaluations(self) -> list[DataConditionEvaluation]:
        return self.data["condition_evaluations"]

    def to_artifact(self) -> dict[str, Any]:
        return {
            # logic_type may be a DataConditionGroup.Type enum or a raw string; unwrap to its value.
            "logic_type": getattr(self.logic_type, "value", self.logic_type),
            "result": self.result,
            "triggered": self.triggered,
            "error": self.error_message(),
            "condition_evaluations": [
                condition.to_artifact() for condition in self.condition_evaluations
            ],
        }
