import logging
from datetime import datetime

import sentry_sdk
from snuba_sdk.query_visitors import InvalidQueryError

from sentry import features
from sentry.api.serializers.rest_framework.dashboard import is_aggregate
from sentry.constants import ObjectStatus
from sentry.discover.arithmetic import ArithmeticParseError
from sentry.discover.dataset_split import (
    SplitDataset,
    _dataset_split_decision_inferred_from_query,
    _get_equation_list,
    _get_field_list,
    _get_snuba_dataclass,
)
from sentry.exceptions import IncompatibleMetricsQuery, InvalidSearchQuery
from sentry.models.dashboard import Dashboard
from sentry.models.dashboard_widget import (
    DashboardWidget,
    DashboardWidgetQuery,
    DashboardWidgetTypes,
    DatasetSourcesTypes,
)
from sentry.models.project import Project
from sentry.search.events.builder.discover import DiscoverQueryBuilder
from sentry.search.events.builder.errors import ErrorsQueryBuilder
from sentry.search.events.types import QueryBuilderConfig, SnubaParams
from sentry.snuba.dataset import Dataset
from sentry.snuba.metrics_performance import query as metrics_query
from sentry.snuba.query_sources import QuerySource
from sentry.utils import snuba
from sentry.utils.dates import parse_timestamp

logger = logging.getLogger("sentry.tasks.split_discover_query_dataset")

SPLIT_DATASET_TO_DASHBOARDS_DATASET_MAP = {
    SplitDataset.Errors: DashboardWidgetTypes.ERROR_EVENTS,
    SplitDataset.Transactions: DashboardWidgetTypes.TRANSACTION_LIKE,
}


def _get_snuba_dataclass_for_dashboard_widget(
    widget: DashboardWidget, projects: list[Project]
) -> SnubaParams:
    dashboard = widget.dashboard
    filters = dashboard.filters
    start: datetime | None = None
    end: datetime | None = None
    if filters and "start" and "end" in filters:
        start = parse_timestamp(filters["start"])
        end = parse_timestamp(filters["end"])

    environment: str | list[str] = filters.get("environment", []) if filters else []
    period = filters.get("period") if filters else None

    return _get_snuba_dataclass(dashboard.organization, projects, start, end, period, environment)


def _save_split_decision_for_widget(
    widget: DashboardWidget,
    split_decision: int | None,
    dataset_source: DatasetSourcesTypes | None,
):
    if split_decision is not None:
        widget.discover_widget_split = split_decision
    if dataset_source is not None:
        widget.dataset_source = dataset_source.value

    widget.save()


@sentry_sdk.trace
def _get_and_save_split_decision_for_dashboard_widget(
    widget_query: DashboardWidgetQuery, dry_run: bool
) -> tuple[int, bool]:
    sentry_sdk.set_tag("dry_run", dry_run)

    widget: DashboardWidget = widget_query.widget
    dashboard: Dashboard = widget.dashboard
    # We use all projects for the clickhouse query but don't do anything
    # with the data returned other than check if data exists. So this
    # all projects query should be a safe operation.
    projects = dashboard.projects.all() or Project.objects.filter(
        organization_id=dashboard.organization.id, status=ObjectStatus.ACTIVE
    )

    # Handle cases where the organization has no projects at all.
    # No projects means a downstream check will fail and we can default
    # to the errors dataset.
    if not projects.exists():
        if not dry_run:
            sentry_sdk.set_context(
                "dashboard",
                {
                    "dashboard_id": dashboard.id,
                    "widget_id": widget.id,
                    "org_slug": dashboard.organization.slug,
                },
            )
            sentry_sdk.capture_message(
                "No projects found in organization for dashboard, defaulting to errors dataset"
            )
            _save_split_decision_for_widget(
                widget,
                DashboardWidgetTypes.ERROR_EVENTS,
                DatasetSourcesTypes.FORCED,
            )
        return DashboardWidgetTypes.ERROR_EVENTS, False

    snuba_dataclass = _get_snuba_dataclass_for_dashboard_widget(widget, list(projects))

    selected_columns = _get_field_list(widget_query.fields or [])

    # Empty equations are filtered out in the UI when making a query,
    # do the same here to avoid unnecessary errors.
    equations = [equation for equation in _get_equation_list(widget_query.fields or []) if equation]
    query = widget_query.conditions

    try:
        errors_builder = ErrorsQueryBuilder(
            dataset=Dataset.Events,
            params={},
            snuba_params=snuba_dataclass,
            query=query,
            selected_columns=selected_columns,
            equations=equations,
            limit=1,
            config=QueryBuilderConfig(
                auto_aggregations=True,
                equation_config={
                    "auto_add": True,
                },
            ),
        )
    except (
        snuba.UnqualifiedQueryError,
        InvalidSearchQuery,
        InvalidQueryError,
        snuba.QueryExecutionError,
    ) as e:
        sentry_sdk.capture_exception(e)
        if dry_run:
            logger.info(
                "Split decision for %s: %s (forced fallback)",
                widget.id,
                DashboardWidgetTypes.TRANSACTION_LIKE,
            )
        else:
            _save_split_decision_for_widget(
                widget,
                DashboardWidgetTypes.TRANSACTION_LIKE,
                DatasetSourcesTypes.FORCED,
            )
        return DashboardWidgetTypes.TRANSACTION_LIKE, False

    try:
        transactions_builder = DiscoverQueryBuilder(
            dataset=Dataset.Transactions,
            params={},
            snuba_params=snuba_dataclass,
            query=query,
            selected_columns=selected_columns,
            equations=equations,
            limit=1,
            config=QueryBuilderConfig(
                auto_aggregations=True,
                equation_config={
                    "auto_add": True,
                },
            ),
        )
    except (
        snuba.UnqualifiedQueryError,
        InvalidSearchQuery,
        InvalidQueryError,
        snuba.QueryExecutionError,
    ) as e:
        sentry_sdk.capture_exception(e)
        if dry_run:
            logger.info(
                "Split decision for %s: %s (forced fallback)",
                widget.id,
                DashboardWidgetTypes.ERROR_EVENTS,
            )
        else:
            _save_split_decision_for_widget(
                widget,
                DashboardWidgetTypes.ERROR_EVENTS,
                DatasetSourcesTypes.FORCED,
            )
        return DashboardWidgetTypes.ERROR_EVENTS, False

    dataset_inferred_from_query = _dataset_split_decision_inferred_from_query(
        errors_builder, transactions_builder
    )

    if dataset_inferred_from_query is not None:
        widget_dataset = SPLIT_DATASET_TO_DASHBOARDS_DATASET_MAP[dataset_inferred_from_query]
        if dry_run:
            logger.info("Split decision for %s: %s", widget.id, widget_dataset)
        else:
            _save_split_decision_for_widget(
                widget,
                widget_dataset,
                DatasetSourcesTypes.SPLIT_VERSION_2,
            )
        return widget_dataset, False

    if (
        features.has("organizations:dynamic-sampling", dashboard.organization, actor=None)
        and not equations
    ):
        try:
            metrics_query_result = metrics_query(
                selected_columns,
                query,
                snuba_dataclass,
                equations,
                orderby=None,
                offset=None,
                limit=1,
                referrer="tasks.performance.split_discover_dataset",
                transform_alias_to_input_format=True,
            )

            has_metrics_data = (
                metrics_query_result.get("data")
                # No results were returned at all
                and len(metrics_query_result["data"]) > 0
                and any(
                    metrics_query_result["data"][0][column] > 0
                    for column in selected_columns
                    if is_aggregate(column)
                )
            )
            if has_metrics_data:
                if dry_run:
                    logger.info(
                        "Split decision for %s: %s (inferred from running metrics query)",
                        widget.id,
                        DashboardWidgetTypes.TRANSACTION_LIKE,
                    )
                else:
                    _save_split_decision_for_widget(
                        widget,
                        DashboardWidgetTypes.TRANSACTION_LIKE,
                        DatasetSourcesTypes.SPLIT_VERSION_2,
                    )

                return DashboardWidgetTypes.TRANSACTION_LIKE, True
        except (
            IncompatibleMetricsQuery,
            snuba.QueryIllegalTypeOfArgument,
            snuba.UnqualifiedQueryError,
            InvalidQueryError,
            snuba.QueryExecutionError,
            snuba.SnubaError,
            ArithmeticParseError,
        ):
            pass

    has_errors = False
    try:
        error_results = errors_builder.process_results(
            errors_builder.run_query(
                "tasks.performance.split_discover_dataset", query_source=QuerySource.SENTRY_BACKEND
            )
        )
        has_errors = len(error_results["data"]) > 0
    except (
        snuba.QueryIllegalTypeOfArgument,
        snuba.UnqualifiedQueryError,
        InvalidQueryError,
        snuba.QueryExecutionError,
        snuba.SnubaError,
        ArithmeticParseError,
    ):
        pass

    if has_errors:
        if dry_run:
            logger.info(
                "Split decision for %s: %s (inferred from running query)",
                widget.id,
                DashboardWidgetTypes.ERROR_EVENTS,
            )
        else:
            _save_split_decision_for_widget(
                widget,
                DashboardWidgetTypes.ERROR_EVENTS,
                DatasetSourcesTypes.SPLIT_VERSION_2,
            )
        return DashboardWidgetTypes.ERROR_EVENTS, True

    has_transactions = False
    try:
        transaction_results = transactions_builder.process_results(
            transactions_builder.run_query(
                "tasks.performance.split_discover_dataset", query_source=QuerySource.SENTRY_BACKEND
            )
        )
        has_transactions = len(transaction_results["data"]) > 0
    except (
        snuba.QueryIllegalTypeOfArgument,
        snuba.UnqualifiedQueryError,
        InvalidQueryError,
        snuba.QueryExecutionError,
        snuba.SnubaError,
        ArithmeticParseError,
    ):
        pass

    if has_transactions:
        if dry_run:
            logger.info(
                "Split decision for %s: %s (inferred from running query)",
                widget.id,
                DashboardWidgetTypes.TRANSACTION_LIKE,
            )
        else:
            _save_split_decision_for_widget(
                widget,
                DashboardWidgetTypes.TRANSACTION_LIKE,
                DatasetSourcesTypes.SPLIT_VERSION_2,
            )

        return DashboardWidgetTypes.TRANSACTION_LIKE, True

    if dry_run:
        logger.info(
            "Split decision for %s: %s (forced)",
            widget.id,
            DashboardWidgetTypes.ERROR_EVENTS,
        )
    else:
        _save_split_decision_for_widget(
            widget,
            DashboardWidgetTypes.ERROR_EVENTS,
            DatasetSourcesTypes.FORCED,
        )

    return DashboardWidgetTypes.ERROR_EVENTS, True
