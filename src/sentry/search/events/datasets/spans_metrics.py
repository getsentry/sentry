from __future__ import annotations

from typing import Callable, Mapping, Optional, Union

import sentry_sdk
from snuba_sdk import AliasedExpression, Column, Condition, Function, Identifier, Op, OrderBy

from sentry.api.event_search import SearchFilter
from sentry.exceptions import IncompatibleMetricsQuery
from sentry.search.events import builder, constants, fields
from sentry.search.events.datasets import field_aliases, filter_aliases, function_aliases
from sentry.search.events.datasets.base import DatasetConfig
from sentry.search.events.types import SelectType, WhereType
from sentry.snuba.metrics.naming_layer.mri import SpanMRI
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
        return {
            constants.SPAN_DOMAIN_ALIAS: self._span_domain_filter_converter,
            constants.DEVICE_CLASS_ALIAS: lambda search_filter: filter_aliases.device_class_converter(
                self.builder, search_filter
            ),
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
        }

    def resolve_metric(self, value: str) -> int:
        metric_id = self.builder.resolve_metric_index(constants.SPAN_METRICS_MAP.get(value, value))
        # If its still None its not a custom measurement
        if metric_id is None:
            raise IncompatibleMetricsQuery(f"Metric: {value} could not be resolved")
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
                    "avg",
                    optional_args=[
                        fields.with_default(
                            "span.self_time",
                            fields.MetricArg(
                                "column",
                                allowed_columns=constants.SPAN_METRIC_DURATION_COLUMNS.union(
                                    constants.SPAN_METRIC_BYTES_COLUMNS
                                ),
                            ),
                        ),
                    ],
                    calculated_args=[resolve_metric_id],
                    snql_distribution=lambda args, alias: Function(
                        "avgIf",
                        [
                            Column("value"),
                            Function("equals", [Column("metric_id"), args["metric_id"]]),
                        ],
                        alias,
                    ),
                    is_percentile=True,
                    result_type_fn=self.reflective_result_type(),
                    default_result_type="duration",
                ),
                fields.MetricsFunction(
                    "avg_if",
                    required_args=[
                        fields.MetricArg(
                            "column",
                            allowed_columns=constants.SPAN_METRIC_DURATION_COLUMNS,
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
                        )
                    ],
                    snql_distribution=self._resolve_time_spent_percentage,
                    default_result_type="percentage",
                ),
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
                            allowed_columns=constants.SPAN_METRIC_DURATION_COLUMNS,
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

        for alias, name in constants.SPAN_FUNCTION_ALIASES.items():
            if name in function_converter:
                function_converter[alias] = function_converter[name].alias_as(alias)

        return function_converter

    def _span_domain_filter_converter(self, search_filter: SearchFilter) -> Optional[WhereType]:
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

    def _resolve_span_module(self, alias: str) -> SelectType:
        return field_aliases.resolve_span_module(self.builder, alias)

    def _resolve_span_domain(self, alias: Optional[str] = None) -> SelectType:
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
        alias: Optional[str] = None,
    ) -> SelectType:
        return Function("arrayJoin", [self._resolve_span_domain()], alias)

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

    def _resolve_main_thread_count(
        self,
        _: Mapping[str, Union[str, Column, SelectType, int, float]],
        alias: Optional[str] = None,
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
        _: Mapping[str, Union[str, Column, SelectType, int, float]],
        alias: Optional[str] = None,
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
        _: Mapping[str, Union[str, Column, SelectType, int, float]],
        alias: Optional[str] = None,
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

    @property
    def orderby_converter(self) -> Mapping[str, OrderBy]:
        return {}


class SpansMetricsLayerDatasetConfig(DatasetConfig):
    missing_function_error = IncompatibleMetricsQuery

    def __init__(self, builder: builder.SpansMetricsQueryBuilder):
        self.builder = builder
        self.total_span_duration: Optional[float] = None

    def resolve_mri(self, value) -> Column:
        """Given the public facing column name resolve it to the MRI and return a Column"""
        # If the query builder has not detected a transaction use the light self time metric to get a performance boost
        if value == "span.self_time" and not self.builder.has_transaction:
            return Column(constants.SELF_TIME_LIGHT)
        else:
            return Column(constants.SPAN_METRICS_MAP[value])

    @property
    def search_filter_converter(
        self,
    ) -> Mapping[str, Callable[[SearchFilter], Optional[WhereType]]]:
        return {}

    @property
    def field_alias_converter(self) -> Mapping[str, Callable[[str], SelectType]]:
        return {
            constants.SPAN_MODULE_ALIAS: lambda alias: field_aliases.resolve_span_module(
                self.builder, alias
            )
        }

    @property
    def function_converter(self) -> Mapping[str, fields.MetricsFunction]:
        """Make sure to update METRIC_FUNCTION_LIST_BY_TYPE when adding functions here, can't be a dynamic list since
        the Metric Layer will actually handle which dataset each function goes to
        """

        function_converter = {
            function.name: function
            for function in [
                fields.MetricsFunction(
                    "count_unique",
                    required_args=[
                        fields.MetricArg(
                            "column",
                            allowed_columns=["user"],
                            allow_custom_measurements=False,
                        )
                    ],
                    snql_metric_layer=lambda args, alias: Function(
                        "count_unique",
                        [self.resolve_mri("user")],
                        alias,
                    ),
                    default_result_type="integer",
                ),
                fields.MetricsFunction(
                    "epm",
                    snql_metric_layer=lambda args, alias: Function(
                        "rate",
                        [
                            self.resolve_mri("span.self_time"),
                            args["interval"],
                            60,
                        ],
                        alias,
                    ),
                    optional_args=[fields.IntervalDefault("interval", 1, None)],
                    default_result_type="rate",
                ),
                fields.MetricsFunction(
                    "eps",
                    snql_metric_layer=lambda args, alias: Function(
                        "rate",
                        [
                            self.resolve_mri("span.self_time"),
                            args["interval"],
                            1,
                        ],
                        alias,
                    ),
                    optional_args=[fields.IntervalDefault("interval", 1, None)],
                    default_result_type="rate",
                ),
                fields.MetricsFunction(
                    "count",
                    snql_metric_layer=lambda args, alias: Function(
                        "count",
                        [
                            self.resolve_mri("span.self_time"),
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
                    snql_metric_layer=lambda args, alias: Function(
                        "sum",
                        [self.resolve_mri(args["column"])],
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
                                allowed_columns=constants.SPAN_METRIC_DURATION_COLUMNS.union(
                                    constants.SPAN_METRIC_BYTES_COLUMNS
                                ),
                            ),
                        ),
                    ],
                    snql_metric_layer=lambda args, alias: Function(
                        "avg",
                        [self.resolve_mri(args["column"])],
                        alias,
                    ),
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
                    snql_metric_layer=lambda args, alias: function_aliases.resolve_metrics_layer_percentile(
                        args,
                        alias,
                        self.resolve_mri,
                    ),
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
                    snql_metric_layer=lambda args, alias: function_aliases.resolve_metrics_layer_percentile(
                        args=args, alias=alias, resolve_mri=self.resolve_mri, fixed_percentile=0.50
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
                    snql_metric_layer=lambda args, alias: function_aliases.resolve_metrics_layer_percentile(
                        args=args, alias=alias, resolve_mri=self.resolve_mri, fixed_percentile=0.75
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
                    snql_metric_layer=lambda args, alias: function_aliases.resolve_metrics_layer_percentile(
                        args=args, alias=alias, resolve_mri=self.resolve_mri, fixed_percentile=0.95
                    ),
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
                    snql_metric_layer=lambda args, alias: function_aliases.resolve_metrics_layer_percentile(
                        args=args, alias=alias, resolve_mri=self.resolve_mri, fixed_percentile=0.99
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
                    snql_metric_layer=lambda args, alias: function_aliases.resolve_metrics_layer_percentile(
                        args=args, alias=alias, resolve_mri=self.resolve_mri, fixed_percentile=1.0
                    ),
                    default_result_type="duration",
                ),
                fields.MetricsFunction(
                    "http_error_count",
                    snql_metric_layer=lambda args, alias: AliasedExpression(
                        Column(
                            SpanMRI.HTTP_ERROR_COUNT_LIGHT.value
                            if not self.builder.has_transaction
                            else SpanMRI.HTTP_ERROR_COUNT.value
                        ),
                        alias,
                    ),
                    default_result_type="integer",
                ),
                fields.MetricsFunction(
                    "http_error_rate",
                    snql_metric_layer=lambda args, alias: AliasedExpression(
                        Column(
                            SpanMRI.HTTP_ERROR_RATE_LIGHT.value
                            if not self.builder.has_transaction
                            else SpanMRI.HTTP_ERROR_RATE.value
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

    @property
    def orderby_converter(self) -> Mapping[str, OrderBy]:
        return {}
