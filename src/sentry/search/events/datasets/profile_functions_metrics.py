from __future__ import annotations

from collections.abc import Callable, Mapping
from datetime import datetime

from snuba_sdk import Column, Function, OrderBy

from sentry.api.event_search import SearchFilter
from sentry.exceptions import IncompatibleMetricsQuery, InvalidSearchQuery
from sentry.search.events import constants, fields
from sentry.search.events.builder import profile_functions_metrics
from sentry.search.events.constants import PROJECT_ALIAS, PROJECT_NAME_ALIAS
from sentry.search.events.datasets import field_aliases, filter_aliases, function_aliases
from sentry.search.events.datasets.base import DatasetConfig
from sentry.search.events.types import SelectType, WhereType


class ProfileFunctionsMetricsDatasetConfig(DatasetConfig):
    missing_function_error = IncompatibleMetricsQuery

    def __init__(self, builder: profile_functions_metrics.ProfileFunctionsMetricsQueryBuilder):
        self.builder = builder

    def resolve_mri(self, value: str) -> Column:
        return Column(constants.PROFILE_METRICS_MAP[value])

    @property
    def search_filter_converter(
        self,
    ) -> Mapping[str, Callable[[SearchFilter], WhereType | None]]:
        return {
            PROJECT_ALIAS: self._project_slug_filter_converter,
            PROJECT_NAME_ALIAS: self._project_slug_filter_converter,
        }

    @property
    def orderby_converter(self) -> Mapping[str, OrderBy]:
        return {}

    @property
    def field_alias_converter(self) -> Mapping[str, Callable[[str], SelectType]]:
        return {
            PROJECT_ALIAS: self._resolve_project_slug_alias,
            PROJECT_NAME_ALIAS: self._resolve_project_slug_alias,
        }

    def _project_slug_filter_converter(self, search_filter: SearchFilter) -> WhereType | None:
        return filter_aliases.project_slug_converter(self.builder, search_filter)

    def _resolve_project_slug_alias(self, alias: str) -> SelectType:
        return field_aliases.resolve_project_slug_alias(self.builder, alias)

    def resolve_metric(self, value: str) -> int:
        # "function.duration" --> "d:profiles/function.duration@millisecond"
        metric_id = self.builder.resolve_metric_index(
            constants.PROFILE_METRICS_MAP.get(value, value)
        )
        # If it's still None its not a custom measurement
        if metric_id is None:
            raise IncompatibleMetricsQuery(f"Metric: {value} could not be resolved")
        self.builder.metric_ids.add(metric_id)
        return metric_id

    def _resolve_avg(self, args, alias):
        return Function(
            "avgIf",
            [
                Column("value"),
                Function("equals", [Column("metric_id"), args["metric_id"]]),
            ],
            alias,
        )

    def _resolve_cpm(
        self,
        args: Mapping[str, str | Column | SelectType | int | float],
        alias: str | None,
        extra_condition: Function | None = None,
    ) -> SelectType:
        assert (
            self.builder.params.end is not None and self.builder.params.start is not None
        ), f"params.end: {self.builder.params.end} - params.start: {self.builder.params.start}"
        interval = (self.builder.params.end - self.builder.params.start).total_seconds()

        base_condition = Function(
            "equals",
            [
                Column("metric_id"),
                self.resolve_metric("function.duration"),
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
                Function("divide", [interval, 60]),
            ],
            alias,
        )

    def _resolve_cpm_cond(
        self,
        args: Mapping[str, str | Column | SelectType | int | float | datetime],
        cond: str,
        alias: str | None,
    ) -> SelectType:
        timestmp = args["timestamp"]
        if cond == "greater":
            assert isinstance(self.builder.params.end, datetime) and isinstance(
                timestmp, datetime
            ), f"params.end: {self.builder.params.end} - timestmp: {timestmp}"
            interval = (self.builder.params.end - timestmp).total_seconds()
            # interval = interval
        elif cond == "less":
            assert isinstance(self.builder.params.start, datetime) and isinstance(
                timestmp, datetime
            ), f"params.start: {self.builder.params.start} - timestmp: {timestmp}"
            interval = (timestmp - self.builder.params.start).total_seconds()
        else:
            raise InvalidSearchQuery(f"Unsupported condition for cpm: {cond}")

        metric_id_condition = Function(
            "equals", [Column("metric_id"), self.resolve_metric("function.duration")]
        )

        return Function(
            "divide",
            [
                Function(
                    "countIf",
                    [
                        Column("value"),
                        Function(
                            "and",
                            [
                                metric_id_condition,
                                Function(
                                    cond,
                                    [
                                        Column("timestamp"),
                                        args["timestamp"],
                                    ],
                                ),
                            ],
                        ),  # close and condition
                    ],
                ),
                Function("divide", [interval, 60]),
            ],
            alias,
        )

    def _resolve_cpm_delta(
        self,
        args: Mapping[str, str | Column | SelectType | int | float],
        alias: str,
    ) -> SelectType:
        return Function(
            "minus",
            [
                self._resolve_cpm_cond(args, "greater", None),
                self._resolve_cpm_cond(args, "less", None),
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
                        self._resolve_cpm_cond(args, "greater", None),
                        function_aliases.resolve_metrics_percentile(
                            args=args,
                            alias=None,
                            extra_conditions=[
                                Function("greater", [Column("timestamp"), args["timestamp"]])
                            ],
                        ),
                    ],
                ),
                Function(
                    "multiply",
                    [
                        self._resolve_cpm_cond(args, "less", None),
                        function_aliases.resolve_metrics_percentile(
                            args=args,
                            alias=None,
                            extra_conditions=[
                                Function("less", [Column("timestamp"), args["timestamp"]])
                            ],
                        ),
                    ],
                ),
            ],
            alias,
        )

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
                    "count",
                    snql_distribution=lambda args, alias: Function(
                        "countIf",
                        [
                            Column("value"),
                            Function(
                                "equals",
                                [
                                    Column("metric_id"),
                                    self.resolve_metric("function.duration"),
                                ],
                            ),
                        ],
                        alias,
                    ),
                    default_result_type="integer",
                ),
                fields.MetricsFunction(
                    "cpm",  # calls per minute
                    snql_distribution=lambda args, alias: self._resolve_cpm(args, alias),
                    default_result_type="number",
                ),
                fields.MetricsFunction(
                    "cpm_before",
                    required_args=[fields.TimestampArg("timestamp")],
                    snql_distribution=lambda args, alias: self._resolve_cpm_cond(
                        args, "less", alias
                    ),
                    default_result_type="number",
                ),
                fields.MetricsFunction(
                    "cpm_after",
                    required_args=[fields.TimestampArg("timestamp")],
                    snql_distribution=lambda args, alias: self._resolve_cpm_cond(
                        args, "greater", alias
                    ),
                    default_result_type="number",
                ),
                fields.MetricsFunction(
                    "cpm_delta",
                    required_args=[fields.TimestampArg("timestamp")],
                    snql_distribution=self._resolve_cpm_delta,
                    default_result_type="number",
                ),
                fields.MetricsFunction(
                    "percentile",
                    required_args=[
                        fields.with_default(
                            "function.duration",
                            fields.MetricArg("column", allowed_columns=["function.duration"]),
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
                            "function.duration",
                            fields.MetricArg(
                                "column",
                                allowed_columns=["function.duration"],
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
                            "function.duration",
                            fields.MetricArg(
                                "column",
                                allowed_columns=["function.duration"],
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
                            "function.duration",
                            fields.MetricArg(
                                "column",
                                allowed_columns=["function.duration"],
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
                            "function.duration",
                            fields.MetricArg(
                                "column",
                                allowed_columns=["function.duration"],
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
                    "avg",
                    optional_args=[
                        fields.with_default(
                            "function.duration",
                            fields.MetricArg(
                                "column",
                                allowed_columns=["function.duration"],
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
                    "sum",
                    optional_args=[
                        fields.with_default(
                            "function.duration",
                            fields.MetricArg(
                                "column",
                                allowed_columns=["function.duration"],
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
                    "percentile_before",
                    required_args=[
                        fields.TimestampArg("timestamp"),
                        fields.NumberRange("percentile", 0, 1),
                    ],
                    optional_args=[
                        fields.with_default(
                            "function.duration",
                            fields.MetricArg(
                                "column",
                                allowed_columns=["function.duration"],
                                allow_custom_measurements=False,
                            ),
                        ),
                    ],
                    calculated_args=[resolve_metric_id],
                    snql_distribution=lambda args, alias: function_aliases.resolve_metrics_percentile(
                        args=args,
                        alias=alias,
                        extra_conditions=[
                            Function("less", [Column("timestamp"), args["timestamp"]])
                        ],
                    ),
                    is_percentile=True,
                    default_result_type="duration",
                ),
                fields.MetricsFunction(
                    "percentile_after",
                    required_args=[
                        fields.TimestampArg("timestamp"),
                        fields.NumberRange("percentile", 0, 1),
                    ],
                    optional_args=[
                        fields.with_default(
                            "function.duration",
                            fields.MetricArg(
                                "column",
                                allowed_columns=["function.duration"],
                                allow_custom_measurements=False,
                            ),
                        ),
                    ],
                    calculated_args=[resolve_metric_id],
                    snql_distribution=lambda args, alias: function_aliases.resolve_metrics_percentile(
                        args=args,
                        alias=alias,
                        extra_conditions=[
                            Function("greater", [Column("timestamp"), args["timestamp"]])
                        ],
                    ),
                    is_percentile=True,
                    default_result_type="duration",
                ),
                fields.MetricsFunction(
                    "percentile_delta",
                    required_args=[
                        fields.TimestampArg("timestamp"),
                        fields.NumberRange("percentile", 0, 1),
                    ],
                    optional_args=[
                        fields.with_default(
                            "function.duration",
                            fields.MetricArg(
                                "column",
                                allowed_columns=["function.duration"],
                                allow_custom_measurements=False,
                            ),
                        ),
                    ],
                    calculated_args=[resolve_metric_id],
                    snql_distribution=lambda args, alias: Function(
                        "minus",
                        [
                            function_aliases.resolve_metrics_percentile(
                                args=args,
                                alias=alias,
                                extra_conditions=[
                                    Function("greater", [Column("timestamp"), args["timestamp"]])
                                ],
                            ),
                            function_aliases.resolve_metrics_percentile(
                                args=args,
                                alias=alias,
                                extra_conditions=[
                                    Function("less", [Column("timestamp"), args["timestamp"]])
                                ],
                            ),
                        ],
                        alias,
                    ),
                    is_percentile=True,
                    default_result_type="duration",
                ),
                fields.MetricsFunction(
                    "regression_score",
                    required_args=[
                        fields.MetricArg(
                            "column",
                            allowed_columns=["function.duration"],
                            allow_custom_measurements=False,
                        ),
                        fields.TimestampArg("timestamp"),
                        fields.NumberRange("percentile", 0, 1),
                    ],
                    calculated_args=[resolve_metric_id],
                    snql_distribution=self._resolve_regression_score,
                    default_result_type="number",
                ),
            ]
        }
        return function_converter
