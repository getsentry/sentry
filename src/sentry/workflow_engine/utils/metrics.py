import inspect
from typing import Any

from sentry.utils import metrics
from sentry.workflow_engine.utils.workflow_context import WorkflowContext

METRIC_PREFIX = "workflow_engine"
MetricTags = dict[str, Any]


def get_metric_name(caller_method: str, metric_name: str) -> str:
    """
    Add the prefix to the metric name
    metric_name (str): The name of the metric.

    Returns:
        str: The full metric name with the prefix.
    """
    return f"{METRIC_PREFIX}.{caller_method}.{metric_name}"


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
    ctx = WorkflowContext.get()
    ctx_tags = {}

    caller_method_name = inspect.stack()[1].function
    full_metric_name = get_metric_name(caller_method_name, metric_name)

    if tags is None:
        tags = {}

    if ctx.detector is not None:
        ctx_tags = {
            "detector_type": ctx.detector.type,
        }

    tags = {**tags, **ctx_tags}
    if tags:
        metrics.incr(full_metric_name, value, tags=tags)
    else:
        metrics.incr(full_metric_name, value)
