from __future__ import annotations

from typing import Callable, Mapping, Optional, Union

from snuba_sdk import Column, Direction, Function, OrderBy

from sentry.api.event_search import SearchFilter
from sentry.search.events import builder
from sentry.search.events.datasets.base import DatasetConfig
from sentry.search.events.fields import (
    ColumnTagArg,
    IntervalDefault,
    NullColumn,
    NumberRange,
    NumericColumn,
    SnQLFunction,
    with_default,
)
from sentry.search.events.types import SelectType, WhereType


class SpansIndexedDatasetConfig(DatasetConfig):
    def __init__(self, builder: builder.QueryBuilder):
        self.builder = builder
        self.total_count: Optional[int] = None
        self.total_sum_transaction_duration: Optional[float] = None

    @property
    def search_filter_converter(
        self,
    ) -> Mapping[str, Callable[[SearchFilter], Optional[WhereType]]]:
        return {}

    @property
    def field_alias_converter(self) -> Mapping[str, Callable[[str], SelectType]]:
        return {}

    @property
    def function_converter(self) -> Mapping[str, SnQLFunction]:
        function_converter = {
            function.name: function
            for function in [
                SnQLFunction(
                    "count",
                    optional_args=[NullColumn("column")],
                    snql_aggregate=lambda _, alias: Function(
                        "count",
                        [],
                        alias,
                    ),
                    default_result_type="integer",
                ),
                SnQLFunction(
                    "count_unique",
                    required_args=[ColumnTagArg("column")],
                    snql_aggregate=lambda args, alias: Function("uniq", [args["column"]], alias),
                    default_result_type="integer",
                ),
                SnQLFunction(
                    "sum",
                    required_args=[NumericColumn("column", spans=True)],
                    snql_aggregate=lambda args, alias: Function("sum", [args["column"]], alias),
                    result_type_fn=self.reflective_result_type(),
                    default_result_type="duration",
                ),
                SnQLFunction(
                    "percentile",
                    required_args=[
                        NumericColumn("column", spans=True),
                        NumberRange("percentile", 0, 1),
                    ],
                    snql_aggregate=self._resolve_percentile,
                    result_type_fn=self.reflective_result_type(),
                    default_result_type="duration",
                    redundant_grouping=True,
                ),
                SnQLFunction(
                    "p50",
                    optional_args=[
                        with_default("span.duration", NumericColumn("column", spans=True)),
                    ],
                    snql_aggregate=lambda args, alias: self._resolve_percentile(args, alias, 0.5),
                    result_type_fn=self.reflective_result_type(),
                    default_result_type="duration",
                    redundant_grouping=True,
                ),
                SnQLFunction(
                    "p75",
                    optional_args=[
                        with_default("span.duration", NumericColumn("column", spans=True)),
                    ],
                    snql_aggregate=lambda args, alias: self._resolve_percentile(args, alias, 0.75),
                    result_type_fn=self.reflective_result_type(),
                    default_result_type="duration",
                    redundant_grouping=True,
                ),
                SnQLFunction(
                    "p95",
                    optional_args=[
                        with_default("span.duration", NumericColumn("column", spans=True)),
                    ],
                    snql_aggregate=lambda args, alias: self._resolve_percentile(args, alias, 0.95),
                    result_type_fn=self.reflective_result_type(),
                    default_result_type="duration",
                    redundant_grouping=True,
                ),
                SnQLFunction(
                    "p99",
                    optional_args=[
                        with_default("span.duration", NumericColumn("column", spans=True)),
                    ],
                    snql_aggregate=lambda args, alias: self._resolve_percentile(args, alias, 0.99),
                    result_type_fn=self.reflective_result_type(),
                    default_result_type="duration",
                    redundant_grouping=True,
                ),
                SnQLFunction(
                    "p100",
                    optional_args=[
                        with_default("span.duration", NumericColumn("column", spans=True)),
                    ],
                    snql_aggregate=lambda args, alias: self._resolve_percentile(args, alias, 1),
                    result_type_fn=self.reflective_result_type(),
                    default_result_type="duration",
                    redundant_grouping=True,
                ),
                SnQLFunction(
                    "eps",
                    snql_aggregate=lambda args, alias: Function(
                        "divide", [Function("count", []), args["interval"]], alias
                    ),
                    optional_args=[IntervalDefault("interval", 1, None)],
                    default_result_type="number",
                ),
                SnQLFunction(
                    "epm",
                    snql_aggregate=lambda args, alias: Function(
                        "divide",
                        [Function("count", []), Function("divide", [args["interval"], 60])],
                        alias,
                    ),
                    optional_args=[IntervalDefault("interval", 1, None)],
                    default_result_type="number",
                ),
            ]
        }
        return function_converter

    @property
    def orderby_converter(self) -> Mapping[str, Callable[[Direction], OrderBy]]:
        return {}

    def _resolve_percentile(
        self,
        args: Mapping[str, Union[str, Column, SelectType, int, float]],
        alias: str,
        fixed_percentile: Optional[float] = None,
    ) -> SelectType:
        return (
            Function(
                "max",
                [args["column"]],
                alias,
            )
            if fixed_percentile == 1
            else Function(
                f'quantile({fixed_percentile if fixed_percentile is not None else args["percentile"]})',
                [args["column"]],
                alias,
            )
        )
