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
from sentry.search.events.types import EventsResponse, ParamsType, QueryBuilderConfig
from sentry.snuba.dataset import Dataset
from sentry.snuba.referrer import Referrer
from sentry.tasks.base import instrumented_task
from sentry.utils import metrics
from sentry.utils.cache import cache
from sentry.utils.query import RangeQuerySetWrapper
from sentry.utils.snuba import SnubaTSResult

# from typing import Optional


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
    This task is a part of an effort to split the current "Errors and Transactions" widget that queries Discover,
    into separate widgets for errors and transactions. This task checks if the widgets current data is sourced from
    errors, transactions or both, and updates the split_discover_dataset field accordingly.

    It does not perform the actual migration of data, but only schedules the update of the split_discover_dataset
    field which will be used to perform the actual migration from discover dataset to error or
    transaction dataset in the future.

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
    params = {
        "project_objects": widget.dashboard.projects.all(),
        "start": yesterday,
        "end": now,
        "organization_id": widget.dashboard.organization.id,
    }

    original_data = get_widget_data(widget, params)
    error_data = get_widget_data(widget, params, event_type="error")
    transaction_data = get_widget_data(widget, params, event_type="transactions")

    compare_results(original_data, error_data, transaction_data)

    metrics.incr(
        "task.split_discover_dataset.data",
        tags={"has_error_data": error_data, "has_transaction_data": transaction_data},
    )
    # logger.log(
    #     logging.INFO,
    #     f"Checking for data for widget {widget.id}: error={error_data}, transaction={transaction_data}",
    # )
    # split = get_split_decision(original_data, error_data, transaction_data)
    split = None
    # logger.log(logging.INFO, f"Split decision for widget {widget.id}: {split}")
    metrics.incr("task.split_discover_dataset.update", tags={"split": split})

    widget.update(discover_widget_split=split)


def get_widget_data(widget: DashboardWidget, params: ParamsType, event_type: str | None = None):
    widget_query = DashboardWidgetQuery.objects.get(widget_id=widget)

    conditions = None
    if event_type:
        if widget_query.conditions:
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
    # print(processed_results)
    # check if there are any results
    return processed_results


def compare_results(original_data, error_data, transaction_data):
    for (o, e, t) in zip(original_data, error_data, transaction_data):
        pass
        # print(f"Original: {o}, Error: {e}, Transaction: {t}")

    return None


def get_split_decision(has_error_data, has_transactions_data):
    if has_error_data and not has_transactions_data:
        decision = DashboardWidgetTypes.ERROR_EVENTS
    elif not has_error_data and has_transactions_data:
        decision = DashboardWidgetTypes.TRANSACTION_LIKE
    elif has_error_data and has_transactions_data:
        decision = DashboardWidgetTypes.DISCOVER
    else:
        decision = None
    sentry_sdk.set_tag("split_decision", decision)
    return decision


def flatten_results(results: SnubaTSResult | dict[str, SnubaTSResult]):
    if isinstance(results, SnubaTSResult):
        return results.data["data"]

    return sum(
        [timeseries_result.data["data"] for timeseries_result in results.values()],
        [],
    )


def check_if_results_have_data(results: EventsResponse | dict[str, SnubaTSResult]):
    data = results.get("data", [{}])
    # sum up values of dicts in list
    acc = 0
    for d in data:
        for key in d:
            val = d[key]
            if isinstance(val, (int, float)):
                acc += d[key]

    return acc > 0
