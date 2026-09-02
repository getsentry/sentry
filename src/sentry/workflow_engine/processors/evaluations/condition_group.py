from __future__ import annotations

from collections.abc import Sequence
from dataclasses import dataclass
from typing import TYPE_CHECKING, TypedDict

from .base import BaseWorkflowEngineEvaluation, BaseWorkflowEngineEvaluationArtifact
from .condition import DataConditionEvaluation, DataConditionEvaluationArtifact

if TYPE_CHECKING:
    from sentry.workflow_engine.models.data_condition_group import DataConditionGroup


class GroupEvaluationData(TypedDict):
    condition_evaluations: list[DataConditionEvaluation]
    logic_type: DataConditionGroup.Type | str


@dataclass(frozen=True)
class DataConditionGroupEvaluationArtifact(BaseWorkflowEngineEvaluationArtifact):
    logic_type: str
    result: bool
    condition_evaluations: Sequence[DataConditionEvaluationArtifact]


@dataclass(frozen=True, kw_only=True)
class DataConditionGroupEvaluation(
    BaseWorkflowEngineEvaluation[
        bool,
        GroupEvaluationData,
        DataConditionGroupEvaluationArtifact,
    ]
):
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

    def _build_artifact(
        self, *, triggered: bool, error: str | None
    ) -> DataConditionGroupEvaluationArtifact:
        logic_type = self.data["logic_type"]
        return DataConditionGroupEvaluationArtifact(
            triggered=triggered,
            error=error,
            logic_type=getattr(logic_type, "value", logic_type),
            result=self.result,
            condition_evaluations=[
                evaluation.to_artifact() for evaluation in self.data["condition_evaluations"]
            ],
        )
