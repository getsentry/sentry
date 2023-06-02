from dataclasses import dataclass
from typing import List, Union

from sentry.dynamic_sampling.rules.utils import ProjectId, TransactionName


@dataclass
class ModelClass:
    id: Union[ProjectId, TransactionName]
    count: float
    new_sample_rate: float = 0.0


def sum_classes_counts(classes: List[ModelClass]) -> float:
    ret_val = 0.0

    for elm in classes:
        ret_val += elm.count

    return ret_val
