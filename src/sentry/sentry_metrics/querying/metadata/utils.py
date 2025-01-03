from __future__ import annotations

from sentry.snuba.metrics import get_mri
from sentry.snuba.metrics.naming_layer.mri import is_mri
from sentry.snuba.metrics.utils import MetricOperationType

METRICS_API_HIDDEN_OPERATIONS: dict[str, list[MetricOperationType]] = {
    "sentry:metrics_activate_percentiles": [
        "p50",
        "p75",
        "p90",
        "p95",
        "p99",
    ],
    "sentry:metrics_activate_last_for_gauges": ["last"],
}

NON_QUERYABLE_METRIC_OPERATIONS: list[MetricOperationType] = [
    "histogram",
    "min_timestamp",
    "max_timestamp",
]


class OperationsConfiguration:
    def __init__(self):
        self.hidden_operations = set()

    def hide_operations(self, operations: list[MetricOperationType]) -> None:
        self.hidden_operations.update(operations)

    def get_hidden_operations(self) -> list[MetricOperationType]:
        return list(self.hidden_operations)


def convert_metric_names_to_mris(metric_names: list[str]) -> list[str]:
    mris: list[str] = []
    for metric_name in metric_names or ():
        if is_mri(metric_name):
            mris.append(metric_name)
        else:
            mris.append(get_mri(metric_name))

    return mris
