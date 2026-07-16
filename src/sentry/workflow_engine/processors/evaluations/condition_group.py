from dataclasses import dataclass, field

from sentry.workflow_engine.types import ConditionError

from .base import BaseWorkflowEngineEvaluation
from .condition import DataConditionEvaluation


@dataclass(frozen=True, kw_only=True)
class DataConditionGroupEvaluation(
    BaseWorkflowEngineEvaluation[
        list[DataConditionEvaluation],
        ConditionError,
    ]
):
    """
    This class is used to track the evaluation of a DataConditionGroup.

    The class is created in `processors/data_condition_group.py`'s
    `evaluate_condition_group_results` method, and should be utilized
    anywhere we evaluate a condition group.

    Inherited properties
    - result: list[DataConditionEvaluation]
    - error: ConditionError
    - outcome: TriggerResult
    """

    result: list[DataConditionEvaluation] = field(default_factory=list)
