from __future__ import annotations

from collections.abc import Callable, Mapping

from django.utils.functional import cached_property
from snuba_sdk import Column, Direction, Function, OrderBy

from sentry import options
from sentry.api.event_search import SearchFilter
from sentry.exceptions import InvalidSearchQuery
from sentry.search.events import constants
from sentry.search.events.builder import spans_indexed
from sentry.search.events.builder.base import BaseQueryBuilder
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
    SnQLStringArg,
    with_default,
)
from sentry.search.events.types import SelectType, WhereType
from sentry.search.utils import DEVICE_CLASS
from sentry.snuba.referrer import Referrer


class SpansIndexedDatasetConfig(DatasetConfig):
    optimize_wildcard_searches = True
    subscriptables_with_index = {"tags"}
    non_nullable_keys = {"id", "span_id", "trace", "trace_id"}

    def __init__(self, builder: BaseQueryBuilder):
        self.builder = builder
        self.total_count: int | None = None
        self.total_sum_transaction_duration: float | None = None

    @property
    def search_filter_converter(
        self,
    ) -> Mapping[str, Callable[[SearchFilter], WhereType | None]]:
        return {
            "message": self._message_filter_converter,
            constants.PROJECT_ALIAS: self._project_slug_filter_converter,
            constants.PROJECT_NAME_ALIAS: self._project_slug_filter_converter,
            constants.DEVICE_CLASS_ALIAS: self._device_class_filter_converter,
            constants.SPAN_IS_SEGMENT_ALIAS: filter_aliases.span_is_segment_converter,
            constants.SPAN_OP: lambda search_filter: filter_aliases.lowercase_search(
                self.builder, search_filter
            ),
            constants.SPAN_MODULE_ALIAS: lambda search_filter: filter_aliases.span_module_filter_converter(
                self.builder, search_filter
            ),
            constants.SPAN_STATUS: lambda search_filter: filter_aliases.span_status_filter_converter(
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
    def function_converter(self) -> dict[str, SnQLFunction]:
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
                    "p90",
                    optional_args=[
                        with_default("span.duration", NumericColumn("column", spans=True)),
                    ],
                    snql_aggregate=lambda args, alias: self._resolve_percentile(args, alias, 0.90),
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
                    snql_aggregate=lambda args, alias: function_aliases.resolve_eps(
                        args, alias, self.builder
                    ),
                    optional_args=[IntervalDefault("interval", 1, None)],
                    default_result_type="rate",
                ),
                SnQLFunction(
                    "epm",
                    snql_aggregate=lambda args, alias: function_aliases.resolve_epm(
                        args, alias, self.builder
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

    def _message_filter_converter(self, search_filter: SearchFilter) -> WhereType | None:
        return filter_aliases.message_filter_converter(self.builder, search_filter)

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
        args: Mapping[str, str | SelectType | int | float],
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
        args: Mapping[str, str | SelectType | int | float],
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
        args: Mapping[str, str | SelectType | int | float],
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
        args: Mapping[str, str | SelectType | int | float],
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


class SpansEAPDatasetConfig(SpansIndexedDatasetConfig):
    """Eventually should just write the eap dataset from scratch, but inheriting for now to move fast"""

    sampling_weight = Column("sampling_weight")
    _cached_count = None
    _cached_count_weighted = None

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
        duration = Column("duration_ms")
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

    def _resolve_aggregate_if(
        self, aggregate: str
    ) -> Callable[[Mapping[str, str | SelectType | int | float], str | None], SelectType]:
        def resolve_aggregate_if(
            args: Mapping[str, str | SelectType | int | float],
            alias: str | None = None,
        ) -> SelectType:
            attr = extract_attr(args["column"])

            # If we're not aggregating on an attr column,
            # we can directly aggregate on the column
            if attr is None:
                return Function(
                    f"{aggregate}",
                    [args["column"]],
                    alias,
                )

            # When aggregating on an attr column, we have to make sure that we skip rows
            # where the attr does not exist.
            attr_col, attr_name = attr

            function = (
                aggregate.replace("quantile", "quantileTDigestIf")
                if aggregate.startswith("quantile(")
                else f"{aggregate}If"
            )

            return Function(
                function,
                [
                    args["column"],
                    Function("mapContains", [attr_col, attr_name]),
                ],
                alias,
            )

        return resolve_aggregate_if

    @property
    def function_converter(self) -> dict[str, SnQLFunction]:
        function_converter = {
            function.name: function
            for function in [
                SnQLFunction(
                    "eps",
                    snql_aggregate=lambda args, alias: function_aliases.resolve_eps(
                        args, alias, self.builder
                    ),
                    optional_args=[IntervalDefault("interval", 1, None)],
                    default_result_type="rate",
                ),
                SnQLFunction(
                    "epm",
                    snql_aggregate=lambda args, alias: function_aliases.resolve_epm(
                        args, alias, self.builder
                    ),
                    optional_args=[IntervalDefault("interval", 1, None)],
                    default_result_type="rate",
                ),
                SnQLFunction(
                    "count",
                    optional_args=[
                        with_default("span.duration", NumericColumn("column", spans=True)),
                    ],
                    snql_aggregate=self._resolve_aggregate_if("count"),
                    default_result_type="integer",
                ),
                SnQLFunction(
                    "count_unique",
                    required_args=[ColumnTagArg("column")],
                    snql_aggregate=self._resolve_aggregate_if("uniq"),
                    default_result_type="integer",
                ),
                SnQLFunction(
                    "sum",
                    required_args=[NumericColumn("column", spans=True)],
                    snql_aggregate=self._resolve_aggregate_if("sum"),
                    result_type_fn=self.reflective_result_type(),
                    default_result_type="duration",
                ),
                SnQLFunction(
                    "avg",
                    optional_args=[
                        with_default("span.duration", NumericColumn("column", spans=True)),
                    ],
                    snql_aggregate=self._resolve_aggregate_if("avg"),
                    result_type_fn=self.reflective_result_type(),
                    default_result_type="duration",
                    redundant_grouping=True,
                ),
                SnQLFunction(
                    "p50",
                    optional_args=[
                        with_default("span.duration", NumericColumn("column", spans=True)),
                    ],
                    snql_aggregate=self._resolve_aggregate_if("quantile(0.5)"),
                    result_type_fn=self.reflective_result_type(),
                    default_result_type="duration",
                    redundant_grouping=True,
                ),
                SnQLFunction(
                    "p75",
                    optional_args=[
                        with_default("span.duration", NumericColumn("column", spans=True)),
                    ],
                    snql_aggregate=self._resolve_aggregate_if("quantile(0.75)"),
                    result_type_fn=self.reflective_result_type(),
                    default_result_type="duration",
                    redundant_grouping=True,
                ),
                SnQLFunction(
                    "p90",
                    optional_args=[
                        with_default("span.duration", NumericColumn("column", spans=True)),
                    ],
                    snql_aggregate=self._resolve_aggregate_if("quantile(0.90)"),
                    result_type_fn=self.reflective_result_type(),
                    default_result_type="duration",
                    redundant_grouping=True,
                ),
                SnQLFunction(
                    "p95",
                    optional_args=[
                        with_default("span.duration", NumericColumn("column", spans=True)),
                    ],
                    snql_aggregate=self._resolve_aggregate_if("quantile(0.95)"),
                    result_type_fn=self.reflective_result_type(),
                    default_result_type="duration",
                    redundant_grouping=True,
                ),
                SnQLFunction(
                    "p99",
                    optional_args=[
                        with_default("span.duration", NumericColumn("column", spans=True)),
                    ],
                    snql_aggregate=self._resolve_aggregate_if("quantile(0.99)"),
                    result_type_fn=self.reflective_result_type(),
                    default_result_type="duration",
                    redundant_grouping=True,
                ),
                SnQLFunction(
                    "p100",
                    optional_args=[
                        with_default("span.duration", NumericColumn("column", spans=True)),
                    ],
                    snql_aggregate=self._resolve_aggregate_if("max"),
                    result_type_fn=self.reflective_result_type(),
                    default_result_type="duration",
                    redundant_grouping=True,
                ),
                SnQLFunction(
                    "min",
                    required_args=[NumericColumn("column", spans=True)],
                    snql_aggregate=self._resolve_aggregate_if("min"),
                    result_type_fn=self.reflective_result_type(),
                    default_result_type="duration",
                    redundant_grouping=True,
                ),
                SnQLFunction(
                    "max",
                    required_args=[NumericColumn("column", spans=True)],
                    snql_aggregate=self._resolve_aggregate_if("max"),
                    result_type_fn=self.reflective_result_type(),
                    default_result_type="duration",
                    redundant_grouping=True,
                ),
                SnQLFunction(
                    "count_weighted",
                    optional_args=[
                        with_default("span.duration", NumericColumn("column", spans=True)),
                    ],
                    snql_aggregate=self._resolve_count_weighted,
                    default_result_type="integer",
                ),
                SnQLFunction(
                    "count_unique_weighted",
                    required_args=[ColumnTagArg("column")],
                    snql_aggregate=self._resolve_aggregate_if("uniq"),
                    default_result_type="integer",
                ),
                SnQLFunction(
                    "sum_weighted",
                    required_args=[NumericColumn("column", spans=True)],
                    result_type_fn=self.reflective_result_type(),
                    snql_aggregate=lambda args, alias: self._resolve_sum_weighted(args, alias),
                    default_result_type="duration",
                ),
                SnQLFunction(
                    "avg_weighted",
                    required_args=[NumericColumn("column", spans=True)],
                    result_type_fn=self.reflective_result_type(),
                    snql_aggregate=lambda args, alias: Function(
                        "divide",
                        [
                            self._resolve_sum_weighted(args),
                            self._resolve_count_weighted(args),
                        ],
                        alias,
                    ),
                    default_result_type="duration",
                ),
                SnQLFunction(
                    "percentile_weighted",
                    required_args=[
                        NumericColumn("column", spans=True),
                        NumberRange("percentile", 0, 1),
                    ],
                    snql_aggregate=self._resolve_percentile_weighted,
                    result_type_fn=self.reflective_result_type(),
                    default_result_type="duration",
                    redundant_grouping=True,
                ),
                SnQLFunction(
                    "p50_weighted",
                    optional_args=[
                        with_default("span.duration", NumericColumn("column", spans=True)),
                    ],
                    snql_aggregate=lambda args, alias: self._resolve_percentile_weighted(
                        args, alias, 0.5
                    ),
                    result_type_fn=self.reflective_result_type(),
                    default_result_type="duration",
                    redundant_grouping=True,
                ),
                SnQLFunction(
                    "p75_weighted",
                    optional_args=[
                        with_default("span.duration", NumericColumn("column", spans=True)),
                    ],
                    snql_aggregate=lambda args, alias: self._resolve_percentile_weighted(
                        args, alias, 0.75
                    ),
                    result_type_fn=self.reflective_result_type(),
                    default_result_type="duration",
                    redundant_grouping=True,
                ),
                SnQLFunction(
                    "p90_weighted",
                    optional_args=[
                        with_default("span.duration", NumericColumn("column", spans=True)),
                    ],
                    snql_aggregate=lambda args, alias: self._resolve_percentile_weighted(
                        args, alias, 0.90
                    ),
                    result_type_fn=self.reflective_result_type(),
                    default_result_type="duration",
                    redundant_grouping=True,
                ),
                SnQLFunction(
                    "p95_weighted",
                    optional_args=[
                        with_default("span.duration", NumericColumn("column", spans=True)),
                    ],
                    snql_aggregate=lambda args, alias: self._resolve_percentile_weighted(
                        args, alias, 0.95
                    ),
                    result_type_fn=self.reflective_result_type(),
                    default_result_type="duration",
                    redundant_grouping=True,
                ),
                SnQLFunction(
                    "p99_weighted",
                    optional_args=[
                        with_default("span.duration", NumericColumn("column", spans=True)),
                    ],
                    snql_aggregate=lambda args, alias: self._resolve_percentile_weighted(
                        args, alias, 0.99
                    ),
                    result_type_fn=self.reflective_result_type(),
                    default_result_type="duration",
                    redundant_grouping=True,
                ),
                SnQLFunction(
                    "p100_weighted",
                    optional_args=[
                        with_default("span.duration", NumericColumn("column", spans=True)),
                    ],
                    snql_aggregate=lambda args, alias: self._resolve_percentile_weighted(
                        args, alias, 1.0
                    ),
                    result_type_fn=self.reflective_result_type(),
                    default_result_type="duration",
                    redundant_grouping=True,
                ),
                # Min and Max are identical to their existing implementations
                SnQLFunction(
                    "min_weighted",
                    required_args=[NumericColumn("column", spans=True)],
                    snql_aggregate=self._resolve_aggregate_if("min"),
                    result_type_fn=self.reflective_result_type(),
                    default_result_type="duration",
                    redundant_grouping=True,
                ),
                SnQLFunction(
                    "max_weighted",
                    required_args=[NumericColumn("column", spans=True)],
                    snql_aggregate=self._resolve_aggregate_if("max"),
                    result_type_fn=self.reflective_result_type(),
                    default_result_type="duration",
                    redundant_grouping=True,
                ),
                SnQLFunction(
                    "margin_of_error",
                    optional_args=[with_default("fpc", SnQLStringArg("fpc"))],
                    snql_aggregate=self._resolve_margin_of_error,
                    default_result_type="number",
                ),
                SnQLFunction(
                    "lower_count_limit",
                    optional_args=[with_default("fpc", SnQLStringArg("fpc"))],
                    snql_aggregate=self._resolve_lower_limit,
                    default_result_type="number",
                ),
                SnQLFunction(
                    "upper_count_limit",
                    optional_args=[with_default("fpc", SnQLStringArg("fpc"))],
                    snql_aggregate=self._resolve_upper_limit,
                    default_result_type="number",
                ),
                SnQLFunction(
                    "first_seen",
                    snql_aggregate=lambda args, alias: Function(
                        "toUnixTimestamp64Milli",
                        [Function("min", [Column("start_timestamp")])],
                        alias,
                    ),
                    default_result_type="duration",
                    private=True,
                ),
                SnQLFunction(
                    "last_seen",
                    snql_aggregate=lambda args, alias: Function(
                        "toUnixTimestamp64Milli",
                        [Function("max", [Column("end_timestamp")])],
                        alias,
                    ),
                    default_result_type="duration",
                    private=True,
                ),
            ]
        }

        for alias, name in constants.SPAN_FUNCTION_ALIASES.items():
            if name in function_converter:
                function_converter[alias] = function_converter[name].alias_as(alias)

        return function_converter

    @property
    def field_alias_converter(self) -> Mapping[str, Callable[[str], SelectType]]:
        existing_field_aliases: dict[str, Callable[[str], SelectType]] = {
            **super().field_alias_converter
        }

        field_alias_converter: Mapping[str, Callable[[str], SelectType]] = {
            constants.PRECISE_START_TS: lambda alias: Function(
                "divide",
                [
                    Function("toUnixTimestamp64Milli", [Column("start_timestamp")]),
                    1000,
                ],
                alias,
            ),
            constants.PRECISE_FINISH_TS: lambda alias: Function(
                "divide",
                [
                    Function("toUnixTimestamp64Milli", [Column("end_timestamp")]),
                    1000,
                ],
                alias,
            ),
        }
        existing_field_aliases.update(field_alias_converter)
        return existing_field_aliases

    def _resolve_sum_weighted(
        self,
        args: Mapping[str, str | SelectType | int | float],
        alias: str | None = None,
    ) -> SelectType:
        attr = extract_attr(args["column"])

        # If we're not aggregating on an attr column,
        # we can directly aggregate on the column
        if attr is None:
            return Function(
                "sum",
                [
                    Function(
                        "multiply",
                        [
                            Column("sign"),
                            Function("multiply", [args["column"], self.sampling_weight]),
                        ],
                    )
                ],
                alias,
            )

        # When aggregating on an attr column, we have to make sure that we skip rows
        # where the attr does not exist.
        attr_col, attr_name = attr

        return Function(
            "sumIf",
            [
                Function(
                    "multiply",
                    [
                        Column("sign"),
                        Function("multiply", [args["column"], self.sampling_weight]),
                    ],
                ),
                Function("mapContains", [attr_col, attr_name]),
            ],
            alias,
        )

    def _resolve_count_weighted(
        self,
        args: Mapping[str, str | SelectType | int | float],
        alias: str | None = None,
    ) -> SelectType:
        attr = extract_attr(args["column"])

        # If we're not aggregating on an attr column,
        # we can directly aggregate on the column
        if attr is None:
            return Function(
                "round",
                [
                    Function(
                        "sum",
                        [Function("multiply", [Column("sign"), self.sampling_weight])],
                    )
                ],
                alias,
            )

        # When aggregating on an attr column, we have to make sure that we skip rows
        # where the attr does not exist.
        attr_col, attr_name = attr

        return Function(
            "round",
            [
                Function(
                    "sumIf",
                    [
                        Function("multiply", [Column("sign"), self.sampling_weight]),
                        Function("mapContains", [attr_col, attr_name]),
                    ],
                )
            ],
            alias,
        )

    def _resolve_percentile_weighted(
        self,
        args: Mapping[str, str | SelectType | int | float],
        alias: str,
        fixed_percentile: float | None = None,
    ) -> SelectType:
        attr = extract_attr(args["column"])

        # If we're not aggregating on an attr column,
        # we can directly aggregate on the column
        if attr is None:
            return Function(
                f'quantileTDigestWeighted({fixed_percentile if fixed_percentile is not None else args["percentile"]})',
                # Only convert to UInt64 when we have to since we lose rounding accuracy
                [args["column"], Function("toUInt64", [self.sampling_weight])],
                alias,
            )

        # When aggregating on an attr column, we have to make sure that we skip rows
        # where the attr does not exist.
        attr_col, attr_name = attr

        return Function(
            f'quantileTDigestWeightedIf({fixed_percentile if fixed_percentile is not None else args["percentile"]})',
            # Only convert to UInt64 when we have to since we lose rounding accuracy
            [
                args["column"],
                Function("toUInt64", [self.sampling_weight]),
                Function("mapContains", [attr_col, attr_name]),
            ],
            alias,
        )

    def _query_total_counts(self) -> tuple[float | int, float | int]:
        if self._cached_count is None:
            total_query = spans_indexed.SpansEAPQueryBuilder(
                dataset=self.builder.dataset,
                params={},
                snuba_params=self.builder.params,
                selected_columns=["count()", "count_weighted()"],
            )
            total_results = total_query.run_query(Referrer.API_SPANS_TOTAL_COUNT_FIELD.value)
            results = total_query.process_results(total_results)
            if len(results["data"]) != 1:
                raise Exception("Could not query population size")
            self._cached_count = results["data"][0]["count"]
            self._cached_count_weighted = results["data"][0]["count_weighted"]
        return self._cached_count, self._cached_count_weighted

    @cached_property
    def _zscore(self):
        """Defaults to 1.96, based on a z score for a confidence level of 95%"""
        return options.get("performance.extrapolation.confidence.z-score")

    def _resolve_margin_of_error(
        self,
        args: Mapping[str, str | SelectType | int | float],
        alias: str | None = None,
    ) -> SelectType:
        """Calculates the Margin of error for a given value, but unfortunately basis the total count based on
        extrapolated data
        Z * Margin Of Error * Finite Population Correction
        """
        # both of these need to be aggregated without a query
        total_samples, population_size = self._query_total_counts()
        sampled_group = Function("count", [])
        return Function(
            "multiply",
            [
                self._zscore,
                Function(
                    "multiply",
                    [
                        # Unadjusted Margin of Error
                        self._resolve_unadjusted_margin(sampled_group, total_samples),
                        # Finite Population Correction
                        self._resolve_finite_population_correction(
                            args, total_samples, population_size
                        ),
                    ],
                ),
            ],
            alias,
        )

    def _resolve_unadjusted_margin(
        self, sampled_group: SelectType, total_samples: SelectType
    ) -> SelectType:
        """sqrt((p(1 - p)) / (total_samples))"""
        # Naming this p to match the formula
        p = Function("divide", [sampled_group, total_samples])
        return Function(
            "sqrt",
            [
                Function(
                    "divide", [Function("multiply", [p, Function("minus", [1, p])]), total_samples]
                )
            ],
        )

    def _resolve_finite_population_correction(
        self,
        args: Mapping[str, str | SelectType | int | float],
        total_samples: SelectType,
        population_size: int | float,
    ) -> SelectType:
        """sqrt((population_size - total_samples) / (population_size - 1))"""
        return (
            Function(
                "sqrt",
                [
                    Function(
                        "divide",
                        [
                            Function("minus", [population_size, total_samples]),
                            Function("minus", [population_size, 1]),
                        ],
                    )
                ],
            )
            # if the arg is anything but `fpc` just return 1 so we're not correcting for a finite population
            if args["fpc"] == "fpc"
            else 1
        )

    def _resolve_lower_limit(
        self,
        args: Mapping[str, str | SelectType | int | float],
        alias: str,
    ) -> SelectType:
        """round(max(0, proportion_by_sample - margin_of_error) * total_population)"""
        _, total_population = self._query_total_counts()
        sampled_group = Function("count", [])
        proportion_by_sample = Function(
            "divide",
            [
                sampled_group,
                Function(
                    "multiply", [total_population, Function("avg", [Column("sampling_factor")])]
                ),
            ],
            "proportion_by_sample",
        )
        return Function(
            "round",
            [
                Function(
                    "multiply",
                    [
                        Function(
                            "arrayMax",
                            [
                                [
                                    0,
                                    Function(
                                        "minus",
                                        [
                                            proportion_by_sample,
                                            self._resolve_margin_of_error(args, "margin_of_error"),
                                        ],
                                    ),
                                ]
                            ],
                        ),
                        total_population,
                    ],
                )
            ],
            alias,
        )

    def _resolve_upper_limit(
        self,
        args: Mapping[str, str | SelectType | int | float],
        alias: str,
    ) -> SelectType:
        """round(max(0, proportion_by_sample + margin_of_error) * total_population)"""
        _, total_population = self._query_total_counts()
        sampled_group = Function("count", [])
        proportion_by_sample = Function(
            "divide",
            [
                sampled_group,
                Function(
                    "multiply", [total_population, Function("avg", [Column("sampling_factor")])]
                ),
            ],
            "proportion_by_sample",
        )
        return Function(
            "round",
            [
                Function(
                    "multiply",
                    [
                        Function(
                            "plus",
                            [
                                proportion_by_sample,
                                self._resolve_margin_of_error(args, "margin_of_error"),
                            ],
                        ),
                        total_population,
                    ],
                )
            ],
            alias,
        )


def extract_attr(
    column: str | SelectType | int | float,
) -> tuple[Column, str] | None:
    if isinstance(column, Column) and column.subscriptable in {"attr_str", "attr_num"}:
        return Column(column.subscriptable), column.key
    return None
