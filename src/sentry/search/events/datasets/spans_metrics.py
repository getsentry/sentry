from __future__ import annotations

from typing import Callable, Mapping, Optional, Union

import sentry_sdk
from snuba_sdk import Column, Function, OrderBy

from sentry.api.event_search import SearchFilter
from sentry.exceptions import IncompatibleMetricsQuery
from sentry.search.events import builder, constants, fields
from sentry.search.events.datasets import field_aliases, function_aliases
from sentry.search.events.datasets.base import DatasetConfig
from sentry.search.events.types import SelectType, WhereType
from sentry.snuba.referrer import Referrer


class SpansMetricsDatasetConfig(DatasetConfig):
    missing_function_error = IncompatibleMetricsQuery

    def __init__(self, builder: builder.SpansMetricsQueryBuilder):
        self.builder = builder
        self.total_span_duration: Optional[float] = None

    @property
    def search_filter_converter(
        self,
    ) -> Mapping[str, Callable[[SearchFilter], Optional[WhereType]]]:
        return {}

    @property
    def field_alias_converter(self) -> Mapping[str, Callable[[str], SelectType]]:
        return {constants.SPAN_MODULE_ALIAS: self._resolve_span_module}

    def resolve_metric(self, value: str) -> int:
        metric_id = self.builder.resolve_metric_index(constants.SPAN_METRICS_MAP.get(value, value))
        # If its still None its not a custom measurement
        if metric_id is None:
            raise IncompatibleMetricsQuery(f"Metric: {value} could not be resolved")
        self.builder.metric_ids.add(metric_id)
        return metric_id

    def resolve_value(self, value: str) -> int:
        value_id = self.builder.resolve_tag_value(value)

        return value_id

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
                    "sum",
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
                    snql_distribution=lambda args, alias: Function(
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
                    default_result_type="duration",
                ),
                fields.MetricsFunction(
                    "time_spent_percentage",
                    optional_args=[
                        fields.with_default(
                            "app", fields.SnQLStringArg("scope", allowed_strings=["app", "local"])
                        )
                    ],
                    snql_distribution=self._resolve_time_spent_percentage,
                    default_result_type="percentage",
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
                    default_result_type="duration",
                ),
                fields.MetricsFunction(
                    "http_error_rate",
                    snql_distribution=lambda args, alias: self.builder.resolve_division(
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
                    "http_error_count",
                    snql_distribution=self._resolve_http_error_count,
                    default_result_type="integer",
                ),
                fields.MetricsFunction(
                    "percentile_range",
                    required_args=[
                        fields.MetricArg(
                            "column",
                            allowed_columns=constants.SPAN_METRIC_DURATION_COLUMNS,
                            allow_custom_measurements=False,
                        ),
                        fields.NumberRange("percentile", 0, 1),
                        fields.ConditionArg("condition"),
                        fields.SnQLDateArg("middle"),
                    ],
                    calculated_args=[resolve_metric_id],
                    snql_distribution=lambda args, alias: function_aliases.resolve_metrics_percentile(
                        args=args,
                        alias=alias,
                        fixed_percentile=args["percentile"],
                        extra_conditions=[
                            Function(
                                args["condition"],
                                [
                                    Function("toDateTime", [args["middle"]]),
                                    self.builder.column("timestamp"),
                                ],
                            ),
                        ],
                    ),
                    default_result_type="duration",
                ),
                fields.MetricsFunction(
                    "percentile_percent_change",
                    required_args=[
                        fields.MetricArg(
                            "column",
                            allowed_columns=constants.SPAN_METRIC_DURATION_COLUMNS,
                            allow_custom_measurements=False,
                        ),
                        fields.NumberRange("percentile", 0, 1),
                    ],
                    calculated_args=[resolve_metric_id],
                    snql_distribution=self._resolve_percentile_percent_change,
                    default_result_type="percent_change",
                ),
                fields.MetricsFunction(
                    "http_error_count_percent_change",
                    snql_distribution=self._resolve_http_error_count_percent_change,
                    default_result_type="percent_change",
                ),
                fields.MetricsFunction(
                    "epm_percent_change",
                    snql_distribution=self._resolve_epm_percent_change,
                    optional_args=[fields.IntervalDefault("interval", 1, None)],
                    default_result_type="percent_change",
                ),
                fields.MetricsFunction(
                    "eps_percent_change",
                    snql_distribution=self._resolve_eps_percent_change,
                    optional_args=[fields.IntervalDefault("interval", 1, None)],
                    default_result_type="percent_change",
                ),
            ]
        }

        for alias, name in constants.SPAN_FUNCTION_ALIASES.items():
            if name in function_converter:
                function_converter[alias] = function_converter[name].alias_as(alias)

        return function_converter

    def _resolve_span_module(self, alias: str) -> SelectType:
        return field_aliases.resolve_span_module(self.builder, alias)

    # Query Functions
    def _resolve_count_if(
        self,
        metric_condition: Function,
        condition: Function,
        alias: Optional[str] = None,
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

    def _resolve_total_span_duration(self, alias: str, scope: str) -> SelectType:
        """This calculates the total time, and based on the scope will return
        either the apps total time or whatever other local scope/filters are
        applied.
        This must be cached since it runs another query."""
        self.builder.requires_other_aggregates = True
        if self.total_span_duration is not None:
            return Function("toFloat64", [self.total_span_duration], alias)

        total_query = builder.SpansMetricsQueryBuilder(
            dataset=self.builder.dataset,
            params={},
            snuba_params=self.builder.params,
            query=self.builder.query if scope == "local" else None,
            selected_columns=["sum(span.self_time)"],
        )
        sentry_sdk.set_tag("query.resolved_total", scope)

        total_results = total_query.run_query(
            Referrer.API_DISCOVER_TOTAL_SUM_TRANSACTION_DURATION_FIELD.value
        )
        results = total_query.process_results(total_results)

        if len(results["data"]) != 1:
            self.total_span_duration = 0
            return Function("toFloat64", [0], alias)
        self.total_span_duration = results["data"][0]["sum_span_self_time"]
        return Function("toFloat64", [self.total_span_duration], alias)

    def _resolve_time_spent_percentage(
        self, args: Mapping[str, Union[str, Column, SelectType, int, float]], alias: str
    ) -> SelectType:
        total_time = self._resolve_total_span_duration(
            constants.TOTAL_SPAN_DURATION_ALIAS, args["scope"]
        )
        metric_id = self.resolve_metric("span.self_time")

        return self.builder.resolve_division(
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

    def _resolve_http_error_count(
        self,
        _: Mapping[str, Union[str, Column, SelectType, int, float]],
        alias: Optional[str] = None,
        extra_condition: Optional[Function] = None,
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

    def _resolve_epm(
        self,
        args: Mapping[str, Union[str, Column, SelectType, int, float]],
        alias: Optional[str] = None,
        extra_condition: Optional[Function] = None,
    ) -> SelectType:
        return self._resolve_rate(60, args, alias, extra_condition)

    def _resolve_eps(
        self,
        args: Mapping[str, Union[str, Column, SelectType, int, float]],
        alias: Optional[str] = None,
        extra_condition: Optional[Function] = None,
    ) -> SelectType:
        return self._resolve_rate(None, args, alias, extra_condition)

    def _resolve_rate(
        self,
        interval: Optional[int],
        args: Mapping[str, Union[str, Column, SelectType, int, float]],
        alias: Optional[str] = None,
        extra_condition: Optional[Function] = None,
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
                args["interval"]
                if interval is None
                else Function("divide", [args["interval"], interval]),
            ],
            alias,
        )

    def _resolve_http_error_count_percent_change(
        self,
        _: Mapping[str, Union[str, Column, SelectType, int, float]],
        alias: Optional[str] = None,
    ) -> SelectType:
        first_half = self._resolve_http_error_count({}, None, self.builder.first_half_condition())
        second_half = self._resolve_http_error_count({}, None, self.builder.second_half_condition())
        return self._resolve_percent_change_function(first_half, second_half, alias)

    def _resolve_percentile_percent_change(
        self,
        args: Mapping[str, Union[str, Column, SelectType, int, float]],
        alias: Optional[str] = None,
    ) -> SelectType:
        first_half = function_aliases.resolve_metrics_percentile(
            args=args,
            alias=None,
            fixed_percentile=args["percentile"],
            extra_conditions=[self.builder.first_half_condition()],
        )
        second_half = function_aliases.resolve_metrics_percentile(
            args=args,
            alias=None,
            fixed_percentile=args["percentile"],
            extra_conditions=[self.builder.second_half_condition()],
        )
        return self._resolve_percent_change_function(first_half, second_half, alias)

    def _resolve_epm_percent_change(
        self,
        args: Mapping[str, Union[str, Column, SelectType, int, float]],
        alias: Optional[str] = None,
    ) -> SelectType:
        first_half = self._resolve_epm(args, None, self.builder.first_half_condition())
        second_half = self._resolve_epm(args, None, self.builder.second_half_condition())
        return self._resolve_percent_change_function(first_half, second_half, alias)

    def _resolve_eps_percent_change(
        self,
        args: Mapping[str, Union[str, Column, SelectType, int, float]],
        alias: Optional[str] = None,
    ) -> SelectType:
        first_half = self._resolve_eps(args, None, self.builder.first_half_condition())
        second_half = self._resolve_eps(args, None, self.builder.second_half_condition())
        return self._resolve_percent_change_function(first_half, second_half, alias)

    def _resolve_percent_change_function(self, first_half, second_half, alias):
        return self.builder.resolve_division(
            Function(
                "minus",
                [second_half, first_half],
            ),
            first_half,
            alias,
        )

    @property
    def orderby_converter(self) -> Mapping[str, OrderBy]:
        return {}
