from __future__ import annotations

from typing import Callable, Mapping, Optional, Union

import sentry_sdk
from snuba_sdk import AliasedExpression, Column, Condition, Function, Op

from sentry.api.event_search import SearchFilter
from sentry.exceptions import IncompatibleMetricsQuery, InvalidSearchQuery
from sentry.search.events import constants, fields
from sentry.search.events.builder import MetricsQueryBuilder
from sentry.search.events.datasets import field_aliases, filter_aliases
from sentry.search.events.datasets.metrics import MetricsDatasetConfig
from sentry.search.events.types import SelectType, WhereType
from sentry.snuba.metrics.naming_layer.mri import TransactionMRI
from sentry.utils.numbers import format_grouped_length


class MetricsLayerDatasetConfig(MetricsDatasetConfig):
    def __init__(self, builder: MetricsQueryBuilder):
        self.builder = builder

    @property
    def search_filter_converter(
        self,
    ) -> Mapping[str, Callable[[SearchFilter], Optional[WhereType]]]:
        return {
            constants.PROJECT_ALIAS: self._project_slug_filter_converter,
            constants.PROJECT_NAME_ALIAS: self._project_slug_filter_converter,
            constants.EVENT_TYPE_ALIAS: self._event_type_converter,
            constants.TEAM_KEY_TRANSACTION_ALIAS: self._key_transaction_filter_converter,
            "transaction.duration": self._duration_filter_converter,
            "transaction": self._transaction_filter_converter,
            "tags[transaction]": self._transaction_filter_converter,
            constants.TITLE_ALIAS: self._transaction_filter_converter,
        }

    @property
    def field_alias_converter(self) -> Mapping[str, Callable[[str], SelectType]]:
        return {
            constants.PROJECT_ALIAS: self._resolve_project_slug_alias,
            constants.PROJECT_NAME_ALIAS: self._resolve_project_slug_alias,
            constants.TEAM_KEY_TRANSACTION_ALIAS: self._resolve_team_key_transaction_alias,
            constants.TITLE_ALIAS: self._resolve_title_alias,
            "transaction": self._resolve_transaction_alias,
            "tags[transaction]": self._resolve_transaction_alias,
        }

    def resolve_metric(self, value: str) -> str:
        """Resolve to the MRI"""
        metric_mri = constants.METRICS_MAP.get(value)
        if metric_mri is None:
            # Maybe this is a custom measurment?
            for measurement in self.builder.custom_measurement_map:
                if measurement["name"] == value and measurement["metric_id"] is not None:
                    return measurement["mri_string"]
        if metric_mri is None:
            metric_mri = value
        return metric_mri

    @property
    def function_converter(self) -> Mapping[str, fields.MetricsFunction]:
        """Make sure to update METRIC_FUNCTION_LIST_BY_TYPE when adding functions here, can't be a dynamic list since
        the Metric Layer will actually handle which dataset each function goes to
        """

        function_converter = {
            function.name: function
            for function in [
                # Note while the discover version of apdex, count_miserable, user_misery
                # accepts arguments, because this is precomputed with tags no parameters
                # are available
                # TODO: Should raise IncompatibleMetricsQuery when params are passed
                fields.MetricsFunction(
                    "apdex",
                    optional_args=[fields.NullableNumberRange("satisfaction", 0, None)],
                    snql_metric_layer=self._resolve_apdex_function,
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
                    snql_metric_layer=lambda args, alias: Function(
                        "avg",
                        [
                            Column(self.resolve_metric(args["column"])),
                        ],
                        alias,
                    ),
                    default_result_type="integer",
                ),
                fields.MetricsFunction(
                    "count_miserable",
                    required_args=[
                        fields.MetricArg(
                            "column", allowed_columns=["user"], allow_custom_measurements=False
                        )
                    ],
                    optional_args=[fields.NullableNumberRange("satisfaction", 0, None)],
                    snql_metric_layer=self._resolve_count_miserable_function,
                    default_result_type="integer",
                ),
                fields.MetricsFunction(
                    "user_misery",
                    optional_args=[fields.NullableNumberRange("satisfaction", 0, None)],
                    snql_metric_layer=self._resolve_user_misery_function,
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
                    snql_metric_layer=lambda args, alias: self._resolve_percentile(
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
                    snql_metric_layer=lambda args, alias: self._resolve_percentile(
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
                    snql_metric_layer=lambda args, alias: self._resolve_percentile(
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
                    snql_metric_layer=lambda args, alias: self._resolve_percentile(
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
                    snql_metric_layer=lambda args, alias: self._resolve_percentile(
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
                    snql_metric_layer=lambda args, alias: self._resolve_percentile(args, alias, 1),
                    result_type_fn=self.reflective_result_type(),
                    default_result_type="duration",
                ),
                fields.MetricsFunction(
                    "max",
                    required_args=[
                        fields.MetricArg("column"),
                    ],
                    snql_metric_layer=lambda args, alias: Function(
                        "max",
                        [
                            Column(self.resolve_metric(args["column"])),
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
                    snql_metric_layer=lambda args, alias: Function(
                        "min",
                        [
                            Column(self.resolve_metric(args["column"])),
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
                    snql_metric_layer=lambda args, alias: Function(
                        "sum",
                        [
                            Column(self.resolve_metric(args["column"])),
                        ],
                        alias,
                    ),
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
                            "fn": lambda args: self.resolve_value(args["if_val"]),
                        }
                    ],
                    snql_metric_layer=lambda args, alias: Function(
                        "sumIf",
                        [
                            Column(self.resolve_metric(args["column"])),
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
                    snql_metric_layer=self._resolve_percentile,
                    default_result_type="duration",
                ),
                fields.MetricsFunction(
                    "count_unique",
                    required_args=[
                        fields.MetricArg(
                            "column", allowed_columns=["user"], allow_custom_measurements=False
                        )
                    ],
                    snql_metric_layer=lambda args, alias: Function(
                        "count_unique",
                        [
                            Column(TransactionMRI.USER.value),
                        ],
                        alias,
                    ),
                    default_result_type="integer",
                ),
                fields.MetricsFunction(
                    "uniq",
                    snql_metric_layer=lambda args, alias: Function(
                        "uniq",
                        [Column(self.resolve_metric(args["column"]))],
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
                            "fn": lambda args: self.resolve_value(args["if_val"]),
                        }
                    ],
                    snql_metric_layer=lambda args, alias: Function(
                        "uniqIf",
                        [
                            Column(self.resolve_metric(args["column"])),
                            Function("equals", [args["if_col"], args["resolved_val"]]),
                        ],
                        alias,
                    ),
                    default_result_type="integer",
                ),
                fields.MetricsFunction(
                    "count",
                    snql_metric_layer=lambda args, alias: Function(
                        "count",
                        [],
                        alias,
                    ),
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
                            ],
                            allow_custom_measurements=False,
                        ),
                        fields.SnQLStringArg(
                            "quality", allowed_strings=["good", "meh", "poor", "any"]
                        ),
                    ],
                    snql_metric_layer=self._resolve_web_vital_function,
                    default_result_type="integer",
                ),
                fields.MetricsFunction(
                    "epm",
                    snql_metric_layer=lambda args, alias: Function(
                        "rate",
                        [
                            Column(TransactionMRI.DURATION.value),
                            60,
                            args["interval"],
                        ],
                        alias,
                    ),
                    optional_args=[fields.IntervalDefault("interval", 1, None)],
                    default_result_type="number",
                ),
                fields.MetricsFunction(
                    "eps",
                    snql_metric_layer=lambda args, alias: Function(
                        "rate",
                        [
                            Column(TransactionMRI.DURATION.value),
                            1,
                            args["interval"],
                        ],
                        alias,
                    ),
                    optional_args=[fields.IntervalDefault("interval", 1, None)],
                    default_result_type="number",
                ),
                fields.MetricsFunction(
                    "failure_count",
                    snql_metric_layer=lambda args, alias: Function(
                        TransactionMRI.FAILURE_COUNT.value, [], alias
                    ),
                    default_result_type="integer",
                ),
                fields.MetricsFunction(
                    "failure_rate",
                    snql_metric_layer=lambda args, alias: AliasedExpression(
                        Column(TransactionMRI.FAILURE_RATE.value), alias
                    ),
                    default_result_type="percentage",
                ),
                # TODO: histogram
            ]
        }

        for alias, name in constants.FUNCTION_ALIASES.items():
            if name in function_converter:
                function_converter[alias] = function_converter[name].alias_as(alias)

        return function_converter

    # Field Aliases
    def _resolve_transaction_alias(self, alias: str) -> SelectType:
        return Function(
            "transform_null_to_unparameterized",
            [Column("d:transactions/duration@millisecond"), "transaction"],
            alias,
        )

    def _resolve_title_alias(self, alias: str) -> SelectType:
        """title == transaction in discover"""
        return self._resolve_transaction_alias(alias)

    def _resolve_team_key_transaction_alias(self, _: str) -> SelectType:
        if self.builder.dry_run:
            return field_aliases.dry_run_default(self.builder, constants.TEAM_KEY_TRANSACTION_ALIAS)
        team_key_transactions = field_aliases.get_team_transactions(self.builder)
        count = len(team_key_transactions)

        # NOTE: this raw count is not 100% accurate because if it exceeds
        # `MAX_QUERYABLE_TEAM_KEY_TRANSACTIONS`, it will not be reflected
        sentry_sdk.set_tag("team_key_txns.count", count)
        sentry_sdk.set_tag(
            "team_key_txns.count.grouped", format_grouped_length(count, [10, 100, 250, 500])
        )

        if count == 0:
            team_key_transactions = [(-1, "")]
        return Function(
            function="team_key_transaction",
            parameters=[Column("d:transactions/duration@millisecond"), team_key_transactions],
            alias="team_key_transaction",
        )

    # Query Filters
    def _event_type_converter(self, search_filter: SearchFilter) -> Optional[WhereType]:
        """Not really a converter, check its transaction, error otherwise"""
        value = search_filter.value.value
        if value == "transaction":
            return None

        raise IncompatibleMetricsQuery("Can only filter event.type:transaction")

    def _project_slug_filter_converter(self, search_filter: SearchFilter) -> Optional[WhereType]:
        return filter_aliases.project_slug_converter(self.builder, search_filter)

    def _release_filter_converter(self, search_filter: SearchFilter) -> Optional[WhereType]:
        return filter_aliases.release_filter_converter(self.builder, search_filter)

    def _duration_filter_converter(self, search_filter: SearchFilter) -> Optional[WhereType]:
        if (
            self.builder.dry_run
            and search_filter.value.raw_value == 900000
            and search_filter.operator == "<"
        ):
            return None

        return self.builder._default_filter_converter(search_filter)

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

        return Condition(
            Column(self.builder.resolve_column_name("transaction")), Op(operator), value
        )

    # Query Functions
    def _resolve_percentile(
        self,
        args: Mapping[str, Union[str, Column, SelectType, int, float]],
        alias: str,
        fixed_percentile: Optional[float] = None,
    ) -> SelectType:
        if fixed_percentile is None:
            fixed_percentile = args["percentile"]
        if fixed_percentile not in constants.METRIC_PERCENTILES:
            raise IncompatibleMetricsQuery("Custom quantile incompatible with metrics")
        column = Column(self.resolve_metric(args["column"]))
        return (
            Function(
                "max",
                [
                    column,
                ],
                alias,
            )
            if fixed_percentile == 1
            else Function(
                f"p{int(fixed_percentile * 100)}",
                [
                    column,
                ],
                alias,
            )
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
        return AliasedExpression(
            Column(TransactionMRI.APDEX.value),
            alias,
        )

    def _resolve_user_misery_function(
        self,
        args: Mapping[str, Union[str, Column, SelectType, int, float]],
        alias: Optional[str] = None,
    ) -> SelectType:
        if args["satisfaction"] is not None:
            raise IncompatibleMetricsQuery(
                "Cannot query misery with a threshold parameter on the metrics dataset"
            )
        return AliasedExpression(
            Column(TransactionMRI.USER_MISERY.value),
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
        return AliasedExpression(
            Column(TransactionMRI.MISERABLE_USER.value),
            alias,
        )

    def _key_transaction_filter_converter(self, search_filter: SearchFilter) -> Optional[WhereType]:
        return filter_aliases.team_key_transaction_filter(self.builder, search_filter)

    def _resolve_web_vital_function(
        self,
        args: Mapping[str, Union[str, Column, SelectType, int, float]],
        alias: str,
    ) -> SelectType:
        column = args["column"]
        quality = args["quality"].lower()

        if column not in [
            "measurements.lcp",
            "measurements.fcp",
            "measurements.fp",
            "measurements.fid",
            "measurements.cls",
        ]:
            raise InvalidSearchQuery("count_web_vitals only supports measurements")

        if quality == "any":
            return Function(
                "count",
                [],
                alias,
            )

        return Function(
            "count_web_vitals",
            [Column(constants.METRICS_MAP.get(column, column)), quality],
            alias,
        )
