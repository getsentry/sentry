from typing import Any

from sentry.utils import metrics
from sentry.workflow_engine.processors.contexts.workflow_event_context import WorkflowEventContext

METRIC_PREFIX = "workflow_engine"
MetricTags = dict[str, Any]


def _add_namespace_to_metric(metric_name: str) -> str:
    """
    Add the prefix to the metric name
    metric_name (str): The name of the metric.

    Returns:
        str: The full metric name with the prefix.
    """
    return f"{METRIC_PREFIX}.{metric_name}"


def metrics_incr(
    metric_name: str,
    value: int = 1,
    tags: MetricTags | None = None,
) -> None:
    """
    This method will take a metric name, then decorate it with the workflow engine namespace.
    Then it will get data from the WorkflowContext and add tags to help us track metrics across
    different types of detectors.

    metric_name (str): The name of the metric.
    value (int): The number to increment by
    tags: MetricTags | None: Optional tags to add to the metric.
    """
    ctx = WorkflowEventContext.get()
    ctx_tags = {}

    full_metric_name = _add_namespace_to_metric(metric_name)

    if tags is None:
        tags = {}

    if ctx.detector is not None:
        ctx_tags = {
            "detector_type": ctx.detector.type,
        }

    tags = {**ctx_tags, **tags}
    if tags:
        metrics.incr(full_metric_name, value, tags=tags)
    else:
        metrics.incr(full_metric_name, value)
