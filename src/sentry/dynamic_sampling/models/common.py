from dataclasses import dataclass
from typing import Any, List, Optional, Union

import sentry_sdk

from sentry.dynamic_sampling.models.base import Model, ModelInput
from sentry.dynamic_sampling.rules.utils import ProjectId, TransactionName


@dataclass
class RebalancedItem:
    id: Union[ProjectId, TransactionName]
    count: float
    new_sample_rate: float = 0.0


def sum_classes_counts(classes: List[RebalancedItem]) -> float:
    ret_val = 0.0

    for elm in classes:
        ret_val += elm.count

    return ret_val


def guarded_run(model: Model[Any, Any], model_input: ModelInput) -> Optional[Any]:
    try:
        return model.run(model_input)
    except Exception as e:
        # We want to track the error when running the model.
        sentry_sdk.capture_exception(e)
        return None
