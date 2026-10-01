from dataclasses import dataclass

from sentry.dynamic_sampling.rules.utils import ProjectId, TransactionName


@dataclass
class RebalancedItem:
    id: ProjectId | TransactionName
    count: float
    new_sample_rate: float = 0.0


def sum_classes_counts(classes: list[RebalancedItem]) -> float:
    ret_val = 0.0

    for elm in classes:
        ret_val += elm.count

    return ret_val
