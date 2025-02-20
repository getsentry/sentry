from __future__ import annotations

from collections.abc import Callable, Mapping
from datetime import datetime
from typing import TypedDict

import sentry_sdk
from snuba_sdk import Column, Condition, Function, Identifier, Op, OrderBy

from sentry.api.event_search import SearchFilter
from sentry.exceptions import IncompatibleMetricsQuery, InvalidSearchQuery
from sentry.search.events import constants, fields
from sentry.search.events.builder import spans_metrics
from sentry.search.events.datasets import field_aliases, filter_aliases, function_aliases
from sentry.search.events.datasets.base import DatasetConfig
from sentry.search.events.fields import SnQLStringArg, get_function_alias
from sentry.search.events.types import SelectType, WhereType
from sentry.search.utils import DEVICE_CLASS
from sentry.snuba.referrer import Referrer


class Args(TypedDict):
    scope: str
    column: str


class SpansMetricsDatasetConfig(DatasetConfig):
    missing_function_error = IncompatibleMetricsQuery
    nullable_metrics = {
        constants.SPAN_MESSAGING_LATENCY,
        constants.SPAN_METRICS_MAP["cache.item_size"],
        constants.SPAN_METRICS_MAP["ai.total_cost"],
        constants.SPAN_METRICS_MAP["ai.total_tokens.used"],
    }

    def __init__(self, builder: spans_metrics.SpansMetricsQueryBuilder):
        self.builder = builder
        self.total_span_duration: float | None = None

    @property
    def search_filter_converter(
        self,
    ) -> Mapping[str, Callable[[SearchFilter], WhereType | None]]:
        return {
            "message": self._message_filter_converter,
            constants.SPAN_DOMAIN_ALIAS: self._span_domain_filter_converter,
            constants.DEVICE_CLASS_ALIAS: self._device_class_filter_converter,
        }

    @property
    def field_alias_converter(self) -> Mapping[str, Callable[[str], SelectType]]:
        return {
            constants.SPAN_MODULE_ALIAS: self._resolve_span_module,
            constants.SPAN_DOMAIN_ALIAS: self._resolve_span_domain,
            constants.UNIQUE_SPAN_DOMAIN_ALIAS: self._resolve_unique_span_domains,
            constants.DEVICE_CLASS_ALIAS: lambda alias: field_aliases.resolve_device_class(
                self.builder, alias
            ),
            constants.PROJECT_ALIAS: lambda alias: field_aliases.resolve_project_slug_alias(
                self.builder, alias
            ),
            constants.PROJECT_NAME_ALIAS: lambda alias: field_aliases.resolve_project_slug_alias(
                self.builder, alias
            ),
        }

    def resolve_metric(self, value: str) -> int:
        metric_id = self.builder.resolve_metric_index(constants.SPAN_METRICS_MAP.get(value, value))
        # If its still None its not a custom measurement
        if metric_id is None:
            if constants.SPAN_METRICS_MAP.get(value, value) in self.nullable_metrics:
                metric_id = 0
            else:
                raise IncompatibleMetricsQuery(f"Metric: {value} could not be resolved")
        if metric_id != 0:
            self.builder.metric_ids.add(metric_id)
        return metric_id

    @property
    def function_converter(self) -> Mapping[str, fields.MetricsFunction]:
        """While the final functions in clickhouse must have their -Merge combinators in order to function, we don't
        need to add them here since snuba has a FunctionMapper that will add it for us. Basically it turns expressions
        like quantiles(0.9)(value) into quantilesMerge(0.9)(percentiles)
        Make sure to update METRIC_FUNCTION_LIST_BY_TYPE when adding functions here, can't be a dynamic list since the
        Metric Layer will actually handle which dataset each function goes to
        """
        resolve_metric_id = {
            "name": "metric_id",
            "fn": lambda args: self.resolve_metric(args["column"]),
        }

        function_converter = {
            function.name: function
            for function in [
                fields.MetricsFunction(
                    "count_unique",
                    required_args=[
                        fields.MetricArg(
                            "column",
                            allowed_columns=["user", "transaction"],
                            allow_custom_measurements=False,
                        )
                    ],
                    calculated_args=[resolve_metric_id],
                    snql_set=lambda args, alias: Function(
                        "uniqIf",
                        [
                            Column("value"),
                            Function("equals", [Column("metric_id"), args["metric_id"]]),
                        ],
                        alias,
                    ),
                    default_result_type="integer",
                ),
                fields.MetricsFunction(
                    "epm",
                    snql_distribution=self._resolve_epm,
                    optional_args=[fields.IntervalDefault("interval", 1, None)],
                    default_result_type="rate",
                ),
                fields.MetricsFunction(
                    "eps",
                    snql_distribution=self._resolve_eps,
                    optional_args=[fields.IntervalDefault("interval", 1, None)],
                    default_result_type="rate",
                ),
                fields.MetricsFunction(
                    "count",
                    snql_distribution=lambda args, alias: Function(
                        "countIf",
                        [
                            Column("value"),
                            Function(
                                "equals",
                                [
                                    Column("metric_id"),
                                    self.resolve_metric("span.self_time"),
                                ],
                            ),
                        ],
                        alias,
                    ),
                    default_result_type="integer",
                ),
                fields.MetricsFunction(
                    "count_if",
                    required_args=[
                        fields.MetricArg(
                            "if_col",
                            allowed_columns=["release"],
                        ),
                        fields.SnQLStringArg(
                            "if_val", unquote=True, unescape_quotes=True, optional_unquote=True
                        ),
                    ],
                    snql_distribution=lambda args, alias: Function(
                        "countIf",
                        [
                            Column("value"),
                            Function(
                                "and",
                                [
                                    Function(
                                        "equals",
                                        [
                                            Column("metric_id"),
                                            self.resolve_metric("span.self_time"),
                                        ],
                                    ),
                                    Function(
                                        "equals",
                                        [self.builder.column(args["if_col"]), args["if_val"]],
                                    ),
                                ],
                            ),
                        ],
                        alias,
                    ),
                    default_result_type="integer",
                ),
                fields.MetricsFunction(
                    "division",
                    required_args=[
                        fields.MetricArg(
                            # the dividend, needs to be named column, otherwise the query builder won't be able to determine the correct target table
                            "column",
                            allow_custom_measurements=False,
                        ),
                        fields.MetricArg(
                            "divisorColumn",
                            allow_custom_measurements=False,
                        ),
                    ],
                    snql_gauge=self._resolve_division,
                    snql_distribution=self._resolve_division,
                    default_result_type="percentage",
                ),
                fields.MetricsFunction(
                    "division_if",
                    required_args=[
                        fields.MetricArg(
                            # the dividend, needs to be named column, otherwise the query builder won't be able to determine the correct target table
                            "column",
                            allow_custom_measurements=False,
                        ),
                        fields.MetricArg(
                            "divisorColumn",
                            allow_custom_measurements=False,
                        ),
                        fields.MetricArg(
                            "if_col",
                            allowed_columns=["release"],
                        ),
                        fields.SnQLStringArg(
                            "if_val", unquote=True, unescape_quotes=True, optional_unquote=True
                        ),
                    ],
                    snql_gauge=self._resolve_division_if,
                    snql_distribution=self._resolve_division_if,
                    default_result_type="percentage",
                ),
                fields.MetricsFunction(
                    "sum",
                    optional_args=[
                        fields.with_default(
                            "span.self_time",
                            fields.MetricArg(
                                "column",
                                allowed_columns=constants.SPAN_METRIC_SUMMABLE_COLUMNS,
                                allow_custom_measurements=False,
                            ),
                        ),
                    ],
                    calculated_args=[resolve_metric_id],
                    snql_distribution=lambda args, alias: Function(
                        "sumIf",
                        [
                            Column("value"),
                            Function("equals", [Column("metric_id"), args["metric_id"]]),
                        ],
                        alias,
                    ),
                    snql_counter=lambda args, alias: Function(
                        "sumIf",
                        [
                            Column("value"),
                            Function("equals", [Column("metric_id"), args["metric_id"]]),
                        ],
                        alias,
                    ),
                    default_result_type="duration",
                ),
                fields.MetricsFunction(
                    "avg",
                    optional_args=[
                        fields.with_default(
                            "span.self_time",
                            fields.MetricArg(
                                "column",
                                allowed_columns=constants.SPAN_METRIC_DURATION_COLUMNS
                                | constants.SPAN_METRIC_BYTES_COLUMNS
                                | constants.SPAN_METRIC_COUNT_COLUMNS,
                            ),
                        ),
                    ],
                    calculated_args=[resolve_metric_id],
                    snql_gauge=self._resolve_avg,
                    snql_distribution=self._resolve_avg,
                    result_type_fn=self.reflective_result_type(),
                    default_result_type="duration",
                ),
                fields.MetricsFunction(
                    "avg_if",
                    required_args=[
                        fields.MetricArg(
                            "column",
                            allowed_columns=constants.SPAN_METRIC_DURATION_COLUMNS
                            | constants.SPAN_METRIC_COUNT_COLUMNS,
                        ),
                        fields.MetricArg(
                            "if_col",
                            allowed_columns=["release", "span.op"],
                        ),
                        fields.SnQLStringArg(
                            "if_val", unquote=True, unescape_quotes=True, optional_unquote=True
                        ),
                    ],
                    calculated_args=[resolve_metric_id],
                    snql_gauge=self._resolve_avg_if,
                    snql_distribution=self._resolve_avg_if,
                    result_type_fn=self.reflective_result_type(),
                    default_result_type="duration",
                ),
                fields.MetricsFunction(
                    "percentile",
                    required_args=[
                        fields.with_default(
                            "span.self_time",
                            fields.MetricArg(
                                "column", allowed_columns=constants.SPAN_METRIC_DURATION_COLUMNS
                            ),
                        ),
                        fields.NumberRange("percentile", 0, 1),
                    ],
                    calculated_args=[resolve_metric_id],
                    snql_distribution=function_aliases.resolve_metrics_percentile,
                    is_percentile=True,
                    result_type_fn=self.reflective_result_type(),
                    default_result_type="duration",
                ),
                fields.MetricsFunction(
                    "p50",
                    optional_args=[
                        fields.with_default(
                            "span.self_time",
                            fields.MetricArg(
                                "column",
                                allowed_columns=constants.SPAN_METRIC_DURATION_COLUMNS,
                                allow_custom_measurements=False,
                            ),
                        ),
                    ],
                    calculated_args=[resolve_metric_id],
                    snql_distribution=lambda args, alias: function_aliases.resolve_metrics_percentile(
                        args=args, alias=alias, fixed_percentile=0.50
                    ),
                    is_percentile=True,
                    default_result_type="duration",
                ),
                fields.MetricsFunction(
                    "p75",
                    optional_args=[
                        fields.with_default(
                            "span.self_time",
                            fields.MetricArg(
                                "column",
                                allowed_columns=constants.SPAN_METRIC_DURATION_COLUMNS,
                                allow_custom_measurements=False,
                            ),
                        ),
                    ],
                    calculated_args=[resolve_metric_id],
                    snql_distribution=lambda args, alias: function_aliases.resolve_metrics_percentile(
                        args=args, alias=alias, fixed_percentile=0.75
                    ),
                    is_percentile=True,
                    default_result_type="duration",
                ),
                fields.MetricsFunction(
                    "p95",
                    optional_args=[
                        fields.with_default(
                            "span.self_time",
                            fields.MetricArg(
                                "column",
                                allowed_columns=constants.SPAN_METRIC_DURATION_COLUMNS,
                                allow_custom_measurements=False,
                            ),
                        ),
                    ],
                    calculated_args=[resolve_metric_id],
                    snql_distribution=lambda args, alias: function_aliases.resolve_metrics_percentile(
                        args=args, alias=alias, fixed_percentile=0.95
                    ),
                    is_percentile=True,
                    default_result_type="duration",
                ),
                fields.MetricsFunction(
                    "p99",
                    optional_args=[
                        fields.with_default(
                            "span.self_time",
                            fields.MetricArg(
                                "column",
                                allowed_columns=constants.SPAN_METRIC_DURATION_COLUMNS,
                                allow_custom_measurements=False,
                            ),
                        ),
                    ],
                    calculated_args=[resolve_metric_id],
                    snql_distribution=lambda args, alias: function_aliases.resolve_metrics_percentile(
                        args=args, alias=alias, fixed_percentile=0.99
                    ),
                    is_percentile=True,
                    default_result_type="duration",
                ),
                fields.MetricsFunction(
                    "p100",
                    optional_args=[
                        fields.with_default(
                            "span.self_time",
                            fields.MetricArg(
                                "column",
                                allowed_columns=constants.SPAN_METRIC_DURATION_COLUMNS,
                                allow_custom_measurements=False,
                            ),
                        ),
                    ],
                    calculated_args=[resolve_metric_id],
                    snql_distribution=lambda args, alias: function_aliases.resolve_metrics_percentile(
                        args=args, alias=alias, fixed_percentile=1
                    ),
                    is_percentile=True,
                    default_result_type="duration",
                ),
                fields.MetricsFunction(
                    "time_spent_percentage",
                    optional_args=[
                        fields.with_default(
                            "app", fields.SnQLStringArg("scope", allowed_strings=["app", "local"])
                        ),
                        fields.with_default(
                            "span.self_time",
                            fields.MetricArg(
                                "column", allowed_columns=constants.SPAN_METRIC_DURATION_COLUMNS
                            ),
                        ),
                    ],
                    snql_distribution=self._resolve_time_spent_percentage,
                    default_result_type="percentage",
                ),
                fields.MetricsFunction(
                    "http_response_rate",
                    required_args=[
                        SnQLStringArg("code"),
                    ],
                    snql_distribution=lambda args, alias: function_aliases.resolve_division(
                        self._resolve_http_response_count(args),
                        Function(
                            "countIf",
                            [
                                Column("value"),
                                Function(
                                    "equals",
                                    [
                                        Column("metric_id"),
                                        self.resolve_metric("span.self_time"),
                                    ],
                                ),
                            ],
                        ),
                        alias,
                    ),
                    default_result_type="percentage",
                ),
                fields.MetricsFunction(
                    "cache_hit_rate",
                    snql_distribution=lambda args, alias: function_aliases.resolve_division(
                        self._resolve_cache_hit_count(args),
                        self._resolve_cache_hit_and_miss_count(args),
                        alias,
                    ),
                    default_result_type="percentage",
                ),
                fields.MetricsFunction(
                    "cache_miss_rate",
                    snql_distribution=lambda args, alias: function_aliases.resolve_division(
                        self._resolve_cache_miss_count(args),
                        self._resolve_cache_hit_and_miss_count(args),
                        alias,
                    ),
                    default_result_type="percentage",
                ),
                # TODO: Deprecated, use `http_response_rate(5)` instead
                fields.MetricsFunction(
                    "http_error_rate",
                    snql_distribution=lambda args, alias: function_aliases.resolve_division(
                        self._resolve_http_error_count(args),
                        Function(
                            "countIf",
                            [
                                Column("value"),
                                Function(
                                    "equals",
                                    [
                                        Column("metric_id"),
                                        self.resolve_metric("span.self_time"),
                                    ],
                                ),
                            ],
                        ),
                        alias,
                    ),
                    default_result_type="percentage",
                ),
                fields.MetricsFunction(
                    "http_response_count",
                    required_args=[
                        SnQLStringArg("code"),
                    ],
                    snql_distribution=self._resolve_http_response_count,
                    default_result_type="integer",
                ),
                # TODO: Deprecated, use `http_response_count(5)` instead
                fields.MetricsFunction(
                    "http_error_count",
                    snql_distribution=self._resolve_http_error_count,
                    default_result_type="integer",
                ),
                fields.MetricsFunction(
                    "ttid_contribution_rate",
                    snql_distribution=lambda args, alias: function_aliases.resolve_division(
                        self._resolve_ttid_count(args),
                        Function(
                            "countIf",
                            [
                                Column("value"),
                                Function(
                                    "equals",
                                    [
                                        Column("metric_id"),
                                        self.resolve_metric("span.self_time"),
                                    ],
                                ),
                            ],
                        ),
                        alias,
                    ),
                    default_result_type="percentage",
                ),
                fields.MetricsFunction(
                    "ttid_count",
                    snql_distribution=self._resolve_ttid_count,
                    default_result_type="integer",
                ),
                fields.MetricsFunction(
                    "ttfd_contribution_rate",
                    snql_distribution=lambda args, alias: function_aliases.resolve_division(
                        self._resolve_ttfd_count(args),
                        Function(
                            "countIf",
                            [
                                Column("value"),
                                Function(
                                    "equals",
                                    [
                                        Column("metric_id"),
                                        self.resolve_metric("span.self_time"),
                                    ],
                                ),
                            ],
                        ),
                        alias,
                    ),
                    default_result_type="percentage",
                ),
                fields.MetricsFunction(
                    "ttfd_count",
                    snql_distribution=self._resolve_ttfd_count,
                    default_result_type="integer",
                ),
                fields.MetricsFunction(
                    "main_thread_count",
                    snql_distribution=self._resolve_main_thread_count,
                    default_result_type="integer",
                ),
                fields.MetricsFunction(
                    "avg_compare",
                    required_args=[
                        fields.MetricArg(
                            "column",
                            allowed_columns=constants.SPAN_METRIC_DURATION_COLUMNS
                            | constants.SPAN_METRIC_COUNT_COLUMNS,
                            allow_custom_measurements=False,
                        ),
                        fields.MetricArg(
                            "comparison_column",
                            allowed_columns=["release"],
                        ),
                        fields.SnQLStringArg(
                            "first_value", unquote=True, unescape_quotes=True, optional_unquote=True
                        ),
                        fields.SnQLStringArg(
                            "second_value",
                            unquote=True,
                            unescape_quotes=True,
                            optional_unquote=True,
                        ),
                    ],
                    calculated_args=[resolve_metric_id],
                    snql_gauge=self._resolve_avg_compare,
                    snql_distribution=self._resolve_avg_compare,
                    default_result_type="percent_change",
                ),
                fields.MetricsFunction(
                    "regression_score",
                    required_args=[
                        fields.MetricArg(
                            "column",
                            allowed_columns=constants.SPAN_METRIC_DURATION_COLUMNS,
                            allow_custom_measurements=False,
                        ),
                        fields.TimestampArg("timestamp"),
                    ],
                    calculated_args=[resolve_metric_id],
                    snql_distribution=self._resolve_regression_score,
                    default_result_type="number",
                ),
                fields.MetricsFunction(
                    "avg_by_timestamp",
                    required_args=[
                        fields.MetricArg(
                            "column",
                            allowed_columns=constants.SPAN_METRIC_DURATION_COLUMNS,
                        ),
                        fields.SnQLStringArg("condition", allowed_strings=["greater", "less"]),
                        fields.TimestampArg("timestamp"),
                    ],
                    calculated_args=[resolve_metric_id],
                    snql_distribution=lambda args, alias: self._resolve_avg_condition(
                        args, args["condition"], alias
                    ),
                    default_result_type="duration",
                ),
                fields.MetricsFunction(
                    "epm_by_timestamp",
                    required_args=[
                        fields.SnQLStringArg("condition", allowed_strings=["greater", "less"]),
                        fields.TimestampArg("timestamp"),
                    ],
                    snql_distribution=lambda args, alias: self._resolve_epm_condition(
                        args, args["condition"], alias
                    ),
                    default_result_type="rate",
                ),
                fields.MetricsFunction(
                    "any",
                    required_args=[fields.MetricArg("column")],
                    # Not actually using `any` so that this function returns consistent results
                    snql_distribution=lambda args, alias: Function(
                        "min",
                        [self.builder.column(args["column"])],
                        alias,
                    ),
                    result_type_fn=self.reflective_result_type(),
                    default_result_type="string",
                    redundant_grouping=True,
                ),
                fields.MetricsFunction(
                    "count_op",
                    required_args=[
                        SnQLStringArg("op"),
                    ],
                    snql_distribution=self._resolve_count_op,
                    default_result_type="integer",
                ),
                fields.MetricsFunction(
                    "count_publish",
                    snql_distribution=self._resolve_count_publish,
                    default_result_type="integer",
                ),
                fields.MetricsFunction(
                    "count_process",
                    snql_distribution=self._resolve_count_process,
                    default_result_type="integer",
                ),
                fields.MetricsFunction(
                    "avg_if_publish",
                    required_args=[
                        fields.MetricArg(
                            "column",
                            allowed_columns=constants.SPAN_METRIC_DURATION_COLUMNS
                            | constants.SPAN_METRIC_COUNT_COLUMNS,
                        ),
                    ],
                    calculated_args=[resolve_metric_id],
                    snql_gauge=self._resolve_avg_if_publish,
                    snql_distribution=self._resolve_avg_if_publish,
                    result_type_fn=self.reflective_result_type(),
                    default_result_type="duration",
                ),
                fields.MetricsFunction(
                    "avg_if_process",
                    required_args=[
                        fields.MetricArg(
                            "column",
                            allowed_columns=constants.SPAN_METRIC_DURATION_COLUMNS
                            | constants.SPAN_METRIC_COUNT_COLUMNS,
                        ),
                    ],
                    calculated_args=[resolve_metric_id],
                    snql_gauge=self._resolve_avg_if_process,
                    snql_distribution=self._resolve_avg_if_process,
                    result_type_fn=self.reflective_result_type(),
                    default_result_type="duration",
                ),
                fields.MetricsFunction(
                    "trace_status_rate",
                    required_args=[
                        SnQLStringArg("status"),
                    ],
                    snql_distribution=lambda args, alias: function_aliases.resolve_division(
                        self._resolve_trace_status_count(args),
                        Function(
                            "countIf",
                            [
                                Column("value"),
                                Function(
                                    "equals",
                                    [
                                        Column("metric_id"),
                                        self.resolve_metric("span.self_time"),
                                    ],
                                ),
                            ],
                        ),
                        alias,
                    ),
                    default_result_type="percentage",
                ),
                fields.MetricsFunction(
                    "trace_error_rate",
                    snql_distribution=lambda args, alias: function_aliases.resolve_division(
                        self._resolve_trace_error_count(args),
                        Function(
                            "countIf",
                            [
                                Column("value"),
                                Function(
                                    "equals",
                                    [
                                        Column("metric_id"),
                                        self.resolve_metric("span.self_time"),
                                    ],
                                ),
                            ],
                        ),
                        alias,
                    ),
                    default_result_type="percentage",
                ),
            ]
        }

        for alias, name in constants.SPAN_FUNCTION_ALIASES.items():
            if name in function_converter:
                function_converter[alias] = function_converter[name].alias_as(alias)

        return function_converter

    def _message_filter_converter(self, search_filter: SearchFilter) -> WhereType | None:
        return filter_aliases.message_filter_converter(self.builder, search_filter)

    def _span_domain_filter_converter(self, search_filter: SearchFilter) -> WhereType | None:
        value = search_filter.value.value
        if search_filter.value.is_wildcard():
            value = search_filter.value.value[1:-1]
            return Condition(
                Function(
                    "arrayExists",
                    [
                        Function(
                            "lambda",
                            [
                                Function("tuple", [Identifier("x")]),
                                Function("match", [Identifier("x"), f"(?i){value}"]),
                            ],
                        ),
                        self._resolve_span_domain(),
                    ],
                ),
                Op(search_filter.operator),
                1,
            )
        elif value == "":
            operator = Op.LTE if search_filter.operator == "=" else Op.GT
            return Condition(Function("length", [self._resolve_span_domain()]), operator, 0)
        else:
            return Condition(
                Function("has", [self._resolve_span_domain(), value]),
                Op.NEQ if search_filter.operator in constants.EQUALITY_OPERATORS else Op.EQ,
                0,
            )

    def _device_class_filter_converter(self, search_filter: SearchFilter) -> SelectType:
        return filter_aliases.device_class_converter(
            self.builder, search_filter, {**DEVICE_CLASS, "Unknown": {""}}
        )

    def _resolve_span_module(self, alias: str) -> SelectType:
        return field_aliases.resolve_span_module(self.builder, alias)

    def _resolve_span_domain(self, alias: str | None = None) -> SelectType:
        return Function(
            "arrayFilter",
            [
                Function(
                    "lambda",
                    [Function("tuple", [Identifier("x")]), Function("notEmpty", [Identifier("x")])],
                ),
                Function(
                    "splitByChar",
                    [
                        constants.SPAN_DOMAIN_SEPARATOR,
                        self.builder.column("span.domain"),
                    ],
                ),
            ],
            alias,
        )

    def _resolve_unique_span_domains(
        self,
        alias: str | None = None,
    ) -> SelectType:
        return Function("arrayJoin", [self._resolve_span_domain()], alias)

    # Query Functions
    def _resolve_count_if(
        self,
        metric_condition: Function,
        condition: Function,
        alias: str | None = None,
    ) -> SelectType:
        return Function(
            "countIf",
            [
                Column("value"),
                Function(
                    "and",
                    [
                        metric_condition,
                        condition,
                    ],
                ),
            ],
            alias,
        )

    def _resolve_total_span_duration(self, alias: str, scope: str, column: str) -> SelectType:
        """This calculates the total time, and based on the scope will return
        either the apps total time or whatever other local scope/filters are
        applied.
        This must be cached since it runs another query."""
        self.builder.requires_other_aggregates = True
        if self.total_span_duration is not None:
            return Function("toFloat64", [self.total_span_duration], alias)

        total_query = spans_metrics.SpansMetricsQueryBuilder(
            dataset=self.builder.dataset,
            params={},
            snuba_params=self.builder.params,
            query=self.builder.query if scope == "local" else None,
            selected_columns=[f"sum({column})"],
        )
        sentry_sdk.set_tag("query.resolved_total", scope)

        total_results = total_query.run_query(
            Referrer.API_DISCOVER_TOTAL_SUM_TRANSACTION_DURATION_FIELD.value
        )
        results = total_query.process_results(total_results)

        if len(results["data"]) != 1:
            self.total_span_duration = 0
            return Function("toFloat64", [0], alias)
        self.total_span_duration = results["data"][0][get_function_alias(f"sum({column})")]
        return Function("toFloat64", [self.total_span_duration], alias)

    def _resolve_time_spent_percentage(self, args: Args, alias: str) -> SelectType:
        total_time = self._resolve_total_span_duration(
            constants.TOTAL_SPAN_DURATION_ALIAS, args["scope"], args["column"]
        )
        metric_id = self.resolve_metric(args["column"])

        return function_aliases.resolve_division(
            Function(
                "sumIf",
                [
                    Column("value"),
                    Function("equals", [Column("metric_id"), metric_id]),
                ],
            ),
            total_time,
            alias,
        )

    def _resolve_cache_hit_count(
        self,
        _: Mapping[str, str | Column | SelectType | int | float],
        alias: str | None = None,
    ) -> SelectType:

        return self._resolve_count_if(
            Function(
                "equals",
                [
                    Column("metric_id"),
                    self.resolve_metric("span.self_time"),
                ],
            ),
            Function(
                "equals",
                [
                    self.builder.column("cache.hit"),
                    self.builder.resolve_tag_value("true"),
                ],
            ),
            alias,
        )

    def _resolve_cache_miss_count(
        self,
        _: Mapping[str, str | Column | SelectType | int | float],
        alias: str | None = None,
    ) -> SelectType:

        return self._resolve_count_if(
            Function(
                "equals",
                [
                    Column("metric_id"),
                    self.resolve_metric("span.self_time"),
                ],
            ),
            Function(
                "equals",
                [
                    self.builder.column("cache.hit"),
                    self.builder.resolve_tag_value("false"),
                ],
            ),
            alias,
        )

    def _resolve_cache_hit_and_miss_count(
        self,
        _: Mapping[str, str | Column | SelectType | int | float],
        alias: str | None = None,
    ) -> SelectType:

        statuses = [self.builder.resolve_tag_value(status) for status in constants.CACHE_HIT_STATUS]

        return self._resolve_count_if(
            Function(
                "equals",
                [
                    Column("metric_id"),
                    self.resolve_metric("span.self_time"),
                ],
            ),
            Function(
                "in",
                [
                    self.builder.column("cache.hit"),
                    list(status for status in statuses if status is not None),
                ],
            ),
            alias,
        )

    def _resolve_http_response_count(
        self,
        args: Mapping[str, str | Column | SelectType | int | float],
        alias: str | None = None,
    ) -> SelectType:
        condition = Function(
            "startsWith",
            [
                self.builder.column("span.status_code"),
                args["code"],
            ],
        )

        return self._resolve_count_if(
            Function(
                "equals",
                [
                    Column("metric_id"),
                    self.resolve_metric("span.self_time"),
                ],
            ),
            condition,
            alias,
        )

    def _resolve_http_error_count(
        self,
        _: Mapping[str, str | Column | SelectType | int | float],
        alias: str | None = None,
        extra_condition: Function | None = None,
    ) -> SelectType:
        statuses = [
            self.builder.resolve_tag_value(status) for status in constants.HTTP_SERVER_ERROR_STATUS
        ]
        base_condition = Function(
            "in",
            [
                self.builder.column("span.status_code"),
                list(status for status in statuses if status is not None),
            ],
        )
        if extra_condition:
            condition = Function(
                "and",
                [
                    base_condition,
                    extra_condition,
                ],
            )
        else:
            condition = base_condition

        return self._resolve_count_if(
            Function(
                "equals",
                [
                    Column("metric_id"),
                    self.resolve_metric("span.self_time"),
                ],
            ),
            condition,
            alias,
        )

    def _resolve_main_thread_count(
        self,
        _: Mapping[str, str | Column | SelectType | int | float],
        alias: str | None = None,
    ) -> SelectType:
        return self._resolve_count_if(
            Function(
                "equals",
                [
                    Column("metric_id"),
                    self.resolve_metric("span.self_time"),
                ],
            ),
            Function(
                "equals",
                [
                    self.builder.column("span.main_thread"),
                    self.builder.resolve_tag_value("true"),
                ],
            ),
            alias,
        )

    def _resolve_ttid_count(
        self,
        _: Mapping[str, str | Column | SelectType | int | float],
        alias: str | None = None,
    ) -> SelectType:
        return self._resolve_count_if(
            Function(
                "equals",
                [
                    Column("metric_id"),
                    self.resolve_metric("span.self_time"),
                ],
            ),
            Function(
                "equals",
                [
                    self.builder.column("ttid"),
                    self.builder.resolve_tag_value("ttid"),
                ],
            ),
            alias,
        )

    def _resolve_ttfd_count(
        self,
        _: Mapping[str, str | Column | SelectType | int | float],
        alias: str | None = None,
    ) -> SelectType:
        return self._resolve_count_if(
            Function(
                "equals",
                [
                    Column("metric_id"),
                    self.resolve_metric("span.self_time"),
                ],
            ),
            Function(
                "equals",
                [
                    self.builder.column("ttfd"),
                    self.builder.resolve_tag_value("ttfd"),
                ],
            ),
            alias,
        )

    def _resolve_epm(
        self,
        args: dict[str, str | Column | SelectType | int | float],
        alias: str | None = None,
        extra_condition: Function | None = None,
    ) -> SelectType:
        if hasattr(self.builder, "interval"):
            args["interval"] = self.builder.interval
        return self._resolve_rate(60, args, alias, extra_condition)

    def _resolve_eps(
        self,
        args: dict[str, str | Column | SelectType | int | float],
        alias: str | None = None,
        extra_condition: Function | None = None,
    ) -> SelectType:
        if hasattr(self.builder, "interval"):
            args["interval"] = self.builder.interval
        return self._resolve_rate(None, args, alias, extra_condition)

    def _resolve_rate(
        self,
        interval: int | None,
        args: Mapping[str, str | Column | SelectType | int | float],
        alias: str | None = None,
        extra_condition: Function | None = None,
    ) -> SelectType:
        base_condition = Function(
            "equals",
            [
                Column("metric_id"),
                self.resolve_metric("span.self_time"),
            ],
        )
        if extra_condition:
            condition = Function("and", [base_condition, extra_condition])
        else:
            condition = base_condition

        return Function(
            "divide",
            [
                Function(
                    "countIf",
                    [
                        Column("value"),
                        condition,
                    ],
                ),
                (
                    args["interval"]
                    if interval is None
                    else Function("divide", [args["interval"], interval])
                ),
            ],
            alias,
        )

    def _resolve_regression_score(
        self,
        args: Mapping[str, str | Column | SelectType | int | float | datetime],
        alias: str | None = None,
    ) -> SelectType:
        return Function(
            "minus",
            [
                Function(
                    "multiply",
                    [
                        self._resolve_avg_condition(args, "greater"),
                        self._resolve_epm_condition(args, "greater"),
                    ],
                ),
                Function(
                    "multiply",
                    [
                        self._resolve_avg_condition(args, "less"),
                        self._resolve_epm_condition(args, "less"),
                    ],
                ),
            ],
            alias,
        )

    def _resolve_epm_condition(
        self,
        args: Mapping[str, str | Column | SelectType | int | float | datetime],
        condition: str,
        alias: str | None = None,
    ) -> SelectType:
        timestamp = args["timestamp"]
        if condition == "greater":
            assert isinstance(self.builder.params.end, datetime) and isinstance(
                timestamp, datetime
            ), f"params.end: {self.builder.params.end} - timestamp: {timestamp}"
            interval = (self.builder.params.end - timestamp).total_seconds()
        elif condition == "less":
            assert isinstance(self.builder.params.start, datetime) and isinstance(
                timestamp, datetime
            ), f"params.start: {self.builder.params.start} - timestamp: {timestamp}"
            interval = (timestamp - self.builder.params.start).total_seconds()
        else:
            raise InvalidSearchQuery(f"Unsupported condition for epm: {condition}")

        return Function(
            "divide",
            [
                Function(
                    "countIf",
                    [
                        Function(
                            "and",
                            [
                                Function(
                                    "equals",
                                    [
                                        Column("metric_id"),
                                        self.resolve_metric("span.duration"),
                                    ],
                                ),
                                Function(
                                    condition,
                                    [
                                        Column("timestamp"),
                                        args["timestamp"],
                                    ],
                                ),
                            ],
                        )
                    ],
                ),
                Function("divide", [interval, 60]),
            ],
            alias,
        )

    def _resolve_avg_condition(
        self,
        args: Mapping[str, str | Column | SelectType | int | float],
        condition: str,
        alias: str | None = None,
    ) -> SelectType:
        column = args["column"]
        assert isinstance(column, str), f"column: {column}"
        conditional_aggregate = Function(
            "avgIf",
            [
                Column("value"),
                Function(
                    "and",
                    [
                        Function(
                            "equals",
                            [
                                Column("metric_id"),
                                self.resolve_metric(column),
                            ],
                        ),
                        Function(condition, [Column("timestamp"), args["timestamp"]]),
                    ],
                ),
            ],
        )
        return Function(
            "if",
            [
                Function("isNaN", [conditional_aggregate]),
                0,
                conditional_aggregate,
            ],
            alias,
        )

    def _resolve_count_op(
        self,
        args: Mapping[str, str | Column | SelectType | int | float],
        alias: str | None = None,
    ) -> SelectType:
        op = args["op"]
        assert isinstance(op, str), f"op: {op}"
        return self._resolve_count_if(
            Function(
                "equals",
                [
                    Column("metric_id"),
                    self.resolve_metric("span.self_time"),
                ],
            ),
            Function(
                "equals",
                [
                    self.builder.column("span.op"),
                    self.builder.resolve_tag_value(op),
                ],
            ),
            alias,
        )

    def _is_messaging_op(self, op: str, operation_name: str, operation_type: str) -> Function:
        hasOperationNameColumn = self.builder.resolve_tag_key("messaging.operation.name")
        hasOperationTypeColumn = self.builder.resolve_tag_key("messaging.operation.type")
        return Function(
            "or",
            [
                Function(
                    "equals",
                    [
                        self.builder.column("span.op"),
                        self.builder.resolve_tag_value(op),
                    ],
                ),
                hasOperationTypeColumn
                and Function(
                    "equals",
                    [
                        self.builder.column("messaging.operation.type"),
                        self.builder.resolve_tag_value(operation_type),
                    ],
                ),
                hasOperationNameColumn
                and Function(
                    "equals",
                    [
                        self.builder.column("messaging.operation.name"),
                        self.builder.resolve_tag_value(operation_name),
                    ],
                ),
            ],
        )

    def _resolve_count_publish(self, args, alias):
        op = "queue.publish"
        operation_name = "publish"
        operation_type = "create"
        return self._resolve_count_if(
            Function(
                "equals",
                [
                    Column("metric_id"),
                    self.resolve_metric("span.self_time"),
                ],
            ),
            self._is_messaging_op(op, operation_name, operation_type),
            alias,
        )

    def _resolve_count_process(self, args, alias):
        op = "queue.process"
        operation_name = "process"
        operation_type = "process"
        return self._resolve_count_if(
            Function(
                "equals",
                [
                    Column("metric_id"),
                    self.resolve_metric("span.self_time"),
                ],
            ),
            self._is_messaging_op(op, operation_name, operation_type),
            alias,
        )

    def _resolve_avg_if_publish(self, args, alias):
        op = "queue.publish"
        operation_name = "publish"
        operation_type = "create"
        return Function(
            "avgIf",
            [
                Column("value"),
                Function(
                    "and",
                    [
                        Function(
                            "equals",
                            [
                                Column("metric_id"),
                                args["metric_id"],
                            ],
                        ),
                        self._is_messaging_op(op, operation_name, operation_type),
                    ],
                ),
            ],
            alias,
        )

    def _resolve_avg_if_process(self, args, alias):
        op = "queue.process"
        operation_name = "process"
        operation_type = "process"
        return Function(
            "avgIf",
            [
                Column("value"),
                Function(
                    "and",
                    [
                        Function(
                            "equals",
                            [
                                Column("metric_id"),
                                args["metric_id"],
                            ],
                        ),
                        self._is_messaging_op(op, operation_name, operation_type),
                    ],
                ),
            ],
            alias,
        )

    def _resolve_sum(self, metric_name: str, alias: str | None = None):
        return Function(
            "sumIf",
            [
                Column("value"),
                Function(
                    "equals",
                    [
                        Column("metric_id"),
                        self.resolve_metric(metric_name),
                    ],
                ),
            ],
            alias,
        )

    def _resolve_avg(self, args, alias):
        return Function(
            "avgIf",
            [
                Column("value"),
                Function("equals", [Column("metric_id"), args["metric_id"]]),
            ],
            alias,
        )

    def _resolve_avg_if(self, args, alias):
        return Function(
            "avgIf",
            [
                Column("value"),
                Function(
                    "and",
                    [
                        Function(
                            "equals",
                            [
                                Column("metric_id"),
                                args["metric_id"],
                            ],
                        ),
                        Function(
                            "equals",
                            [self.builder.column(args["if_col"]), args["if_val"]],
                        ),
                    ],
                ),
            ],
            alias,
        )

    def _resolve_sum_if(
        self,
        metric_name: str,
        if_col_name: str,
        if_val: SelectType,
        alias: str | None = None,
    ) -> SelectType:
        return Function(
            "sumIf",
            [
                Column("value"),
                Function(
                    "and",
                    [
                        Function(
                            "equals",
                            [
                                Column("metric_id"),
                                self.resolve_metric(metric_name),
                            ],
                        ),
                        Function(
                            "equals",
                            [self.builder.column(if_col_name), if_val],
                        ),
                    ],
                ),
            ],
            alias,
        )

    def _resolve_division_if(
        self,
        args: Mapping[str, str | Column | SelectType],
        alias: str,
    ) -> SelectType:
        return function_aliases.resolve_division(
            self._resolve_sum_if(args["column"], args["if_col"], args["if_val"]),
            self._resolve_sum_if(args["divisorColumn"], args["if_col"], args["if_val"]),
            alias,
        )

    def _resolve_division(
        self,
        args: Mapping[str, str | Column | SelectType],
        alias: str,
    ) -> SelectType:
        return function_aliases.resolve_division(
            self._resolve_sum(args["column"], None),
            self._resolve_sum(args["divisorColumn"], None),
            alias,
        )

    def _resolve_avg_compare(self, args, alias):
        return function_aliases.resolve_avg_compare(self.builder.column, args, alias)

    def _resolve_trace_status_count(
        self,
        args: Mapping[str, str | Column | SelectType | int | float],
        alias: str | None = None,
    ) -> SelectType:
        condition = Function(
            "equals",
            [
                self.builder.column("trace.status"),
                args["status"],
            ],
        )

        return self._resolve_count_if(
            Function(
                "equals",
                [
                    Column("metric_id"),
                    self.resolve_metric("span.self_time"),
                ],
            ),
            condition,
            alias,
        )

    def _resolve_trace_error_count(
        self,
        _: Mapping[str, str | Column | SelectType | int | float],
        alias: str | None = None,
    ) -> SelectType:
        success_statuses = [
            self.builder.resolve_tag_value(status) for status in constants.NON_FAILURE_STATUS
        ]
        return self._resolve_count_if(
            Function(
                "equals",
                [
                    Column("metric_id"),
                    self.resolve_metric("span.self_time"),
                ],
            ),
            Function(
                "not",
                [
                    Function(
                        "in",
                        [
                            self.builder.column("trace.status"),
                            list(status for status in success_statuses if status is not None),
                        ],
                    )
                ],
            ),
            alias,
        )

    @property
    def orderby_converter(self) -> Mapping[str, OrderBy]:
        return {}
