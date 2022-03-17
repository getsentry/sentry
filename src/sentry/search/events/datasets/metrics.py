from __future__ import annotations

from typing import Callable, Mapping, Optional, Union

from snuba_sdk import Column, Function

from sentry.api.event_search import SearchFilter
from sentry.exceptions import IncompatibleMetricsQuery, InvalidSearchQuery
from sentry.search.events import constants, fields
from sentry.search.events.builder import MetricsQueryBuilder
from sentry.search.events.datasets import field_aliases, filter_aliases
from sentry.search.events.datasets.base import DatasetConfig
from sentry.search.events.types import SelectType, WhereType
from sentry.sentry_metrics import indexer


class MetricsDatasetConfig(DatasetConfig):
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
        }

    @property
    def field_alias_converter(self) -> Mapping[str, Callable[[str], SelectType]]:
        return {
            constants.PROJECT_ALIAS: self._resolve_project_slug_alias,
            constants.PROJECT_NAME_ALIAS: self._resolve_project_slug_alias,
            constants.TEAM_KEY_TRANSACTION_ALIAS: self._resolve_team_key_transaction_alias,
        }

    def resolve_metric(self, value: str) -> int:
        metric_id = indexer.resolve(constants.METRICS_MAP.get(value, value))
        if metric_id is None:
            # TODO: unsure if this should be incompatible or invalid
            raise InvalidSearchQuery(f"Metric: {value} could not be resolved")

        self.builder.metric_ids.append(metric_id)
        return metric_id

    @property
    def function_converter(self) -> Mapping[str, fields.MetricsFunction]:
        """While the final functions in clickhouse must have their -Merge combinators in order to function, we don't
        need to add them here since snuba has a FunctionMapper that will add it for us. Basically it turns expressions
        like quantiles(0.9)(value) into quantilesMerge(0.9)(percentiles)
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
                # TODO: Should raise IncompatibleMetricsQuery when params are passed
                fields.MetricsFunction(
                    "apdex",
                    optional_args=[],
                    snql_distribution=self._resolve_apdex_function,
                    default_result_type="number",
                ),
                fields.MetricsFunction(
                    "count_miserable",
                    required_args=[fields.FunctionArg("column")],
                    calculated_args=[resolve_metric_id],
                    snql_set=self._resolve_count_miserable_function,
                    default_result_type="integer",
                ),
                fields.MetricsFunction(
                    "user_misery",
                    optional_args=[],
                    calculated_args=[],
                    snql_set=self._resolve_user_misery_function,
                    default_result_type="number",
                ),
                fields.MetricsFunction(
                    "p50",
                    optional_args=[
                        fields.with_default("transaction.duration", fields.FunctionArg("column")),
                    ],
                    calculated_args=[resolve_metric_id],
                    snql_distribution=lambda args, alias: self._resolve_percentile(
                        args, alias, 0.5
                    ),
                    default_result_type="duration",
                ),
                fields.MetricsFunction(
                    "p75",
                    optional_args=[
                        fields.with_default("transaction.duration", fields.FunctionArg("column")),
                    ],
                    calculated_args=[resolve_metric_id],
                    snql_distribution=lambda args, alias: self._resolve_percentile(
                        args, alias, 0.75
                    ),
                    default_result_type="duration",
                ),
                fields.MetricsFunction(
                    "p90",
                    optional_args=[
                        fields.with_default("transaction.duration", fields.FunctionArg("column")),
                    ],
                    calculated_args=[resolve_metric_id],
                    snql_distribution=lambda args, alias: self._resolve_percentile(
                        args, alias, 0.90
                    ),
                    default_result_type="duration",
                ),
                fields.MetricsFunction(
                    "p95",
                    optional_args=[
                        fields.with_default("transaction.duration", fields.FunctionArg("column")),
                    ],
                    calculated_args=[resolve_metric_id],
                    snql_distribution=lambda args, alias: self._resolve_percentile(
                        args, alias, 0.95
                    ),
                    default_result_type="duration",
                ),
                fields.MetricsFunction(
                    "p99",
                    optional_args=[
                        fields.with_default("transaction.duration", fields.FunctionArg("column")),
                    ],
                    calculated_args=[resolve_metric_id],
                    snql_distribution=lambda args, alias: self._resolve_percentile(
                        args, alias, 0.99
                    ),
                    default_result_type="duration",
                ),
                fields.MetricsFunction(
                    "p100",
                    optional_args=[
                        fields.with_default("transaction.duration", fields.FunctionArg("column")),
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
                    default_result_type="duration",
                ),
                fields.MetricsFunction(
                    "count_unique",
                    required_args=[fields.FunctionArg("column")],
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
                    "count_web_vitals",
                    required_args=[
                        fields.FunctionArg("column"),
                        fields.SnQLStringArg("quality", allowed_strings=["good", "meh", "poor"]),
                    ],
                    calculated_args=[resolve_metric_id],
                    snql_distribution=self._resolve_web_vital_function,
                    default_result_type="integer",
                ),
                fields.MetricsFunction(
                    "epm",
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
                                            self.resolve_metric("transaction.duration"),
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
                    "eps",
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
                                            self.resolve_metric("transaction.duration"),
                                        ],
                                    ),
                                ],
                            ),
                            args["interval"],
                        ],
                        alias,
                    ),
                    optional_args=[fields.IntervalDefault("interval", 1, None)],
                    default_result_type="number",
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
                    default_result_type="integer",
                ),
            ]
        }

        for alias, name in constants.FUNCTION_ALIASES.items():
            if name in function_converter:
                function_converter[alias] = function_converter[name].alias_as(alias)

        return function_converter

    # Field Aliases
    def _resolve_team_key_transaction_alias(self, _: str) -> SelectType:
        return field_aliases.resolve_team_key_transaction_alias(
            self.builder, resolve_metric_index=True
        )

    def _resolve_project_slug_alias(self, alias: str) -> SelectType:
        return field_aliases.resolve_project_slug_alias(self.builder, alias)

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
        _: Mapping[str, Union[str, Column, SelectType, int, float]],
        alias: Optional[str] = None,
    ) -> SelectType:
        metric_true = indexer.resolve(constants.METRIC_TRUE_TAG_VALUE)

        # Nothing is satisfied or tolerated, the score must be 0
        if metric_true is None:
            return Function(
                "toUInt64",
                [0],
                alias,
            )

        satisfied = Function(
            "equals", [self.builder.column(constants.METRIC_SATISFIED_TAG_KEY), metric_true]
        )
        tolerable = Function(
            "equals", [self.builder.column(constants.METRIC_TOLERATED_TAG_KEY), metric_true]
        )
        metric_condition = Function(
            "equals", [Column("metric_id"), self.resolve_metric("transaction.duration")]
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
                Function("countIf", [metric_condition]),
            ],
            alias,
        )

    def _resolve_count_miserable_function(
        self,
        args: Mapping[str, Union[str, Column, SelectType, int, float]],
        alias: Optional[str] = None,
    ) -> SelectType:
        metric_true = indexer.resolve(constants.METRIC_TRUE_TAG_VALUE)

        # Nobody is miserable, we can return 0
        if metric_true is None:
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
                            [self.builder.column(constants.METRIC_MISERABLE_TAG_KEY), metric_true],
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
        return Function(
            "divide",
            [
                Function(
                    "plus",
                    [
                        self.builder.resolve_function("count_miserable(user)"),
                        constants.MISERY_ALPHA,
                    ],
                ),
                Function(
                    "plus",
                    [
                        Function(
                            "nullIf", [self.builder.resolve_function("count_unique(user)"), 0]
                        ),
                        constants.MISERY_ALPHA + constants.MISERY_BETA,
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
        statuses = [indexer.resolve(status) for status in constants.NON_FAILURE_STATUS]
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

    def _resolve_percentile(
        self,
        args: Mapping[str, Union[str, Column, SelectType, int, float]],
        alias: str,
        fixed_percentile: float,
    ) -> SelectType:
        return Function(
            "arrayElement",
            [
                Function(
                    f"quantilesIf({fixed_percentile})",
                    [
                        Column("value"),
                        Function("equals", [Column("metric_id"), args["metric_id"]]),
                    ],
                ),
                1,
            ],
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
        metric_id = args["metric_id"]
        quality = args["quality"].lower()

        if column not in [
            "measurements.lcp",
            "measurements.fcp",
            "measurements.fp",
            "measurements.fid",
            "measurements.cls",
        ]:
            raise InvalidSearchQuery("count_web_vitals only supports measurements")

        measurement_rating = self.builder.resolve_column("measurement_rating")

        quality_id = indexer.resolve(quality)
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
