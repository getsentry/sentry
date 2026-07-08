from dataclasses import dataclass
from typing import Any

from sentry.workflow_engine.types import ConditionError, DataConditionResult


class DataConditionEvaluationException(Exception):
    pass


@dataclass(frozen=True)
class DataConditionEvaluation:
    """
    This class is used to track the evaluation of a DataCondition's logic.

    This is generally evaluated by DataCondition.evaluate_value(value), and
    then used to create the DataConditionGroupEvaluation in `evaluate_data_conditions`.

    Each of these attributes are eventually used to ensure detector/workflow conditions
    are evaluating as expected.

    Attributes
    - value: Any - this is the value that was evaluated against.
    - evaluation: bool - this tracks the logical evaluation of the condition
    - result: DataConditionResult - this is the value that is expected to be the result of the
              evaluation, in general this is the `DataCondition.condition_result`
    """

    value: Any
    logic_result: bool
    result: DataConditionResult | ConditionError
