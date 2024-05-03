from __future__ import annotations

from collections.abc import Callable, Mapping

from snuba_sdk import Column, Direction, Function, OrderBy

from sentry.api.event_search import SearchFilter
from sentry.exceptions import InvalidSearchQuery
from sentry.search.events import builder, constants
from sentry.search.events.datasets import field_aliases, filter_aliases, function_aliases
from sentry.search.events.datasets.base import DatasetConfig
from sentry.search.events.fields import (
    ColumnArg,
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
from sentry.search.utils import DEVICE_CLASS


class SpansIndexedDatasetConfig(DatasetConfig):
    def __init__(self, builder: builder.QueryBuilder):
        self.builder = builder
        self.total_count: int | None = None
        self.total_sum_transaction_duration: float | None = None

    @property
    def search_filter_converter(
        self,
    ) -> Mapping[str, Callable[[SearchFilter], WhereType | None]]:
        return {
            constants.PROJECT_ALIAS: self._project_slug_filter_converter,
            constants.PROJECT_NAME_ALIAS: self._project_slug_filter_converter,
            constants.DEVICE_CLASS_ALIAS: self._device_class_filter_converter,
            constants.SPAN_IS_SEGMENT_ALIAS: filter_aliases.span_is_segment_converter,
            constants.SPAN_OP: lambda search_filter: filter_aliases.lowercase_search(
                self.builder, search_filter
            ),
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
            "span.duration": self._resolve_span_duration,
            constants.PRECISE_FINISH_TS: lambda alias: field_aliases.resolve_precise_timestamp(
                Column("end_timestamp"), Column("end_ms"), alias
            ),
            constants.PRECISE_START_TS: lambda alias: field_aliases.resolve_precise_timestamp(
                Column("start_timestamp"), Column("start_ms"), alias
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
                SnQLFunction(  # deprecated in favour of `example()`
                    "bounded_sample",
                    required_args=[
                        NumericColumn("column", spans=True),
                        NumberRange("min", None, None),
                    ],
                    optional_args=[with_default(None, NullableNumberRange("max", None, None))],
                    snql_aggregate=self._resolve_bounded_sample,
                    default_result_type="string",
                ),
                SnQLFunction(  # deprecated in favour of `rounded_timestamp(...)`
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
                SnQLFunction(
                    "examples",
                    required_args=[NumericColumn("column", spans=True)],
                    optional_args=[with_default(1, NumberRange("count", 1, None))],
                    snql_aggregate=self._resolve_random_samples,
                    private=True,
                ),
                SnQLFunction(
                    "rounded_timestamp",
                    required_args=[IntervalDefault("interval", 1, None)],
                    snql_column=lambda args, alias: function_aliases.resolve_rounded_timestamp(
                        args["interval"], alias
                    ),
                    private=True,
                ),
                SnQLFunction(
                    "min",
                    required_args=[NumericColumn("column", spans=True)],
                    snql_aggregate=lambda args, alias: Function("min", [args["column"]], alias),
                    result_type_fn=self.reflective_result_type(),
                    default_result_type="duration",
                    redundant_grouping=True,
                ),
                SnQLFunction(
                    "max",
                    required_args=[NumericColumn("column", spans=True)],
                    snql_aggregate=lambda args, alias: Function("max", [args["column"]], alias),
                    result_type_fn=self.reflective_result_type(),
                    default_result_type="duration",
                    redundant_grouping=True,
                ),
                SnQLFunction(
                    "trace_name",
                    snql_aggregate=lambda args, alias: Function(
                        "anyIf",
                        [
                            Column("segment_name"),
                            Function(
                                "or",
                                [
                                    Function("isNull", [Column("parent_span_id")]),
                                    Function("equals", [Column("parent_span_id"), "00"]),
                                ],
                            ),
                        ],
                        alias,
                    ),
                    default_result_type="string",
                    private=True,
                ),
                SnQLFunction(
                    "first_seen",
                    snql_aggregate=lambda args, alias: Function(
                        "plus",
                        [
                            Function(
                                "multiply",
                                [
                                    Function(
                                        "toUInt64",
                                        [
                                            self._resolve_partial_timestamp_column(
                                                "min",
                                                "start_timestamp",
                                                "start_ms",
                                                1,
                                            ),
                                        ],
                                    ),
                                    1000,
                                ],
                            ),
                            self._resolve_partial_timestamp_column(
                                "min",
                                "start_timestamp",
                                "start_ms",
                                2,
                            ),
                        ],
                        alias,
                    ),
                    default_result_type="duration",
                    private=True,
                ),
                SnQLFunction(
                    "last_seen",
                    snql_aggregate=lambda args, alias: Function(
                        "plus",
                        [
                            Function(
                                "multiply",
                                [
                                    Function(
                                        "toUInt64",
                                        [
                                            self._resolve_partial_timestamp_column(
                                                "max",
                                                "end_timestamp",
                                                "end_ms",
                                                1,
                                            ),
                                        ],
                                    ),
                                    1000,
                                ],
                            ),
                            self._resolve_partial_timestamp_column(
                                "max",
                                "end_timestamp",
                                "end_ms",
                                2,
                            ),
                        ],
                        alias,
                    ),
                    default_result_type="duration",
                    private=True,
                ),
                SnQLFunction(
                    "array_join",
                    required_args=[ColumnArg("column", allowed_columns=["tags.key"])],
                    snql_column=lambda args, alias: Function("arrayJoin", [args["column"]], alias),
                    default_result_type="string",
                    private=True,
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

    def _project_slug_filter_converter(self, search_filter: SearchFilter) -> WhereType | None:
        return filter_aliases.project_slug_converter(self.builder, search_filter)

    def _device_class_filter_converter(self, search_filter: SearchFilter) -> SelectType:
        return filter_aliases.device_class_converter(
            self.builder, search_filter, {**DEVICE_CLASS, "Unknown": {""}}
        )

    def _resolve_project_slug_alias(self, alias: str) -> SelectType:
        return field_aliases.resolve_project_slug_alias(self.builder, alias)

    def _resolve_span_module(self, alias: str) -> SelectType:
        return field_aliases.resolve_span_module(self.builder, alias)

    def _resolve_span_duration(self, alias: str) -> SelectType:
        # In ClickHouse, duration is an UInt32 whereas self time is a Float64.
        # This creates a situation where a sub-millisecond duration is truncated
        # to but the self time is not.
        #
        # To remedy this, we take the greater of the duration and self time as
        # this is the only situation where the self time can be greater than
        # the duration.
        #
        # Also avoids strange situations on the frontend where duration is less
        # than the self time.
        duration = Column("duration")
        self_time = self.builder.column("span.self_time")
        return Function(
            "if",
            [
                Function("greater", [self_time, duration]),
                self_time,
                duration,
            ],
            alias,
        )

    def _resolve_bounded_sample(
        self,
        args: Mapping[str, str | Column | SelectType | int | float],
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
        args: Mapping[str, str | Column | SelectType | int | float],
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
        args: Mapping[str, str | Column | SelectType | int | float],
        alias: str,
        fixed_percentile: float | None = None,
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

    def _resolve_random_samples(
        self,
        args: Mapping[str, str | Column | SelectType | int | float],
        alias: str,
    ) -> SelectType:
        offset = 0 if self.builder.offset is None else self.builder.offset.offset
        limit = 0 if self.builder.limit is None else self.builder.limit.limit
        return function_aliases.resolve_random_samples(
            [
                # DO NOT change the order of these columns as it
                # changes the order of the tuple in the response
                # which WILL cause errors where it assumes this
                # order
                self.builder.resolve_column("span.group"),
                self.builder.resolve_column("timestamp"),
                self.builder.resolve_column("id"),
                args["column"],
            ],
            alias,
            offset,
            limit,
            size=int(args["count"]),
        )

    def _resolve_partial_timestamp_column(
        self, aggregate: str, timestamp_column: str, ms_column: str, index: int
    ) -> SelectType:
        return Function(
            "tupleElement",
            [
                Function(
                    aggregate,
                    [
                        Function(
                            "tuple",
                            [Column(timestamp_column), Column(ms_column)],
                        ),
                    ],
                ),
                index,
            ],
        )
