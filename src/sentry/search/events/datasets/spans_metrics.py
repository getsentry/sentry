from __future__ import annotations

from typing import Callable, Mapping, Optional, Union

from snuba_sdk import Column, Function, OrderBy

from sentry.api.event_search import SearchFilter
from sentry.exceptions import IncompatibleMetricsQuery
from sentry.search.events import builder, constants, fields
from sentry.search.events.datasets import function_aliases
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
        return {}

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
                            "column", allowed_columns=["user"], allow_custom_measurements=False
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
                    "spm",
                    snql_distribution=lambda args, alias: Function(
                        "divide",
                        [
                            Function(
                                "countIf",
                                [
                                    Column("value"),
                                    Function(
                                        "equals",
                                        [
                                            Column("metric_id"),
                                            self.resolve_metric("span.duration"),
                                        ],
                                    ),
                                ],
                            ),
                            Function("divide", [args["interval"], 60]),
                        ],
                        alias,
                    ),
                    optional_args=[fields.IntervalDefault("interval", 1, None)],
                    default_result_type="number",
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
                                    self.resolve_metric("span.duration"),
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
                            "span.duration",
                            fields.MetricArg(
                                "column",
                                allowed_columns=["span.duration"],
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
                    "p50",
                    optional_args=[
                        fields.with_default(
                            "span.duration",
                            fields.MetricArg(
                                "column",
                                allowed_columns=["span.duration"],
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
                            "span.duration",
                            fields.MetricArg(
                                "column",
                                allowed_columns=["span.duration"],
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
                            "span.duration",
                            fields.MetricArg(
                                "column",
                                allowed_columns=["span.duration"],
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
                    snql_distribution=self._resolve_time_spent_percentage,
                    default_result_type="percentage",
                ),
                fields.MetricsFunction(
                    "p99",
                    optional_args=[
                        fields.with_default(
                            "span.duration",
                            fields.MetricArg(
                                "column",
                                allowed_columns=["span.duration"],
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
                    "http_error_rate",
                    snql_distribution=lambda args, alias: Function(
                        "divide",
                        [
                            self._resolve_http_error_count(args),
                            Function(
                                "countIf",
                                [
                                    Column("value"),
                                    Function(
                                        "equals",
                                        [
                                            Column("metric_id"),
                                            self.resolve_metric("span.duration"),
                                        ],
                                    ),
                                ],
                            ),
                        ],
                        alias,
                    ),
                    default_result_type="percentage",
                ),
                fields.MetricsFunction(
                    "http_error_count",
                    snql_distribution=self._resolve_http_error_count,
                    default_result_type="integer",
                ),
            ]
        }

        for alias, name in constants.FUNCTION_ALIASES.items():
            if name in function_converter:
                function_converter[alias] = function_converter[name].alias_as(alias)

        return function_converter

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

    def _resolve_total_span_duration(self, alias: str) -> SelectType:
        """This calculates the app's total time, so other filters that are
        a part of the original query will not be applies. Only filter conditions
        that will be applied are snuba params.
        This must be cached since it runs another query."""
        self.builder.requires_other_aggregates = True
        if self.total_span_duration is not None:
            return Function("toFloat64", [self.total_span_duration], alias)

        total_query = builder.SpansMetricsQueryBuilder(
            dataset=self.builder.dataset,
            params={},
            snuba_params=self.builder.params,
            selected_columns=["sum(span.duration)"],
        )

        total_query.columns += self.builder.resolve_groupby()
        total_results = total_query.run_query(
            Referrer.API_DISCOVER_TOTAL_SUM_TRANSACTION_DURATION_FIELD.value
        )
        results = total_query.process_results(total_results)

        if len(results["data"]) != 1:
            self.total_span_duration = 0
            return Function("toFloat64", [0], alias)
        self.total_span_duration = results["data"][0]["sum_span_duration"]
        return Function("toFloat64", [self.total_span_duration], alias)

    def _resolve_time_spent_percentage(
        self, args: Mapping[str, Union[str, Column, SelectType, int, float]], alias: str
    ) -> SelectType:
        total_time = self._resolve_total_span_duration(constants.TOTAL_SPAN_DURATION_ALIAS)
        metric_id = self.resolve_metric("span.duration")

        return Function(
            "divide",
            [
                Function(
                    "sumIf",
                    [
                        Column("value"),
                        Function("equals", [Column("metric_id"), metric_id]),
                    ],
                ),
                total_time,
            ],
            alias,
        )

    def _resolve_http_error_count(
        self,
        _: Mapping[str, Union[str, Column, SelectType, int, float]],
        alias: Optional[str] = None,
    ) -> SelectType:
        statuses = [
            self.builder.resolve_tag_value(status) for status in constants.HTTP_SERVER_ERROR_STATUS
        ]
        return self._resolve_count_if(
            Function(
                "equals",
                [
                    Column("metric_id"),
                    self.resolve_metric("span.duration"),
                ],
            ),
            Function(
                "in",
                [
                    self.builder.column("span.status_code"),
                    list(status for status in statuses if status is not None),
                ],
            ),
            alias,
        )

    @property
    def orderby_converter(self) -> Mapping[str, OrderBy]:
        return {}
