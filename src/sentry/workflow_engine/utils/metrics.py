from typing import Any

from sentry.utils import metrics

METRIC_PREFIX = "workflow_engine."
MetricTags = dict[str, Any]


def get_metric_name(metric_name: str) -> str:
    """
    Add the prefix to the metric name
    metric_name (str): The name of the metric.

    Returns:
        str: The full metric name with the prefix.
    """
    return f"{METRIC_PREFIX}{metric_name}"


def metrics_incr(
    metric_name: str,
    value: int = 1,
    tags: MetricTags | None = None,
) -> None:
    """,
    Send a metric for the workflow engine.

    metric_name (str): The name of the metric.
    value (int): The number to increment by
    tags: MetricTags | None: Optional tags to add to the metric.
    """
    full_metric_name = get_metric_name(metric_name)
    metrics.incr(full_metric_name, value, tags=tags)
