import datetime
import logging

import sentry_sdk

from sentry import options
from sentry.models.dashboard_widget import (
    DashboardWidget,
    DashboardWidgetQuery,
    DashboardWidgetTypes,
)
from sentry.search.events.builder import QueryBuilder
from sentry.search.events.types import ParamsType, QueryBuilderConfig
from sentry.snuba.dataset import Dataset
from sentry.snuba.referrer import Referrer
from sentry.tasks.base import instrumented_task
from sentry.utils import metrics
from sentry.utils.cache import cache
from sentry.utils.query import RangeQuerySetWrapper

logger = logging.getLogger("sentry.tasks.split_discover_dataset")

TASK_QUERY_PERIOD = "30m"
DASHBOARD_QUERY_PERIOD = "1h"


def _get_widget_processing_batch_key() -> str:
    return "on-demand-metrics:widgets:currently-processing-batch"


def _set_currently_processing_batch(current_batch: int) -> None:
    cache.set(_get_widget_processing_batch_key(), current_batch, timeout=3600)


def _get_previous_processing_batch() -> int:
    return cache.get(_get_widget_processing_batch_key(), 0)


def _get_current_processing_batch(total_batches: int) -> int:
    previous_batch = _get_previous_processing_batch()
    current_batch = (previous_batch + 1) % total_batches
    return current_batch


def _get_batch_for_widget(widget_query_id: int, total_batches: int) -> int:
    return widget_query_id % total_batches


class SplitDiscoverDatasetException(Exception):
    pass


@instrumented_task(
    name="sentry.tasks.split_discover_dataset",
    queue="split_discover_dataset",
    max_retries=0,
    soft_time_limit=150,
    time_limit=180,
    expires=360,
)
def schedule_widget_discover_split():
    """
    This task is a part of an effort to split the current "Errors and Transactions" widget
    that queries Discover, into separate widgets for errors and transactions. This task checks
    if the widgets current data is sourced from errors, transactions or both, and updates the
    split_discover_dataset field accordingly.

    It does not perform the actual migration of data, but only schedules the update of the
    split_discover_dataset field which will be used to perform the actual migration from
    discover dataset to error or transaction dataset in the future.

    # Ops
    Killswitch option: `split_discover_dataset.enable`
    """
    if not options.get("split_discover_dataset.enable"):
        return

    logger.log(logging.INFO, "Scheduling widget discover split task")

    rollout = options.get("split_discover_dataset.rollout")
    total_batches = options.get("split_discover_dataset.query.total_batches")
    widgets_per_batch = options.get("split_discover_dataset.query.batch_size")

    currently_processing_batch = _get_current_processing_batch(total_batches)

    widget_ids = []
    dashboard_widget_count = 0

    # collect widgets that need to be updated
    for (widget_id,) in RangeQuerySetWrapper(
        DashboardWidget.objects.filter(
            widget_type=DashboardWidgetTypes.DISCOVER, discover_widget_split=None
        ).values_list("id"),
        result_value_getter=lambda item: item[0],
    ):
        batch = _get_batch_for_widget(widget_id, total_batches)
        if batch != currently_processing_batch:
            continue

        if ((widget_id % 1_000) / 1_000) > rollout:
            # % rollout based on widget_id accurate to 0.1%
            continue

        widget_ids.append(widget_id)
        dashboard_widget_count += 1

        if len(widget_ids) >= widgets_per_batch:
            update_widgets_with_discover_split(
                widget_ids,
            )
            widget_ids = []

    if widget_ids:
        update_widgets_with_discover_split(
            widget_ids,
        )

    _set_currently_processing_batch(currently_processing_batch)


def update_widgets_with_discover_split(widget_ids: list[int]):
    widgets = DashboardWidget.objects.filter(id__in=widget_ids)
    for widget in widgets:
        update_widget_discover_split(widget)


def update_widget_discover_split(widget: DashboardWidget):
    if (
        widget.widget_type != DashboardWidgetTypes.DISCOVER
        or widget.discover_widget_split is not None
    ):
        metrics.incr("task.split_discover_dataset.skip", tags={"status": "skipped"})
        return

    now = datetime.datetime.now()
    yesterday = now - datetime.timedelta(days=1)
    params: ParamsType = {
        "project_objects": widget.dashboard.projects.all(),
        "start": yesterday,
        "end": now,
        "organization_id": widget.dashboard.organization.id,
    }

    original_data = get_widget_data(widget, params)
    error_data = get_widget_data(widget, params, event_type="error")
    transaction_data = get_widget_data(widget, params, event_type="transaction")

    error_data_match, transaction_data_match = compare_results(
        original_data, error_data, transaction_data
    )

    split = get_split_decision(error_data_match, transaction_data_match)
    logger.log(logging.INFO, "Split decision for widget %s: %s", widget.id, split)
    metrics.incr("task.split_discover_dataset.update", tags={"split": split})

    widget.update(discover_widget_split=split)


def get_widget_data(widget: DashboardWidget, params: ParamsType, event_type: str | None = None):
    widget_query = DashboardWidgetQuery.objects.filter(widget_id=widget).order_by("id").first()

    conditions = widget_query.conditions
    if event_type:
        if conditions:
            conditions = f"({widget_query.conditions}) AND event.type:{event_type}"
        else:
            conditions = f"event.type:{event_type}"

    query_builder = QueryBuilder(
        dataset=Dataset.Discover,
        params=params,
        selected_columns=widget_query.aggregates + widget_query.columns,
        query=conditions,
        config=QueryBuilderConfig(
            transform_alias_to_input_format=True,
        ),
    )

    results = query_builder.run_query(Referrer.METRIC_EXTRACTION_SPLIT_DISCOVER_DATASET.value)
    processed_results = query_builder.process_results(results)

    return processed_results


def compare_results(original_data, error_data, transaction_data) -> tuple[bool, bool]:
    threshold = options.get("split_discover_dataset.data_distance_threshold")

    error_data_match, transaction_data_match = True, True
    for (o, e, t) in zip(original_data["data"], error_data["data"], transaction_data["data"]):
        for column in o:
            if not is_datapoint_close(o[column], e.get(column, float("inf")), threshold):
                error_data_match = False
            if not is_datapoint_close(o[column], t.get(column, float("inf")), threshold):
                transaction_data_match = False

    return error_data_match, transaction_data_match


def is_datapoint_close(a: float, b: float, threshold: float) -> bool:
    return abs((a - b) / a) < threshold


def get_split_decision(error_data_match: bool, transaction_data_match: bool):
    if error_data_match and not transaction_data_match:
        decision = DashboardWidgetTypes.ERROR_EVENTS
    elif not error_data_match and transaction_data_match:
        decision = DashboardWidgetTypes.TRANSACTION_LIKE
    elif error_data_match and transaction_data_match:
        decision = DashboardWidgetTypes.DISCOVER
    else:
        decision = None
    sentry_sdk.set_tag("split_decision", decision)
    return decision
