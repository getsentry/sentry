from dataclasses import dataclass
from typing import Any

from sentry.workflow_engine.processors.evaluations.base import BaseWorkflowEngineEvaluation
from sentry.workflow_engine.types import ConditionError, DataConditionResult


class DataConditionEvaluationException(Exception):
    pass


@dataclass(frozen=True)
class DataConditionEvaluation(BaseWorkflowEngineEvaluation):
    """
    This class is used to track the evaluation of a DataCondition's logic.

    This is created by DataCondition.evaluate_value(value) as a result.

    Attributes
    - value: Any - this is the value that was evaluated against.
    - evaluation: bool - this tracks the logical evaluation of the condition
    - result: DataConditionResult - this is the value that is expected to be the result of the evaluation, in general this is the `DataCondition.condition_result`

    TODO
    - Use this Evaluation to build DataConditionGroupEvaluation
    """

    value: Any
    condition_met: bool
    result: DataConditionResult | ConditionError
