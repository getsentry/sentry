from __future__ import annotations

from typing import Callable, Mapping, Optional, Union

from snuba_sdk import Column, Direction, Function, OrderBy

from sentry.api.event_search import SearchFilter
from sentry.exceptions import InvalidSearchQuery
from sentry.search.events import builder, constants
from sentry.search.events.datasets import field_aliases, filter_aliases
from sentry.search.events.datasets.base import DatasetConfig
from sentry.search.events.fields import (
    ColumnTagArg,
    IntervalDefault,
    NullableNumberRange,
    NullColumn,
    NumberRange,
    NumericColumn,
    SnQLFieldColumn,
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
        return {
            constants.PROJECT_ALIAS: self._project_slug_filter_converter,
            constants.PROJECT_NAME_ALIAS: self._project_slug_filter_converter,
            constants.DEVICE_CLASS_ALIAS: lambda search_filter: filter_aliases.device_class_converter(
                self.builder, search_filter
            ),
            constants.SPAN_IS_SEGMENT_ALIAS: filter_aliases.span_is_segment_converter,
        }

    @property
    def field_alias_converter(self) -> Mapping[str, Callable[[str], SelectType]]:
        return {
            constants.PROJECT_ALIAS: self._resolve_project_slug_alias,
            constants.PROJECT_NAME_ALIAS: self._resolve_project_slug_alias,
            constants.SPAN_MODULE_ALIAS: self._resolve_span_module,
            constants.DEVICE_CLASS_ALIAS: lambda alias: field_aliases.resolve_device_class(
                self.builder, alias
            ),
        }

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
                    "avg",
                    optional_args=[
                        with_default("span.duration", NumericColumn("column", spans=True)),
                    ],
                    snql_aggregate=lambda args, alias: Function("avg", [args["column"]], alias),
                    result_type_fn=self.reflective_result_type(),
                    default_result_type="duration",
                    redundant_grouping=True,
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
                    "bounded_sample",
                    required_args=[
                        NumericColumn("column", spans=True),
                        NumberRange("min", None, None),
                    ],
                    optional_args=[with_default(None, NullableNumberRange("max", None, None))],
                    snql_aggregate=self._resolve_bounded_sample,
                    default_result_type="string",
                ),
                SnQLFunction(
                    "rounded_time",
                    optional_args=[with_default(3, NumberRange("intervals", None, None))],
                    snql_column=self._resolve_rounded_time,
                    default_result_type="integer",
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
                    default_result_type="rate",
                ),
                SnQLFunction(
                    "epm",
                    snql_aggregate=lambda args, alias: Function(
                        "divide",
                        [Function("count", []), Function("divide", [args["interval"], 60])],
                        alias,
                    ),
                    optional_args=[IntervalDefault("interval", 1, None)],
                    default_result_type="rate",
                ),
                SnQLFunction(
                    "any",
                    required_args=[SnQLFieldColumn("column")],
                    # Not actually using `any` so that this function returns consistent results
                    snql_aggregate=lambda args, alias: Function("min", [args["column"]], alias),
                    result_type_fn=self.reflective_result_type(),
                    redundant_grouping=True,
                ),
            ]
        }

        for alias, name in constants.SPAN_FUNCTION_ALIASES.items():
            if name in function_converter:
                function_converter[alias] = function_converter[name].alias_as(alias)

        return function_converter

    @property
    def orderby_converter(self) -> Mapping[str, Callable[[Direction], OrderBy]]:
        return {}

    def _project_slug_filter_converter(self, search_filter: SearchFilter) -> Optional[WhereType]:
        return filter_aliases.project_slug_converter(self.builder, search_filter)

    def _resolve_project_slug_alias(self, alias: str) -> SelectType:
        return field_aliases.resolve_project_slug_alias(self.builder, alias)

    def _resolve_span_module(self, alias: str) -> SelectType:
        return field_aliases.resolve_span_module(self.builder, alias)

    def _resolve_bounded_sample(
        self,
        args: Mapping[str, Union[str, Column, SelectType, int, float]],
        alias: str,
    ) -> SelectType:
        base_condition = Function(
            "and",
            [
                Function("greaterOrEquals", [args["column"], args["min"]]),
                Function(
                    "greater",
                    [
                        Function(
                            "position",
                            [
                                Function("toString", [Column("span_id")]),
                                Function(
                                    "substring",
                                    [Function("toString", [Function("rand", [])]), 1, 2],
                                ),
                            ],
                        ),
                        0,
                    ],
                ),
            ],
        )
        if args["max"] is not None:
            condition = Function(
                "and", [base_condition, Function("less", [args["column"], args["max"]])]
            )
        else:
            condition = base_condition

        return Function("minIf", [self.builder.column("id"), condition], alias)

    def _resolve_rounded_time(
        self,
        args: Mapping[str, Union[str, Column, SelectType, int, float]],
        alias: str,
    ) -> SelectType:
        start, end = self.builder.start, self.builder.end
        intervals = args["intervals"]
        if start is None or end is None:
            raise InvalidSearchQuery("Need start and end to use rounded_time column")
        if not isinstance(intervals, (int, float)):
            raise InvalidSearchQuery("intervals must be a number")

        return Function(
            "floor",
            [
                Function(
                    "divide",
                    [
                        Function("minus", [end, self.builder.column("timestamp")]),
                        ((end - start) / intervals).total_seconds(),
                    ],
                )
            ],
            alias,
        )

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
