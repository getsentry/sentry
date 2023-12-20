from __future__ import annotations

from typing import Callable, Mapping, Optional, Union

from django.utils.functional import cached_property
from snuba_sdk import Column, Condition, Function, Op, OrderBy

from sentry.api.event_search import SearchFilter
from sentry.exceptions import IncompatibleMetricsQuery, InvalidSearchQuery
from sentry.search.events import builder, constants, fields
from sentry.search.events.datasets import field_aliases, filter_aliases, function_aliases
from sentry.search.events.datasets.base import DatasetConfig
from sentry.search.events.types import SelectType, WhereType
from sentry.snuba.referrer import Referrer


class MetricsDatasetConfig(DatasetConfig):
    missing_function_error = IncompatibleMetricsQuery

    def __init__(self, builder: builder.MetricsQueryBuilder):
        self.builder = builder
        self.total_transaction_duration: Optional[float] = None

    @property
    def search_filter_converter(
        self,
    ) -> Mapping[str, Callable[[SearchFilter], Optional[WhereType]]]:
        return {
            constants.PROJECT_ALIAS: self._project_slug_filter_converter,
            constants.PROJECT_NAME_ALIAS: self._project_slug_filter_converter,
            constants.EVENT_TYPE_ALIAS: self._event_type_converter,
            constants.TEAM_KEY_TRANSACTION_ALIAS: self._key_transaction_filter_converter,
            "environment": self.builder._environment_filter_converter,
            "transaction": self._transaction_filter_converter,
            "transaction.status": self._transaction_status_converter,
            "tags[transaction]": self._transaction_filter_converter,
            constants.TITLE_ALIAS: self._transaction_filter_converter,
            constants.RELEASE_ALIAS: self._release_filter_converter,
            constants.DEVICE_CLASS_ALIAS: lambda search_filter: filter_aliases.device_class_converter(
                self.builder, search_filter
            ),
        }

    @property
    def field_alias_converter(self) -> Mapping[str, Callable[[str], SelectType]]:
        transaction_alias = (
            self._resolve_transaction_alias_on_demand
            if self.builder.use_on_demand
            else self._resolve_transaction_alias
        )
        return {
            constants.PROJECT_ALIAS: self._resolve_project_slug_alias,
            constants.PROJECT_NAME_ALIAS: self._resolve_project_slug_alias,
            constants.TEAM_KEY_TRANSACTION_ALIAS: self._resolve_team_key_transaction_alias,
            constants.TITLE_ALIAS: self._resolve_title_alias,
            constants.PROJECT_THRESHOLD_CONFIG_ALIAS: lambda _: self._resolve_project_threshold_config,
            "transaction": transaction_alias,
            "tags[transaction]": transaction_alias,
            constants.DEVICE_CLASS_ALIAS: lambda alias: field_aliases.resolve_device_class(
                self.builder, alias
            ),
        }

    def resolve_metric(self, value: str) -> int:
        metric_id = self.builder.resolve_metric_index(constants.METRICS_MAP.get(value, value))
        if metric_id is None:
            # Maybe this is a custom measurment?
            for measurement in self.builder.custom_measurement_map:
                if measurement["name"] == value and measurement["metric_id"] is not None:
                    metric_id = measurement["metric_id"]
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
                # Note while the discover version of apdex, count_miserable, user_misery
                # accepts arguments, because this is precomputed with tags no parameters
                # are available
                fields.MetricsFunction(
                    "apdex",
                    optional_args=[fields.NullableNumberRange("satisfaction", 0, None)],
                    snql_distribution=self._resolve_apdex_function,
                    default_result_type="number",
                ),
                fields.MetricsFunction(
                    "avg",
                    required_args=[
                        fields.MetricArg(
                            "column",
                            allowed_columns=constants.METRIC_DURATION_COLUMNS,
                        )
                    ],
                    calculated_args=[resolve_metric_id],
                    snql_distribution=lambda args, alias: Function(
                        "avgIf",
                        [
                            Column("value"),
                            Function(
                                "equals",
                                [
                                    Column("metric_id"),
                                    args["metric_id"],
                                ],
                            ),
                        ],
                        alias,
                    ),
                    result_type_fn=self.reflective_result_type(),
                    default_result_type="integer",
                ),
                fields.MetricsFunction(
                    "avg_if",
                    required_args=[
                        fields.MetricArg(
                            "column",
                            allowed_columns=constants.METRIC_DURATION_COLUMNS,
                        ),
                        fields.MetricArg(
                            "if_col",
                            allowed_columns=["release"],
                        ),
                        fields.SnQLStringArg(
                            "if_val", unquote=True, unescape_quotes=True, optional_unquote=True
                        ),
                    ],
                    calculated_args=[resolve_metric_id],
                    snql_distribution=lambda args, alias: Function(
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
                    ),
                    result_type_fn=self.reflective_result_type(),
                    default_result_type="duration",
                ),
                fields.MetricsFunction(
                    "count_miserable",
                    required_args=[
                        fields.MetricArg(
                            "column", allowed_columns=["user"], allow_custom_measurements=False
                        )
                    ],
                    optional_args=[fields.NullableNumberRange("satisfaction", 0, None)],
                    calculated_args=[resolve_metric_id],
                    snql_set=self._resolve_count_miserable_function,
                    default_result_type="integer",
                ),
                fields.MetricsFunction(
                    "count_unparameterized_transactions",
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
                                            self.resolve_metric("transaction.duration"),
                                        ],
                                    ),
                                    Function(
                                        "equals",
                                        [
                                            self.builder.column("transaction"),
                                            self.builder.resolve_tag_value("<< unparameterized >>"),
                                        ],
                                    ),
                                ],
                            ),
                        ],
                        alias,
                    ),
                    # Not yet exposed, need to add far more validation around tag&value
                    private=True,
                    default_result_type="integer",
                ),
                fields.MetricsFunction(
                    "count_null_transactions",
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
                                            self.resolve_metric("transaction.duration"),
                                        ],
                                    ),
                                    Function(
                                        "equals",
                                        [
                                            self.builder.column("transaction"),
                                            "",
                                        ],
                                    ),
                                ],
                            ),
                        ],
                        alias,
                    ),
                    private=True,
                ),
                fields.MetricsFunction(
                    "count_has_transaction_name",
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
                                            self.resolve_metric("transaction.duration"),
                                        ],
                                    ),
                                    Function(
                                        "and",
                                        [
                                            Function(
                                                "notEquals",
                                                [
                                                    self.builder.column("transaction"),
                                                    "",
                                                ],
                                            ),
                                            Function(
                                                "notEquals",
                                                [
                                                    self.builder.column("transaction"),
                                                    self.builder.resolve_tag_value(
                                                        "<< unparameterized >>"
                                                    ),
                                                ],
                                            ),
                                        ],
                                    ),
                                ],
                            ),
                        ],
                        alias,
                    ),
                    private=True,
                    default_result_type="integer",
                ),
                fields.MetricsFunction(
                    "user_misery",
                    optional_args=[
                        fields.NullableNumberRange("satisfaction", 0, None),
                        fields.with_default(
                            constants.MISERY_ALPHA, fields.NumberRange("alpha", 0, None)
                        ),
                        fields.with_default(
                            constants.MISERY_BETA, fields.NumberRange("beta", 0, None)
                        ),
                    ],
                    calculated_args=[],
                    snql_set=self._resolve_user_misery_function,
                    default_result_type="number",
                ),
                fields.MetricsFunction(
                    "p50",
                    optional_args=[
                        fields.with_default(
                            "transaction.duration",
                            fields.MetricArg(
                                "column", allowed_columns=constants.METRIC_DURATION_COLUMNS
                            ),
                        ),
                    ],
                    calculated_args=[resolve_metric_id],
                    snql_distribution=lambda args, alias: self._resolve_percentile(
                        args, alias, 0.5
                    ),
                    result_type_fn=self.reflective_result_type(),
                    default_result_type="duration",
                ),
                fields.MetricsFunction(
                    "p75",
                    optional_args=[
                        fields.with_default(
                            "transaction.duration",
                            fields.MetricArg(
                                "column", allowed_columns=constants.METRIC_DURATION_COLUMNS
                            ),
                        ),
                    ],
                    calculated_args=[resolve_metric_id],
                    snql_distribution=lambda args, alias: self._resolve_percentile(
                        args, alias, 0.75
                    ),
                    result_type_fn=self.reflective_result_type(),
                    default_result_type="duration",
                ),
                fields.MetricsFunction(
                    "p90",
                    optional_args=[
                        fields.with_default(
                            "transaction.duration",
                            fields.MetricArg(
                                "column", allowed_columns=constants.METRIC_DURATION_COLUMNS
                            ),
                        ),
                    ],
                    calculated_args=[resolve_metric_id],
                    snql_distribution=lambda args, alias: self._resolve_percentile(
                        args, alias, 0.90
                    ),
                    result_type_fn=self.reflective_result_type(),
                    default_result_type="duration",
                ),
                fields.MetricsFunction(
                    "p95",
                    optional_args=[
                        fields.with_default(
                            "transaction.duration",
                            fields.MetricArg(
                                "column", allowed_columns=constants.METRIC_DURATION_COLUMNS
                            ),
                        ),
                    ],
                    calculated_args=[resolve_metric_id],
                    snql_distribution=lambda args, alias: self._resolve_percentile(
                        args, alias, 0.95
                    ),
                    result_type_fn=self.reflective_result_type(),
                    default_result_type="duration",
                ),
                fields.MetricsFunction(
                    "p99",
                    optional_args=[
                        fields.with_default(
                            "transaction.duration",
                            fields.MetricArg(
                                "column", allowed_columns=constants.METRIC_DURATION_COLUMNS
                            ),
                        ),
                    ],
                    calculated_args=[resolve_metric_id],
                    snql_distribution=lambda args, alias: self._resolve_percentile(
                        args, alias, 0.99
                    ),
                    result_type_fn=self.reflective_result_type(),
                    default_result_type="duration",
                ),
                fields.MetricsFunction(
                    "p100",
                    optional_args=[
                        fields.with_default(
                            "transaction.duration",
                            fields.MetricArg(
                                "column", allowed_columns=constants.METRIC_DURATION_COLUMNS
                            ),
                        ),
                    ],
                    calculated_args=[resolve_metric_id],
                    snql_distribution=lambda args, alias: self._resolve_percentile(args, alias, 1),
                    result_type_fn=self.reflective_result_type(),
                    default_result_type="duration",
                ),
                fields.MetricsFunction(
                    "max",
                    required_args=[
                        fields.MetricArg("column"),
                    ],
                    calculated_args=[resolve_metric_id],
                    snql_distribution=lambda args, alias: Function(
                        "maxIf",
                        [
                            Column("value"),
                            Function("equals", [Column("metric_id"), args["metric_id"]]),
                        ],
                        alias,
                    ),
                    result_type_fn=self.reflective_result_type(),
                ),
                fields.MetricsFunction(
                    "min",
                    required_args=[
                        fields.MetricArg("column"),
                    ],
                    calculated_args=[resolve_metric_id],
                    snql_distribution=lambda args, alias: Function(
                        "minIf",
                        [
                            Column("value"),
                            Function("equals", [Column("metric_id"), args["metric_id"]]),
                        ],
                        alias,
                    ),
                    result_type_fn=self.reflective_result_type(),
                ),
                fields.MetricsFunction(
                    "sum",
                    required_args=[
                        fields.MetricArg("column"),
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
                    result_type_fn=self.reflective_result_type(),
                ),
                fields.MetricsFunction(
                    "sumIf",
                    required_args=[
                        fields.ColumnTagArg("if_col"),
                        fields.FunctionArg("if_val"),
                    ],
                    calculated_args=[
                        {
                            "name": "resolved_val",
                            "fn": lambda args: self.builder.resolve_tag_value(args["if_val"]),
                        }
                    ],
                    snql_counter=lambda args, alias: Function(
                        "sumIf",
                        [
                            Column("value"),
                            Function("equals", [args["if_col"], args["resolved_val"]]),
                        ],
                        alias,
                    ),
                    default_result_type="integer",
                ),
                fields.MetricsFunction(
                    "percentile",
                    required_args=[
                        fields.with_default(
                            "transaction.duration",
                            fields.MetricArg(
                                "column", allowed_columns=constants.METRIC_DURATION_COLUMNS
                            ),
                        ),
                        fields.NumberRange("percentile", 0, 1),
                    ],
                    calculated_args=[resolve_metric_id],
                    snql_distribution=self._resolve_percentile,
                    result_type_fn=self.reflective_result_type(),
                    default_result_type="duration",
                ),
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
                    "uniq",
                    snql_set=lambda args, alias: Function(
                        "uniq",
                        [Column("value")],
                        alias,
                    ),
                ),
                fields.MetricsFunction(
                    "uniqIf",
                    required_args=[
                        fields.ColumnTagArg("if_col"),
                        fields.FunctionArg("if_val"),
                    ],
                    calculated_args=[
                        {
                            "name": "resolved_val",
                            "fn": lambda args: self.builder.resolve_tag_value(args["if_val"]),
                        }
                    ],
                    snql_set=lambda args, alias: Function(
                        "uniqIf",
                        [
                            Column("value"),
                            Function("equals", [args["if_col"], args["resolved_val"]]),
                        ],
                        alias,
                    ),
                    default_result_type="integer",
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
                                    self.resolve_metric("transaction.duration"),
                                ],
                            ),
                        ],
                        alias,
                    ),
                    default_result_type="integer",
                ),
                fields.MetricsFunction(
                    "count_starts",
                    required_args=[
                        fields.MetricArg(
                            "column",
                            allowed_columns=[
                                "measurements.app_start_warm",
                                "measurements.app_start_cold",
                            ],
                            allow_custom_measurements=False,
                        ),
                    ],
                    calculated_args=[resolve_metric_id],
                    snql_distribution=self._resolve_count_starts_function,
                    default_result_type="integer",
                ),
                fields.MetricsFunction(
                    "count_web_vitals",
                    required_args=[
                        fields.MetricArg(
                            "column",
                            allowed_columns=[
                                "measurements.fp",
                                "measurements.fcp",
                                "measurements.lcp",
                                "measurements.fid",
                                "measurements.cls",
                                "measurements.ttfb",
                            ],
                            allow_custom_measurements=False,
                        ),
                        fields.SnQLStringArg(
                            "quality", allowed_strings=["good", "meh", "poor", "any"]
                        ),
                    ],
                    calculated_args=[resolve_metric_id],
                    snql_distribution=self._resolve_web_vital_function,
                    default_result_type="integer",
                ),
                fields.MetricsFunction(
                    "performance_score",
                    required_args=[
                        fields.MetricArg(
                            "column",
                            allowed_columns=[
                                "measurements.score.fcp",
                                "measurements.score.lcp",
                                "measurements.score.fid",
                                "measurements.score.cls",
                                "measurements.score.ttfb",
                            ],
                            allow_custom_measurements=False,
                        )
                    ],
                    calculated_args=[resolve_metric_id],
                    snql_distribution=self._resolve_web_vital_score_function,
                    default_result_type="number",
                ),
                fields.MetricsFunction(
                    "weighted_performance_score",
                    required_args=[
                        fields.MetricArg(
                            "column",
                            allowed_columns=[
                                "measurements.score.fcp",
                                "measurements.score.lcp",
                                "measurements.score.fid",
                                "measurements.score.cls",
                                "measurements.score.ttfb",
                            ],
                            allow_custom_measurements=False,
                        )
                    ],
                    calculated_args=[resolve_metric_id],
                    snql_distribution=self._resolve_weighted_web_vital_score_function,
                    default_result_type="number",
                ),
                fields.MetricsFunction(
                    "opportunity_score",
                    required_args=[
                        fields.MetricArg(
                            "column",
                            allowed_columns=[
                                "measurements.score.fcp",
                                "measurements.score.lcp",
                                "measurements.score.fid",
                                "measurements.score.cls",
                                "measurements.score.ttfb",
                                "measurements.score.total",
                            ],
                            allow_custom_measurements=False,
                        )
                    ],
                    calculated_args=[resolve_metric_id],
                    snql_distribution=self._resolve_web_vital_opportunity_score_function,
                    default_result_type="number",
                ),
                fields.MetricsFunction(
                    "count_scores",
                    required_args=[
                        fields.MetricArg(
                            "column",
                            allowed_columns=[
                                "measurements.score.total",
                                "measurements.score.fcp",
                                "measurements.score.lcp",
                                "measurements.score.fid",
                                "measurements.score.cls",
                                "measurements.score.ttfb",
                            ],
                            allow_custom_measurements=False,
                        ),
                    ],
                    calculated_args=[resolve_metric_id],
                    snql_distribution=self._resolve_count_scores_function,
                    default_result_type="integer",
                ),
                fields.MetricsFunction(
                    "epm",
                    snql_distribution=self._resolve_epm,
                    optional_args=[fields.IntervalDefault("interval", 1, None)],
                    default_result_type="rate",
                ),
                fields.MetricsFunction(
                    "floored_epm",
                    snql_distribution=lambda args, alias: Function(
                        "pow",
                        [
                            10,
                            Function(
                                "floor",
                                [
                                    Function(
                                        "log10",
                                        [
                                            Function(
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
                                                                    self.resolve_metric(
                                                                        "transaction.duration"
                                                                    ),
                                                                ],
                                                            ),
                                                        ],
                                                    ),
                                                    Function("divide", [args["interval"], 60]),
                                                ],
                                            ),
                                        ],
                                    )
                                ],
                            ),
                        ],
                        alias,
                    ),
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
                    "failure_count",
                    snql_distribution=self._resolve_failure_count,
                    default_result_type="integer",
                ),
                fields.MetricsFunction(
                    "failure_rate",
                    snql_distribution=lambda args, alias: Function(
                        "divide",
                        [
                            self._resolve_failure_count(args),
                            Function(
                                "countIf",
                                [
                                    Column("value"),
                                    Function(
                                        "equals",
                                        [
                                            Column("metric_id"),
                                            self.resolve_metric("transaction.duration"),
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
                    "histogram",
                    required_args=[fields.MetricArg("column")],
                    calculated_args=[resolve_metric_id],
                    snql_distribution=self._resolve_histogram_function,
                    default_result_type="number",
                    private=True,
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
                                            self.resolve_metric("transaction.duration"),
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
                fields.MetricsFunction(
                    "percentile_range",
                    required_args=[
                        fields.MetricArg(
                            "column",
                            allowed_columns=["transaction.duration"],
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
                    "avg_compare",
                    required_args=[
                        fields.MetricArg(
                            "column",
                            allowed_columns=constants.METRIC_DURATION_COLUMNS,
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
                    snql_distribution=lambda args, alias: function_aliases.resolve_avg_compare(
                        self.builder.column, args, alias
                    ),
                    default_result_type="percent_change",
                ),
            ]
        }

        for alias, name in [
            *constants.FUNCTION_ALIASES.items(),
            *constants.METRICS_FUNCTION_ALIASES.items(),
        ]:
            if name in function_converter:
                function_converter[alias] = function_converter[name].alias_as(alias)

        return function_converter

    @property
    def orderby_converter(self) -> Mapping[str, OrderBy]:
        return {}

    # Field Aliases
    def _resolve_title_alias(self, alias: str) -> SelectType:
        """title == transaction in discover"""
        return self.field_alias_converter["transaction"](alias)

    def _resolve_team_key_transaction_alias(self, _: str) -> SelectType:
        return field_aliases.resolve_team_key_transaction_alias(
            self.builder, resolve_metric_index=True
        )

    def _resolve_project_slug_alias(self, alias: str) -> SelectType:
        return field_aliases.resolve_project_slug_alias(self.builder, alias)

    def _resolve_transaction_alias(self, alias: str) -> SelectType:
        return Function(
            "transform",
            [
                Column(self.builder.resolve_column_name("transaction")),
                [""],
                [self.builder.resolve_tag_value("<< unparameterized >>")],
            ],
            alias,
        )

    def _resolve_transaction_alias_on_demand(self, _: str) -> SelectType:
        """On-demand doesn't need a transform for transaction in it's where clause
        since conditions are saved on a per-metric basis.
        """
        return Column(self.builder.resolve_column_name("transaction"))

    @cached_property
    def _resolve_project_threshold_config(self) -> SelectType:
        return function_aliases.resolve_project_threshold_config(
            tag_value_resolver=lambda _use_case_id, _org_id, value: self.builder.resolve_tag_value(
                value
            ),
            column_name_resolver=lambda _use_case_id, _org_id, value: self.builder.resolve_column_name(
                value
            ),
            org_id=self.builder.params.organization.id
            if self.builder.params.organization
            else None,
            project_ids=self.builder.params.project_ids,
        )

    def _project_threshold_multi_if_function(self) -> SelectType:
        """Accessed by `_resolve_apdex_function` and `_resolve_count_miserable_function`,
        this returns the right duration value (for example, lcp or duration) based
        on project or transaction thresholds that have been configured by the user.
        """

        return Function(
            "multiIf",
            [
                Function(
                    "equals",
                    [
                        self.builder.resolve_field_alias("project_threshold_config"),
                        "lcp",
                    ],
                ),
                self.resolve_metric("measurements.lcp"),
                self.resolve_metric("transaction.duration"),
            ],
        )

    # Query Filters
    def _event_type_converter(self, search_filter: SearchFilter) -> Optional[WhereType]:
        """Not really a converter, check its transaction, error otherwise"""
        value = search_filter.value.value
        operator = search_filter.operator
        if value == "transaction" and operator == "=":
            return None

        raise IncompatibleMetricsQuery("Can only filter event.type:transaction")

    def _project_slug_filter_converter(self, search_filter: SearchFilter) -> Optional[WhereType]:
        return filter_aliases.project_slug_converter(self.builder, search_filter)

    def _release_filter_converter(self, search_filter: SearchFilter) -> Optional[WhereType]:
        return filter_aliases.release_filter_converter(self.builder, search_filter)

    def _transaction_filter_converter(self, search_filter: SearchFilter) -> Optional[WhereType]:
        operator = search_filter.operator
        value = search_filter.value.value

        if operator in ("=", "!=") and value == "":
            # !has:transaction
            if operator == "=":
                raise InvalidSearchQuery(
                    "All events have a transaction so this query wouldn't return anything"
                )
            else:
                # All events have a "transaction" since we map null -> unparam so no need to filter
                return None

        if isinstance(value, list):
            resolved_value = []
            for item in value:
                resolved_item = self.builder.resolve_tag_value(item)
                if resolved_item is None:
                    raise IncompatibleMetricsQuery(f"Transaction value {item} in filter not found")
                resolved_value.append(resolved_item)
        else:
            resolved_value = self.builder.resolve_tag_value(value)
            if resolved_value is None:
                raise IncompatibleMetricsQuery(f"Transaction value {value} in filter not found")
        value = resolved_value

        if search_filter.value.is_wildcard():
            return Condition(
                Function("match", [self.builder.resolve_column("transaction"), f"(?i){value}"]),
                Op(search_filter.operator),
                1,
            )

        return Condition(self.builder.resolve_column("transaction"), Op(operator), value)

    def _transaction_status_converter(self, search_filter: SearchFilter) -> Optional[WhereType]:
        operator = search_filter.operator
        value = search_filter.value.value

        # For backward compatibility, `unknown_error` is converted to `unknown`, since Relay always emits `unknown`
        # `transaction.status`.
        if value == "unknown_error":
            value = "unknown"

        lhs = self.builder.resolve_column("transaction.status")

        if search_filter.value.is_wildcard():
            return Condition(
                Function("match", [lhs, f"(?i){value}"]),
                Op(operator),
                1,
            )

        return Condition(lhs, Op(operator), value)

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

    def _resolve_apdex_function(
        self,
        args: Mapping[str, Union[str, Column, SelectType, int, float]],
        alias: Optional[str] = None,
    ) -> SelectType:
        """Apdex is tag based in metrics, which means we can't base it on the satsifaction parameter"""
        if args["satisfaction"] is not None:
            raise IncompatibleMetricsQuery(
                "Cannot query apdex with a threshold parameter on the metrics dataset"
            )

        metric_satisfied = self.builder.resolve_tag_value(constants.METRIC_SATISFIED_TAG_VALUE)
        metric_tolerated = self.builder.resolve_tag_value(constants.METRIC_TOLERATED_TAG_VALUE)

        # Nothing is satisfied or tolerated, the score must be 0
        if metric_satisfied is None and metric_tolerated is None:
            return Function(
                "toUInt64",
                [0],
                alias,
            )

        satisfied = Function(
            "equals", [self.builder.column(constants.METRIC_SATISFACTION_TAG_KEY), metric_satisfied]
        )
        tolerable = Function(
            "equals", [self.builder.column(constants.METRIC_SATISFACTION_TAG_KEY), metric_tolerated]
        )
        metric_condition = Function(
            "equals", [Column("metric_id"), self._project_threshold_multi_if_function()]
        )

        return Function(
            "divide",
            [
                Function(
                    "plus",
                    [
                        self._resolve_count_if(metric_condition, satisfied),
                        Function(
                            "divide",
                            [self._resolve_count_if(metric_condition, tolerable), 2],
                        ),
                    ],
                ),
                Function("countIf", [Column("value"), metric_condition]),
            ],
            alias,
        )

    def _resolve_histogram_function(
        self,
        args: Mapping[str, Union[str, Column, SelectType, int, float]],
        alias: Optional[str] = None,
    ) -> SelectType:
        """zoom_params is based on running metrics zoom_histogram function that adds conditions based on min, max,
        buckets"""
        zoom_params = getattr(self.builder, "zoom_params", None)
        num_buckets = getattr(self.builder, "num_buckets", 250)
        metric_condition = Function("equals", [Column("metric_id"), args["metric_id"]])
        self.builder.histogram_aliases.append(alias)
        return Function(
            f"histogramIf({num_buckets})",
            [
                Column("value"),
                Function("and", [zoom_params, metric_condition])
                if zoom_params
                else metric_condition,
            ],
            alias,
        )

    def _resolve_count_miserable_function(
        self,
        args: Mapping[str, Union[str, Column, SelectType, int, float]],
        alias: Optional[str] = None,
    ) -> SelectType:
        if args["satisfaction"] is not None:
            raise IncompatibleMetricsQuery(
                "Cannot query misery with a threshold parameter on the metrics dataset"
            )
        metric_frustrated = self.builder.resolve_tag_value(constants.METRIC_FRUSTRATED_TAG_VALUE)

        # Nobody is miserable, we can return 0
        if metric_frustrated is None:
            return Function(
                "toUInt64",
                [0],
                alias,
            )

        return Function(
            "uniqIf",
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
                            [
                                self.builder.column(constants.METRIC_SATISFACTION_TAG_KEY),
                                metric_frustrated,
                            ],
                        ),
                    ],
                ),
            ],
            alias,
        )

    def _resolve_user_misery_function(
        self,
        args: Mapping[str, Union[str, Column, SelectType, int, float]],
        alias: Optional[str] = None,
    ) -> SelectType:
        if args["satisfaction"] is not None:
            raise IncompatibleMetricsQuery(
                "Cannot query user_misery with a threshold parameter on the metrics dataset"
            )
        return Function(
            "divide",
            [
                Function(
                    "plus",
                    [
                        self.builder.resolve_function("count_miserable(user)"),
                        args["alpha"],
                    ],
                ),
                Function(
                    "plus",
                    [
                        Function(
                            "nullIf", [self.builder.resolve_function("count_unique(user)"), 0]
                        ),
                        args["alpha"] + args["beta"],
                    ],
                ),
            ],
            alias,
        )

    def _resolve_failure_count(
        self,
        _: Mapping[str, Union[str, Column, SelectType, int, float]],
        alias: Optional[str] = None,
    ) -> SelectType:
        statuses = [
            self.builder.resolve_tag_value(status) for status in constants.NON_FAILURE_STATUS
        ]
        return self._resolve_count_if(
            Function(
                "equals",
                [
                    Column("metric_id"),
                    self.resolve_metric("transaction.duration"),
                ],
            ),
            Function(
                "notIn",
                [
                    self.builder.column("transaction.status"),
                    list(status for status in statuses if status is not None),
                ],
            ),
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
                self.builder.column("http.status_code"),
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
                    self.resolve_metric("transaction.duration"),
                ],
            ),
            condition,
            alias,
        )

    def _resolve_percentile(
        self,
        args: Mapping[str, Union[str, Column, SelectType, int, float]],
        alias: str,
        fixed_percentile: Optional[float] = None,
    ) -> SelectType:
        return function_aliases.resolve_metrics_percentile(
            args=args, alias=alias, fixed_percentile=fixed_percentile
        )

    def _key_transaction_filter_converter(self, search_filter: SearchFilter) -> Optional[WhereType]:
        return filter_aliases.team_key_transaction_filter(self.builder, search_filter)

    def _resolve_count_starts_function(
        self,
        args: Mapping[str, Union[str, Column, SelectType, int, float]],
        alias: str,
    ) -> SelectType:
        column = args["column"]
        metric_id = args["metric_id"]

        if column not in [
            "measurements.app_start_cold",
            "measurements.app_start_warm",
        ]:
            raise InvalidSearchQuery("count_starts only supports cold or app start measurements")

        return Function(
            "countIf",
            [
                Column("value"),
                Function("equals", [Column("metric_id"), metric_id]),
            ],
            alias,
        )

    def _resolve_web_vital_function(
        self,
        args: Mapping[str, Union[str, Column, SelectType, int, float]],
        alias: str,
    ) -> SelectType:
        column = args["column"]
        metric_id = args["metric_id"]
        quality = args["quality"].lower()

        if column not in [
            "measurements.lcp",
            "measurements.fcp",
            "measurements.fp",
            "measurements.fid",
            "measurements.cls",
            "measurements.ttfb",
        ]:
            raise InvalidSearchQuery("count_web_vitals only supports measurements")

        measurement_rating = self.builder.resolve_column("measurement_rating")

        if quality == "any":
            return Function(
                "countIf",
                [
                    Column("value"),
                    Function("equals", [Column("metric_id"), metric_id]),
                ],
                alias,
            )

        try:
            quality_id = self.builder.resolve_tag_value(quality)
        except IncompatibleMetricsQuery:
            quality_id = None

        if quality_id is None:
            return Function(
                # This matches the type from doing `select toTypeName(count()) ...` from clickhouse
                "toUInt64",
                [0],
                alias,
            )

        return Function(
            "countIf",
            [
                Column("value"),
                Function(
                    "and",
                    [
                        Function("equals", [measurement_rating, quality_id]),
                        Function("equals", [Column("metric_id"), metric_id]),
                    ],
                ),
            ],
            alias,
        )

    def _resolve_web_vital_score_function(
        self,
        args: Mapping[str, Union[str, Column, SelectType, int, float]],
        alias: str,
    ) -> SelectType:
        column = args["column"]
        metric_id = args["metric_id"]

        if column not in [
            "measurements.score.lcp",
            "measurements.score.fcp",
            "measurements.score.fid",
            "measurements.score.cls",
            "measurements.score.ttfb",
        ]:
            raise InvalidSearchQuery("performance_score only supports measurements")

        weight_metric_id = self.resolve_metric(column.replace("score", "score.weight"))

        return Function(
            "greatest",
            [
                Function(
                    "least",
                    [
                        Function(
                            "if",
                            [
                                Function(
                                    "greater",
                                    [
                                        Function(
                                            "sumIf",
                                            [
                                                Column("value"),
                                                Function(
                                                    "equals",
                                                    [Column("metric_id"), weight_metric_id],
                                                ),
                                            ],
                                        ),
                                        0.0,
                                    ],
                                ),
                                Function(
                                    "divide",
                                    [
                                        Function(
                                            "sumIf",
                                            [
                                                Column("value"),
                                                Function(
                                                    "equals", [Column("metric_id"), metric_id]
                                                ),
                                            ],
                                        ),
                                        Function(
                                            "sumIf",
                                            [
                                                Column("value"),
                                                Function(
                                                    "equals",
                                                    [Column("metric_id"), weight_metric_id],
                                                ),
                                            ],
                                        ),
                                    ],
                                ),
                                0.0,
                            ],
                        ),
                        1.0,
                    ],
                ),
                0.0,
            ],
            alias,
        )

    def _resolve_weighted_web_vital_score_function(
        self,
        args: Mapping[str, Union[str, Column, SelectType, int, float]],
        alias: str,
    ) -> SelectType:
        column = args["column"]
        metric_id = args["metric_id"]

        if column not in [
            "measurements.score.lcp",
            "measurements.score.fcp",
            "measurements.score.fid",
            "measurements.score.cls",
            "measurements.score.ttfb",
        ]:
            raise InvalidSearchQuery("performance_score only supports measurements")

        return Function(
            "greatest",
            [
                Function(
                    "least",
                    [
                        Function(
                            "if",
                            [
                                Function(
                                    "and",
                                    [
                                        Function(
                                            "greater",
                                            [
                                                Function(
                                                    "sumIf",
                                                    [
                                                        Column("value"),
                                                        Function(
                                                            "equals",
                                                            [Column("metric_id"), metric_id],
                                                        ),
                                                    ],
                                                ),
                                                0,
                                            ],
                                        ),
                                        Function(
                                            "greater",
                                            [
                                                Function(
                                                    "countIf",
                                                    [
                                                        Column("value"),
                                                        Function(
                                                            "equals",
                                                            [
                                                                Column("metric_id"),
                                                                self.resolve_metric(
                                                                    "measurements.score.total"
                                                                ),
                                                            ],
                                                        ),
                                                    ],
                                                ),
                                                0,
                                            ],
                                        ),
                                    ],
                                ),
                                Function(
                                    "divide",
                                    [
                                        Function(
                                            "sumIf",
                                            [
                                                Column("value"),
                                                Function(
                                                    "equals", [Column("metric_id"), metric_id]
                                                ),
                                            ],
                                        ),
                                        Function(
                                            "countIf",
                                            [
                                                Column("value"),
                                                Function(
                                                    "equals",
                                                    [
                                                        Column("metric_id"),
                                                        self.resolve_metric(
                                                            "measurements.score.total"
                                                        ),
                                                    ],
                                                ),
                                            ],
                                        ),
                                    ],
                                ),
                                0.0,
                            ],
                        ),
                        1.0,
                    ],
                ),
                0.0,
            ],
            alias,
        )

    def _resolve_web_vital_opportunity_score_function(
        self,
        args: Mapping[str, Union[str, Column, SelectType, int, float]],
        alias: str,
    ) -> SelectType:
        column = args["column"]
        metric_id = args["metric_id"]

        if column not in [
            "measurements.score.lcp",
            "measurements.score.fcp",
            "measurements.score.fid",
            "measurements.score.cls",
            "measurements.score.ttfb",
            "measurements.score.total",
        ]:
            raise InvalidSearchQuery("performance_score only supports measurements")

        weight_metric = (
            Function(
                "countIf",
                [
                    Column("value"),
                    Function(
                        "equals",
                        [
                            Column("metric_id"),
                            metric_id,
                        ],
                    ),
                ],
            )
            if column == "measurements.score.total"
            else Function(
                "sumIf",
                [
                    Column("value"),
                    Function(
                        "equals",
                        [
                            Column("metric_id"),
                            self.resolve_metric(column.replace("score", "score.weight")),
                        ],
                    ),
                ],
            )
        )

        return Function(
            "minus",
            [
                weight_metric,
                Function(
                    "sumIf",
                    [
                        Column("value"),
                        Function("equals", [Column("metric_id"), metric_id]),
                    ],
                ),
            ],
            alias,
        )

    def _resolve_count_scores_function(
        self,
        args: Mapping[str, Union[str, Column, SelectType, int, float]],
        alias: str,
    ) -> SelectType:
        column = args["column"]
        metric_id = args["metric_id"]

        if column not in [
            "measurements.score.total",
            "measurements.score.lcp",
            "measurements.score.fcp",
            "measurements.score.fid",
            "measurements.score.cls",
            "measurements.score.ttfb",
        ]:
            raise InvalidSearchQuery("count_scores only supports performance score measurements")

        return Function(
            "countIf",
            [
                Column("value"),
                Function("equals", [Column("metric_id"), metric_id]),
            ],
            alias,
        )

    def _resolve_total_transaction_duration(self, alias: str, scope: str) -> SelectType:
        """This calculates the total time, and based on the scope will return
        either the apps total time or whatever other local scope/filters are
        applied.
        This must be cached since it runs another query."""
        self.builder.requires_other_aggregates = True
        if self.total_transaction_duration is not None:
            return Function("toFloat64", [self.total_transaction_duration], alias)

        total_query = builder.MetricsQueryBuilder(
            dataset=self.builder.dataset,
            params={},
            snuba_params=self.builder.params,
            selected_columns=["sum(transaction.duration)"],
        )

        total_query.columns += self.builder.resolve_groupby()
        if scope == "local":
            total_query.where = self.builder.where

        total_results = total_query.run_query(
            Referrer.API_DISCOVER_TOTAL_SUM_TRANSACTION_DURATION_FIELD.value
        )
        results = total_query.process_results(total_results)

        if len(results["data"]) != 1:
            self.total_transaction_duration = 0
            return Function("toFloat64", [0], alias)
        self.total_transaction_duration = results["data"][0]["sum_transaction_duration"]
        return Function("toFloat64", [self.total_transaction_duration], alias)

    def _resolve_time_spent_percentage(
        self, args: Mapping[str, Union[str, Column, SelectType, int, float]], alias: str
    ) -> SelectType:
        total_time = self._resolve_total_transaction_duration(
            constants.TOTAL_TRANSACTION_DURATION_ALIAS, args["scope"]
        )
        metric_id = self.resolve_metric("transaction.duration")

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
                self.resolve_metric("transaction.duration"),
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
