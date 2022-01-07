from dataclasses import dataclass
from typing import Callable, Mapping, Optional, Union

from sentry_relay.consts import SPAN_STATUS_NAME_TO_CODE
from snuba_sdk.column import Column
from snuba_sdk.function import Function

from sentry.search.events.types import SelectType
from sentry.snuba.dataset import Dataset
from sentry.utils.snuba import resolve_column

from .fields import (
    ColumnArg,
    ColumnTagArg,
    ConditionArg,
    FunctionAliasArg,
    IntervalDefault,
    NullableNumberRange,
    NullColumn,
    NumberRange,
    NumericColumn,
    SnQLArrayCombinator,
    SnQLDateArg,
    SnQLFieldColumn,
    SnQLFunction,
    SnQLStringArg,
    StringArrayColumn,
    normalize_count_if_value,
    normalize_percentile_alias,
    reflective_result_type,
    with_default,
)


@dataclass
class DatasetConfig:
    """
    Dataset-specific configuration that is passed to
    the QueryBuilder
    """

    dataset: Dataset
    function_converter: Mapping[str, SnQLFunction]
    field_alias_converter: Mapping[str, Callable[[str], SelectType]]


def _resolve_percentile(
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


def column(dataset: Dataset, name: str) -> Column:
    resolve_column_name = resolve_column(dataset)
    resolved_column = resolve_column_name(name)
    return Column(resolved_column)


def discover_column(name: str) -> Column:
    return column(Dataset.Discover, name)


DISCOVER_DATASET_CONFIG = DatasetConfig(
    dataset=Dataset.Discover,
    function_converter={
        function.name: function
        for function in [
            SnQLFunction(
                "failure_count",
                snql_aggregate=lambda _, alias: Function(
                    "countIf",
                    [
                        Function(
                            "notIn",
                            [
                                column("transaction.status"),
                                (
                                    SPAN_STATUS_NAME_TO_CODE["ok"],
                                    SPAN_STATUS_NAME_TO_CODE["cancelled"],
                                    SPAN_STATUS_NAME_TO_CODE["unknown"],
                                ),
                            ],
                        )
                    ],
                    alias,
                ),
                default_result_type="integer",
            ),
            SnQLFunction(
                "apdex",
                optional_args=[NullableNumberRange("satisfaction", 0, None)],
                snql_aggregate=self._resolve_apdex_function,
                default_result_type="number",
            ),
            SnQLFunction(
                "count_miserable",
                required_args=[ColumnTagArg("column")],
                optional_args=[NullableNumberRange("satisfaction", 0, None)],
                calculated_args=[
                    {
                        "name": "tolerated",
                        "fn": lambda args: args["satisfaction"] * 4.0
                        if args["satisfaction"] is not None
                        else None,
                    }
                ],
                snql_aggregate=self._resolve_count_miserable_function,
                default_result_type="integer",
            ),
            SnQLFunction(
                "user_misery",
                # To correct for sensitivity to low counts, User Misery is modeled as a Beta Distribution Function.
                # With prior expectations, we have picked the expected mean user misery to be 0.05 and variance
                # to be 0.0004. This allows us to calculate the alpha (5.8875) and beta (111.8625) parameters,
                # with the user misery being adjusted for each fast/slow unique transaction. See:
                # https://stats.stackexchange.com/questions/47771/what-is-the-intuition-behind-beta-distribution
                # for an intuitive explanation of the Beta Distribution Function.
                optional_args=[
                    NullableNumberRange("satisfaction", 0, None),
                    with_default(5.8875, NumberRange("alpha", 0, None)),
                    with_default(111.8625, NumberRange("beta", 0, None)),
                ],
                calculated_args=[
                    {
                        "name": "tolerated",
                        "fn": lambda args: args["satisfaction"] * 4.0
                        if args["satisfaction"] is not None
                        else None,
                    },
                    {"name": "parameter_sum", "fn": lambda args: args["alpha"] + args["beta"]},
                ],
                snql_aggregate=self._resolve_user_misery_function,
                default_result_type="number",
            ),
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
                "last_seen",
                snql_aggregate=lambda _, alias: Function(
                    "max",
                    [discover_column("timestamp")],
                    alias,
                ),
                default_result_type="date",
                redundant_grouping=True,
            ),
            SnQLFunction(
                "latest_event",
                snql_aggregate=lambda _, alias: Function(
                    "argMax",
                    [discover_column("id"), discover_column("timestamp")],
                    alias,
                ),
                default_result_type="string",
            ),
            SnQLFunction(
                "failure_rate",
                snql_aggregate=lambda _, alias: Function(
                    "failure_rate",
                    [],
                    alias,
                ),
                default_result_type="percentage",
            ),
            SnQLFunction(
                "percentile",
                required_args=[
                    NumericColumn("column"),
                    NumberRange("percentile", 0, 1),
                ],
                snql_aggregate=_resolve_percentile,
                result_type_fn=reflective_result_type(),
                default_result_type="duration",
                redundant_grouping=True,
                combinators=[SnQLArrayCombinator("column", NumericColumn.numeric_array_columns)],
            ),
            SnQLFunction(
                "p50",
                optional_args=[
                    with_default("transaction.duration", NumericColumn("column")),
                ],
                snql_aggregate=lambda args, alias: _resolve_percentile(args, alias, 0.5),
                result_type_fn=reflective_result_type(),
                default_result_type="duration",
                redundant_grouping=True,
            ),
            SnQLFunction(
                "p75",
                optional_args=[
                    with_default("transaction.duration", NumericColumn("column")),
                ],
                snql_aggregate=lambda args, alias: _resolve_percentile(args, alias, 0.75),
                result_type_fn=reflective_result_type(),
                default_result_type="duration",
                redundant_grouping=True,
            ),
            SnQLFunction(
                "p95",
                optional_args=[
                    with_default("transaction.duration", NumericColumn("column")),
                ],
                snql_aggregate=lambda args, alias: _resolve_percentile(args, alias, 0.95),
                result_type_fn=reflective_result_type(),
                default_result_type="duration",
                redundant_grouping=True,
            ),
            SnQLFunction(
                "p99",
                optional_args=[
                    with_default("transaction.duration", NumericColumn("column")),
                ],
                snql_aggregate=lambda args, alias: _resolve_percentile(args, alias, 0.99),
                result_type_fn=reflective_result_type(),
                default_result_type="duration",
                redundant_grouping=True,
            ),
            SnQLFunction(
                "p100",
                optional_args=[
                    with_default("transaction.duration", NumericColumn("column")),
                ],
                snql_aggregate=lambda args, alias: _resolve_percentile(args, alias, 1),
                result_type_fn=reflective_result_type(),
                default_result_type="duration",
                redundant_grouping=True,
            ),
            SnQLFunction(
                "to_other",
                required_args=[
                    ColumnArg("column", allowed_columns=["release", "trace.parent_span"]),
                    SnQLStringArg("value", unquote=True, unescape_quotes=True),
                ],
                optional_args=[
                    with_default("that", SnQLStringArg("that")),
                    with_default("this", SnQLStringArg("this")),
                ],
                snql_column=lambda args, alias: Function(
                    "if",
                    [
                        Function("equals", [args["column"], args["value"]]),
                        args["this"],
                        args["that"],
                    ],
                    alias,
                ),
            ),
            SnQLFunction(
                "percentile_range",
                required_args=[
                    NumericColumn("column"),
                    NumberRange("percentile", 0, 1),
                    ConditionArg("condition"),
                    SnQLDateArg("middle"),
                ],
                snql_aggregate=lambda args, alias: Function(
                    f"quantileIf({args['percentile']:.2f})",
                    [
                        args["column"],
                        # This condition is written in this seemingly backwards way because of limitations
                        # in the json query syntax.
                        # TODO(snql-migration): Once the trends endpoint is using snql, we should update it
                        # and flip these conditions back
                        Function(
                            args["condition"],
                            [
                                Function("toDateTime", [args["middle"]]),
                                discover_column("timestamp"),
                            ],
                        ),
                    ],
                    alias,
                ),
                default_result_type="duration",
            ),
            SnQLFunction(
                "avg_range",
                required_args=[
                    NumericColumn("column"),
                    ConditionArg("condition"),
                    SnQLDateArg("middle"),
                ],
                snql_aggregate=lambda args, alias: Function(
                    "avgIf",
                    [
                        args["column"],
                        # see `percentile_range` for why this condition feels backwards
                        Function(
                            args["condition"],
                            [
                                Function("toDateTime", [args["middle"]]),
                                discover_column("timestamp"),
                            ],
                        ),
                    ],
                    alias,
                ),
                default_result_type="duration",
            ),
            SnQLFunction(
                "variance_range",
                required_args=[
                    NumericColumn("column"),
                    ConditionArg("condition"),
                    SnQLDateArg("middle"),
                ],
                snql_aggregate=lambda args, alias: Function(
                    "varSampIf",
                    [
                        args["column"],
                        # see `percentile_range` for why this condition feels backwards
                        Function(
                            args["condition"],
                            [
                                Function("toDateTime", [args["middle"]]),
                                discover_column("timestamp"),
                            ],
                        ),
                    ],
                    alias,
                ),
                default_result_type="duration",
            ),
            SnQLFunction(
                "count_range",
                required_args=[ConditionArg("condition"), SnQLDateArg("middle")],
                snql_aggregate=lambda args, alias: Function(
                    "countIf",
                    [
                        # see `percentile_range` for why this condition feels backwards
                        Function(
                            args["condition"],
                            [
                                Function("toDateTime", [args["middle"]]),
                                discover_column("timestamp"),
                            ],
                        ),
                    ],
                    alias,
                ),
                default_result_type="integer",
            ),
            SnQLFunction(
                "count_if",
                required_args=[
                    ColumnTagArg("column"),
                    ConditionArg("condition"),
                    SnQLStringArg(
                        "value", unquote=True, unescape_quotes=True, optional_unquote=True
                    ),
                ],
                calculated_args=[
                    {
                        "name": "typed_value",
                        "fn": normalize_count_if_value,
                    }
                ],
                snql_aggregate=lambda args, alias: Function(
                    "countIf",
                    [
                        Function(
                            args["condition"],
                            [
                                args["column"],
                                args["typed_value"],
                            ],
                        )
                    ],
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
                "count_at_least",
                required_args=[NumericColumn("column"), NumberRange("threshold", 0, None)],
                snql_aggregate=lambda args, alias: Function(
                    "countIf",
                    [Function("greaterOrEquals", [args["column"], args["threshold"]])],
                    alias,
                ),
                default_result_type="integer",
            ),
            SnQLFunction(
                "min",
                required_args=[NumericColumn("column")],
                snql_aggregate=lambda args, alias: Function("min", [args["column"]], alias),
                result_type_fn=reflective_result_type(),
                default_result_type="duration",
                redundant_grouping=True,
            ),
            SnQLFunction(
                "max",
                required_args=[NumericColumn("column")],
                snql_aggregate=lambda args, alias: Function("max", [args["column"]], alias),
                result_type_fn=reflective_result_type(),
                default_result_type="duration",
                redundant_grouping=True,
                combinators=[SnQLArrayCombinator("column", NumericColumn.numeric_array_columns)],
            ),
            SnQLFunction(
                "avg",
                required_args=[NumericColumn("column")],
                snql_aggregate=lambda args, alias: Function("avg", [args["column"]], alias),
                result_type_fn=reflective_result_type(),
                default_result_type="duration",
                redundant_grouping=True,
            ),
            SnQLFunction(
                "var",
                required_args=[NumericColumn("column")],
                snql_aggregate=lambda args, alias: Function("varSamp", [args["column"]], alias),
                default_result_type="number",
                redundant_grouping=True,
            ),
            SnQLFunction(
                "stddev",
                required_args=[NumericColumn("column")],
                snql_aggregate=lambda args, alias: Function("stddevSamp", [args["column"]], alias),
                default_result_type="number",
                redundant_grouping=True,
            ),
            SnQLFunction(
                "cov",
                required_args=[NumericColumn("column1"), NumericColumn("column2")],
                snql_aggregate=lambda args, alias: Function(
                    "covarSamp", [args["column1"], args["column2"]], alias
                ),
                default_result_type="number",
                redundant_grouping=True,
            ),
            SnQLFunction(
                "corr",
                required_args=[NumericColumn("column1"), NumericColumn("column2")],
                snql_aggregate=lambda args, alias: Function(
                    "corr", [args["column1"], args["column2"]], alias
                ),
                default_result_type="number",
                redundant_grouping=True,
            ),
            SnQLFunction(
                "sum",
                required_args=[NumericColumn("column")],
                snql_aggregate=lambda args, alias: Function("sum", [args["column"]], alias),
                result_type_fn=reflective_result_type(),
                default_result_type="duration",
                combinators=[SnQLArrayCombinator("column", NumericColumn.numeric_array_columns)],
            ),
            SnQLFunction(
                "any",
                required_args=[SnQLFieldColumn("column")],
                # Not actually using `any` so that this function returns consistent results
                snql_aggregate=lambda args, alias: Function("min", [args["column"]], alias),
                result_type_fn=reflective_result_type(),
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
            SnQLFunction(
                "compare_numeric_aggregate",
                required_args=[
                    FunctionAliasArg("aggregate_alias"),
                    ConditionArg("condition"),
                    NumberRange("value", 0, None),
                ],
                calculated_args=[
                    {
                        "name": "aggregate_function",
                        "fn": normalize_percentile_alias,
                    }
                ],
                snql_aggregate=lambda args, alias: Function(
                    args["condition"],
                    [self.resolve_function(args["aggregate_function"]), args["value"]],
                    alias,
                ),
                default_result_type="number",
            ),
            SnQLFunction(
                "array_join",
                required_args=[StringArrayColumn("column")],
                snql_column=lambda args, alias: Function("arrayJoin", [args["column"]], alias),
                default_result_type="string",
                private=True,
            ),
            SnQLFunction(
                "absolute_correlation",
                snql_aggregate=lambda _, alias: Function(
                    "abs",
                    [
                        Function(
                            "corr",
                            [
                                Function("toUnixTimestamp", [discover_column("timestamp")]),
                                discover_column("transaction.duration"),
                            ],
                        ),
                    ],
                    alias,
                ),
                default_result_type="number",
            ),
            SnQLFunction(
                "histogram",
                required_args=[
                    NumericColumn("column", allow_array_value=True),
                    # the bucket_size and start_offset should already be adjusted
                    # using the multiplier before it is passed here
                    NumberRange("bucket_size", 0, None),
                    NumberRange("start_offset", 0, None),
                    NumberRange("multiplier", 1, None),
                ],
                # floor((x * multiplier - start_offset) / bucket_size) * bucket_size + start_offset
                snql_column=lambda args, alias: Function(
                    "plus",
                    [
                        Function(
                            "multiply",
                            [
                                Function(
                                    "floor",
                                    [
                                        Function(
                                            "divide",
                                            [
                                                Function(
                                                    "minus",
                                                    [
                                                        Function(
                                                            "multiply",
                                                            [
                                                                args["column"],
                                                                args["multiplier"],
                                                            ],
                                                        ),
                                                        args["start_offset"],
                                                    ],
                                                ),
                                                args["bucket_size"],
                                            ],
                                        ),
                                    ],
                                ),
                                args["bucket_size"],
                            ],
                        ),
                        args["start_offset"],
                    ],
                    alias,
                ),
                default_result_type="number",
                private=True,
            ),
        ]
    },
)
