from datetime import datetime
from enum import Enum
from typing import Any

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
from sentry.discover.arithmetic import is_equation, strip_equation
from sentry.exceptions import InvalidParams
from sentry.models.environment import Environment
from sentry.models.organization import Organization
from sentry.models.project import Project
from sentry.search.events.builder.discover import DiscoverQueryBuilder
from sentry.search.events.builder.errors import ErrorsQueryBuilder
from sentry.search.events.filter import to_list
from sentry.search.events.types import SnubaParams
from sentry.snuba.dataset import Dataset
from sentry.utils.dates import outside_retention_with_modified_start


class SplitDataset(Enum):
    Errors = 0
    Transactions = 1


TRANSACTION_ONLY_AGGREGATES = [
    "failure_rate",
    "failure_count",
    "apdex",
    "count_miserable",
    "user_misery",
    "count_web_vitals",
    "percentile",
    "p50",
    "p75",
    "p90",
    "p95",
    "p99",
    "p100",
]

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

ERROR_ONLY_AGGREGATES = ["last_seen"]

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


def _get_top_level_filter_conditions(
    builder: ErrorsQueryBuilder | DiscoverQueryBuilder,
) -> list[Condition | BooleanCondition]:
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


def _check_function_alias_matches_dataset(
    function: Function | CurriedFunction,
    dataset: Dataset,
) -> bool:
    aggregate_aliases = (
        TRANSACTION_ONLY_AGGREGATES if dataset == Dataset.Transactions else ERROR_ONLY_AGGREGATES
    )

    for alias in aggregate_aliases:
        if function.alias.startswith(alias):
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


def _check_event_type_condition(cond: Condition, dataset: Dataset) -> bool:
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
) -> bool:
    top_level_conditions = _get_top_level_filter_conditions(builder)
    for cond in top_level_conditions:
        if isinstance(cond, Condition):
            if _check_condition_matches_dataset(cond, dataset):
                return True

    return False


def _check_selected_columns_match_dataset(
    builder: ErrorsQueryBuilder | DiscoverQueryBuilder,
    dataset: Dataset,
) -> bool:
    for select_col in builder.columns:
        if isinstance(select_col, Column):
            if _check_column_matches_dataset(select_col, dataset):
                return True

        elif isinstance(select_col, AliasedExpression):
            if _check_aliased_expression_matches_dataset(select_col, dataset):
                return True

        elif isinstance(select_col, Function) or isinstance(select_col, CurriedFunction):
            # The parameter check is a stronger check if applicable, so we should keep that first
            if _check_function_parameter_matches_dataset(select_col, dataset):
                return True
            if _check_function_alias_matches_dataset(select_col, dataset):
                return True

    return False


def _check_event_type_filter(errors_builder: ErrorsQueryBuilder) -> SplitDataset | None:
    top_level_conditions = _get_top_level_filter_conditions(errors_builder)

    for cond in top_level_conditions:
        if isinstance(cond, Condition):
            lhs = cond.lhs
            if isinstance(lhs, Column) and lhs.name == "type":
                if _check_event_type_condition(cond, Dataset.Events):
                    return SplitDataset.Errors
                if _check_event_type_condition(cond, Dataset.Transactions):
                    return SplitDataset.Transactions

    return None


def _dataset_split_decision_inferred_from_query(
    errors_builder: ErrorsQueryBuilder, transactions_builder: DiscoverQueryBuilder
) -> SplitDataset | None:
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
        return SplitDataset.Errors

    if _check_selected_columns_match_dataset(errors_builder, Dataset.Events):
        return SplitDataset.Errors

    if _check_top_level_conditions_match_dataset(transactions_builder, Dataset.Transactions):
        return SplitDataset.Transactions

    if _check_selected_columns_match_dataset(transactions_builder, Dataset.Transactions):
        return SplitDataset.Transactions

    return None


def _get_field_list(fields: list[str]) -> list[str]:
    return [field for field in fields if not is_equation(field)]


def _get_equation_list(fields: list[str]) -> list[str]:
    """equations have a prefix so that they can be easily included alongside our existing fields"""
    return [strip_equation(field) for field in fields if is_equation(field)]


def _get_snuba_dataclass(
    organization: Organization,
    projects: list[Project],
    start: datetime | None,
    end: datetime | None,
    period: str | None,
    environment: list[str] | str | None,
) -> SnubaParams:
    default_start, default_end = get_date_range_from_stats_period({"statsPeriod": "7d"})

    if start and end:
        expired, _ = outside_retention_with_modified_start(start, end, organization)
        if expired:
            start, end = get_date_range_from_stats_period({"statsPeriod": "7d"})

    elif period:
        try:
            start, end = get_date_range_from_stats_period({"statsPeriod": period})
        except InvalidParams:
            start, end = get_date_range_from_stats_period({"statsPeriod": "7d"})

    filter_params: dict[str, Any] = {
        "start": start or default_start,
        "end": end or default_end,
        "project_id": [p.id for p in projects],
        "project_objects": projects,
        "organization_id": organization.id,
    }

    if environment:
        environment_objects = list(
            Environment.objects.filter(
                organization_id=organization.id,
                name__in=to_list(environment),
            )
        )
        if environment_objects:
            filter_params["environment_objects"] = environment_objects

    return SnubaParams(
        start=filter_params["start"],
        end=filter_params["end"],
        environments=filter_params.get("environment_objects", []),
        projects=filter_params["project_objects"],
        user=None,
        teams=[],
        organization=organization,
    )
