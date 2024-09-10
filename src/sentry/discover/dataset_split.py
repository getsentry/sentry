import logging
from typing import Any

import sentry_sdk
from snuba_sdk import (
    AliasedExpression,
    And,
    BooleanCondition,
    Column,
    Condition,
    CurriedFunction,
    Function,
    Op,
    Or,
)

from sentry.api.utils import get_date_range_from_stats_period
from sentry.constants import ObjectStatus
from sentry.discover.arithmetic import is_equation, strip_equation
from sentry.discover.models import DatasetSourcesTypes, DiscoverSavedQuery, DiscoverSavedQueryTypes
from sentry.exceptions import InvalidParams
from sentry.models.project import Project
from sentry.search.events.builder.discover import DiscoverQueryBuilder
from sentry.search.events.builder.errors import ErrorsQueryBuilder
from sentry.search.events.types import SnubaParams
from sentry.snuba.dataset import Dataset
from sentry.snuba.query_sources import QuerySource
from sentry.utils import snuba
from sentry.utils.dates import outside_retention_with_modified_start, parse_timestamp

logger = logging.getLogger("sentry.tasks.split_discover_query_dataset")


TRANSACTION_ONLY_FIELDS = [
    "duration",
    "transaction_op",
    "transaction_status",
    "measurements[lcp]",
    "measurements[cls]",
    "measurements[fcp]",
    "measurements[fid]",
    "measurements[inp]",
    "measurements[ttfb]",
    "measurements[app_start_cold]",
    "measurements[app_start_warm]",
    "measurements[frames_total]",
    "measurements[frames_slow]",
    "measurements[frames_frozen]",
    "measurements[frames_slow_rate]",
    "measurements[frames_frozen_rate]",
    "measurements[stall_count]",
    "measurements[stall_total_time]",
    "measurements[stall_longest_time]",
    "measurements[stall_percentage]",
    "measurements[time_to_full_display]",
    "measurements[time_to_initial_display]",
    "span_op_breakdowns[ops.browser]",
    "span_op_breakdowns[ops.http]",
    "span_op_breakdowns[ops.db]",
    "span_op_breakdowns[ops.resource]",
    "span_op_breakdowns[ops.ui]",
]

ERROR_ONLY_FIELDS = [
    "location",
    "exception_stacks.type",
    "exception_stacks.value",
    "exception_stacks.mechanism_type",
    "exception_stacks.mechanism_handled",
    "received",
    "exception_main_thread",
    "exception_frames.abs_path",
    "exception_frames.colno",
    "exception_frames.filename",
    "exception_frames.function",
    "exception_frames.in_app",
    "exception_frames.lineno",
    "exception_frames.module",
    "exception_frames.package",
    "exception_frames.stack_level",
]


def _save_split_decision_for_query(
    saved_query: DiscoverSavedQuery,
    split_decision: int | None,
    dataset_source: DatasetSourcesTypes | None,
):
    if split_decision is not None:
        saved_query.dataset = split_decision
    if dataset_source is not None:
        saved_query.dataset_source = dataset_source.value

    saved_query.save()


def _get_top_level_filter_conditions(builder: ErrorsQueryBuilder | DiscoverQueryBuilder):
    top_level_conditions: list[Condition | BooleanCondition] = []
    for cond in builder.where:
        if isinstance(cond, And) or isinstance(cond, Or):
            top_level_conditions.extend(cond.conditions)
        if isinstance(cond, Condition):
            top_level_conditions.append(cond)

    return top_level_conditions


def _check_function_parameter_matches_dataset(
    function: Function | CurriedFunction,
    dataset: Dataset,
) -> bool:
    fields = TRANSACTION_ONLY_FIELDS if dataset == Dataset.Transactions else ERROR_ONLY_FIELDS
    if dataset == Dataset.Events:
        if function.function in ["isHandled", "notHandled"]:
            return True

    for parameter in function.parameters:
        if isinstance(parameter, Column) and parameter.name in fields:
            return True

    return False


def _check_aliased_expression_matches_dataset(
    aliased_exp: AliasedExpression,
    dataset: Dataset,
) -> bool:
    col = aliased_exp.exp.name
    fields = TRANSACTION_ONLY_FIELDS if dataset == Dataset.Transactions else ERROR_ONLY_FIELDS
    if col in fields:
        return True

    return False


def _check_column_matches_dataset(
    column: Column,
    dataset: Dataset,
) -> bool:
    col = column.name
    fields = TRANSACTION_ONLY_FIELDS if dataset == Dataset.Transactions else ERROR_ONLY_FIELDS
    if col in fields:
        return True

    return False


def _check_event_type_condition(cond: Condition, dataset: Dataset):
    op = cond.op
    rhs = cond.rhs
    if dataset == Dataset.Events and (
        (op == Op.EQ and rhs == "error") or (op == Op.NEQ and rhs == "transaction")
    ):
        return True

    if dataset == Dataset.Transactions and op == Op.EQ and rhs == "transaction":
        return True

    return False


def _check_condition_matches_dataset(
    cond: Condition,
    dataset: Dataset,
) -> bool:
    lhs = cond.lhs
    if isinstance(lhs, Column):
        return _check_column_matches_dataset(lhs, dataset)

    if isinstance(lhs, Function) or isinstance(lhs, CurriedFunction):
        return _check_function_parameter_matches_dataset(lhs, dataset)

    return False


def _check_top_level_conditions_match_dataset(
    builder: ErrorsQueryBuilder | DiscoverQueryBuilder,
    dataset: Dataset,
):
    top_level_conditions = _get_top_level_filter_conditions(builder)
    for cond in top_level_conditions:
        if isinstance(cond, Condition):
            if _check_condition_matches_dataset(cond, dataset):
                return True

    return False


def _check_selected_columns_match_dataset(
    builder: ErrorsQueryBuilder | DiscoverQueryBuilder,
    dataset: Dataset,
):
    for select_col in builder.columns:
        if isinstance(select_col, Column):
            if _check_column_matches_dataset(select_col, dataset):
                return True

        elif isinstance(select_col, AliasedExpression):
            if _check_aliased_expression_matches_dataset(select_col, dataset):
                return True

        elif isinstance(select_col, Function) or isinstance(select_col, CurriedFunction):
            if _check_function_parameter_matches_dataset(select_col, dataset):
                return True

    return False


def _check_event_type_filter(errors_builder):
    top_level_conditions = _get_top_level_filter_conditions(errors_builder)

    for cond in top_level_conditions:
        if isinstance(cond, Condition):
            lhs = cond.lhs
            if isinstance(lhs, Column) and lhs.name == "type":
                if _check_event_type_condition(cond, Dataset.Events):
                    return DiscoverSavedQueryTypes.ERROR_EVENTS
                if _check_event_type_condition(cond, Dataset.Transactions):
                    return DiscoverSavedQueryTypes.TRANSACTION_LIKE


def _dataset_split_decision_inferred_from_query(
    errors_builder: ErrorsQueryBuilder, transactions_builder: DiscoverQueryBuilder
):
    """
    Infers split decision based on fields we know exclusively belong to one
    dataset or the other. Biases towards Errors dataset.
    """
    # Check the event type filter against only the errors builder because we drop
    # event type filter on transactions (since it's not a column on transactions).
    event_type_filter = _check_event_type_filter(errors_builder)
    if event_type_filter is not None:
        return event_type_filter

    if _check_top_level_conditions_match_dataset(errors_builder, Dataset.Events):
        return DiscoverSavedQueryTypes.ERROR_EVENTS

    if _check_selected_columns_match_dataset(errors_builder, Dataset.Events):
        return DiscoverSavedQueryTypes.ERROR_EVENTS

    if _check_top_level_conditions_match_dataset(transactions_builder, Dataset.Transactions):
        return DiscoverSavedQueryTypes.TRANSACTION_LIKE

    if _check_selected_columns_match_dataset(transactions_builder, Dataset.Transactions):
        return DiscoverSavedQueryTypes.TRANSACTION_LIKE

    return None


def _get_field_list(fields: list[str]) -> list[str]:
    return [field for field in fields if not is_equation(field)]


def _get_equation_list(fields: list[str]) -> list[str]:
    """equations have a prefix so that they can be easily included alongside our existing fields"""
    return [strip_equation(field) for field in fields if is_equation(field)]


def _get_snuba_dataclass(saved_query: DiscoverSavedQuery, projects: list[Project]) -> SnubaParams:
    # Default
    start, end = get_date_range_from_stats_period({"statsPeriod": "7d"})

    if "start" and "end" in saved_query.query:
        start = parse_timestamp(saved_query.query["start"]) or start
        end = parse_timestamp(saved_query.query["end"]) or end

        if start and end:
            expired, _ = outside_retention_with_modified_start(start, end, saved_query.organization)
            if expired:
                start, end = get_date_range_from_stats_period({"statsPeriod": "7d"})

    elif "range" in saved_query.query:
        try:
            start, end = get_date_range_from_stats_period(
                {"statsPeriod": saved_query.query["range"]}
            )
        except InvalidParams:
            start, end = get_date_range_from_stats_period({"statsPeriod": "7d"})

    with sentry_sdk.start_span(
        op="discover.migration.split", description="filter_params(dataclass)"
    ):
        filter_params: dict[str, Any] = {
            "start": start,
            "end": end,
            "project_id": [p.id for p in projects],
            "project_objects": projects,
            "organization_id": saved_query.organization.id,
        }
        params = SnubaParams(
            start=filter_params["start"],
            end=filter_params["end"],
            environments=filter_params.get("environment_objects", []),
            projects=filter_params["project_objects"],
            user=None,
            teams=[],
            organization=saved_query.organization,
        )
        return params


@sentry_sdk.trace
def _get_and_save_split_decision_for_query(
    saved_query: DiscoverSavedQuery, dry_run: bool
) -> tuple[int, bool]:
    """
    This function is called by the SplitDiscoverDataset job in getsentry. It contains logic specifically
    to split a Discover Saved Query with "Discover" dataset type into
    either Errors or Transactions.
    """

    # We use all projects for the clickhouse query but don't do anything
    # with the data returned other than check if data exists. So this
    # all projects query should be a safe operation.
    projects = saved_query.projects.all() or Project.objects.filter(
        organization_id=saved_query.organization.id, status=ObjectStatus.ACTIVE
    )
    snuba_dataclass = _get_snuba_dataclass(saved_query, list(projects))
    selected_columns = _get_field_list(saved_query.query.get("fields", []))
    equations = _get_equation_list(saved_query.query.get("fields", []))
    query = saved_query.query.get("query", "")

    # Optimizing the query we're running a little - we're omitting the order by
    # and setting limit = 1 since the only check happening with the data returned
    # is if data exists.
    errors_builder = ErrorsQueryBuilder(
        Dataset.Events,
        params={},
        snuba_params=snuba_dataclass,
        query=query,
        selected_columns=selected_columns,
        equations=equations,
        limit=1,
    )

    transactions_builder = DiscoverQueryBuilder(
        Dataset.Transactions,
        params={},
        snuba_params=snuba_dataclass,
        query=query,
        selected_columns=selected_columns,
        equations=equations,
        limit=1,
    )

    dataset_inferred_from_query = _dataset_split_decision_inferred_from_query(
        errors_builder, transactions_builder
    )

    if dataset_inferred_from_query is not None:
        if dry_run:
            logger.info("Split decision for %s: %s", saved_query.id, dataset_inferred_from_query)
        else:
            _save_split_decision_for_query(
                saved_query,
                dataset_inferred_from_query,
                DatasetSourcesTypes.INFERRED,
            )
        return dataset_inferred_from_query, False

    has_errors = False
    try:
        error_results = errors_builder.process_results(
            errors_builder.run_query(
                "backfill_discover_dataset", query_source=QuerySource.SENTRY_BACKEND
            )
        )
        has_errors = len(error_results["data"]) > 0
    except (snuba.QueryIllegalTypeOfArgument, snuba.UnqualifiedQueryError):
        pass

    if has_errors:
        if dry_run:
            logger.info(
                "Split decision for %s: %s (inferred from running query)",
                saved_query.id,
                DiscoverSavedQueryTypes.ERROR_EVENTS,
            )
        else:
            _save_split_decision_for_query(
                saved_query,
                DiscoverSavedQueryTypes.ERROR_EVENTS,
                DatasetSourcesTypes.INFERRED,
            )
        return DiscoverSavedQueryTypes.ERROR_EVENTS, True

    has_transactions = False
    try:
        transaction_results = transactions_builder.process_results(
            transactions_builder.run_query(
                "backfill_discover_dataset", query_source=QuerySource.SENTRY_BACKEND
            )
        )
        has_transactions = len(transaction_results["data"]) > 0
    except (snuba.QueryIllegalTypeOfArgument, snuba.UnqualifiedQueryError):
        pass

    if has_transactions:
        if dry_run:
            logger.info(
                "Split decision for %s: %s (inferred from running query)",
                saved_query.id,
                DiscoverSavedQueryTypes.TRANSACTION_LIKE,
            )
        else:
            _save_split_decision_for_query(
                saved_query,
                DiscoverSavedQueryTypes.TRANSACTION_LIKE,
                DatasetSourcesTypes.INFERRED,
            )

        return DiscoverSavedQueryTypes.TRANSACTION_LIKE, True

    if dry_run:
        logger.info(
            "Split decision for %s: %s (forced)",
            saved_query.id,
            DiscoverSavedQueryTypes.ERROR_EVENTS,
        )
    else:
        _save_split_decision_for_query(
            saved_query,
            DiscoverSavedQueryTypes.ERROR_EVENTS,
            DatasetSourcesTypes.FORCED,
        )

    return DiscoverSavedQueryTypes.ERROR_EVENTS, True
