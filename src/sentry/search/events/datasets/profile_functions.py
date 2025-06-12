from __future__ import annotations

import uuid
from collections.abc import Callable, Mapping
from dataclasses import dataclass
from datetime import datetime
from enum import Enum

from snuba_sdk import Column as SnQLColumn
from snuba_sdk import Condition, Direction, Op, OrderBy
from snuba_sdk.function import Function, Identifier, Lambda

from sentry.api.event_search import SearchFilter
from sentry.exceptions import InvalidSearchQuery
from sentry.search.events.builder.base import BaseQueryBuilder
from sentry.search.events.constants import EQUALITY_OPERATORS, PROJECT_ALIAS, PROJECT_NAME_ALIAS
from sentry.search.events.datasets import field_aliases, filter_aliases
from sentry.search.events.datasets.base import DatasetConfig
from sentry.search.events.fields import (
    ColumnArg,
    Combinator,
    InvalidFunctionArgument,
    NumberRange,
    NumericColumn,
    SnQLFunction,
    TimestampArg,
    with_default,
)
from sentry.search.events.types import ParamsType, SelectType, WhereType


class Kind(Enum):
    DATE = "date"
    DURATION = "duration"
    INTEGER = "integer"
    NUMBER = "number"
    STRING = "string"


class Duration(Enum):
    NANOSECOND = "nanosecond"
    MICROSECOND = "microsecond"
    MILLISECOND = "millisecond"
    SECOND = "second"
    MINUTE = "minute"
    HOUR = "hour"
    DAY = "day"
    WEEK = "week"


# The only units available right now are duration based
Unit = Duration


@dataclass(frozen=True)
class Column:

    # the internal name in snuba
    column: str
    # data type associated with this column
    kind: Kind
    # the external name to expose
    alias: str | None = None
    # some kinds will have an unit associated with it
    unit: Unit | None = None


COLUMNS = [
    Column(alias="project.id", column="project_id", kind=Kind.INTEGER),
    Column(alias="project_id", column="project_id", kind=Kind.INTEGER),
    Column(alias="transaction", column="transaction_name", kind=Kind.STRING),
    Column(alias="timestamp", column="timestamp", kind=Kind.DATE),
    Column(alias="_fingerprint", column="fingerprint", kind=Kind.INTEGER),
    Column(alias="function", column="name", kind=Kind.STRING),
    Column(alias="package", column="package", kind=Kind.STRING),
    Column(alias="is_application", column="is_application", kind=Kind.INTEGER),
    Column(alias="platform.name", column="platform", kind=Kind.STRING),
    Column(alias="environment", column="environment", kind=Kind.STRING),
    Column(alias="release", column="release", kind=Kind.STRING),
    Column(
        alias="function.duration",
        column="percentiles",
        kind=Kind.DURATION,
        unit=Duration.NANOSECOND,
    ),
]

COLUMN_MAP = {column.alias: column for column in COLUMNS}

AGG_STATE_COLUMNS = [
    "count",
    "percentiles",
    "avg",
    "sum",
    "min",
    "max",
]


class ProfileFunctionColumnArg(ColumnArg):
    def normalize(self, value: str, params: ParamsType, combinator: Combinator | None) -> str:
        column = COLUMN_MAP.get(value)

        # must be a known column or field alias
        if column is None and value not in {PROJECT_ALIAS, PROJECT_NAME_ALIAS}:
            raise InvalidFunctionArgument(f"{value} is not a valid column")

        return value


class ProfileFunctionNumericColumn(NumericColumn):
    def _normalize(self, value: str) -> str:
        column = COLUMN_MAP.get(value)

        if column is None:
            raise InvalidFunctionArgument(f"{value} is not a valid column")

        if (
            column.kind == Kind.INTEGER
            or column.kind == Kind.DURATION
            or column.kind == Kind.NUMBER
        ):
            return column.column

        raise InvalidFunctionArgument(f"{value} is not a numeric column")

    def get_type(self, value: str) -> str:  # type: ignore[override]  # baseclass is unsound
        try:
            return COLUMN_MAP[value].kind.value
        except KeyError:
            return Kind.NUMBER.value


class ProfileFunctionsDatasetConfig(DatasetConfig):
    non_nullable_keys = {
        "project.id",
        "project_id",
        "transaction",
        "timestamp",
        "_fingerprint",
        "function",
        "package",
        "is_application",
        "platform.name",
    }

    def __init__(self, builder: BaseQueryBuilder):
        self.builder = builder

    @property
    def search_filter_converter(
        self,
    ) -> Mapping[str, Callable[[SearchFilter], WhereType | None]]:
        return {
            "fingerprint": self._fingerprint_filter_converter,
            "message": self._message_filter_converter,
            PROJECT_ALIAS: self._project_slug_filter_converter,
            PROJECT_NAME_ALIAS: self._project_slug_filter_converter,
        }

    def _fingerprint_filter_converter(self, search_filter: SearchFilter) -> WhereType | None:
        try:
            return Condition(
                self.builder.resolve_column("fingerprint"),
                Op.EQ if search_filter.operator in EQUALITY_OPERATORS else Op.NEQ,
                int(search_filter.value.value),
            )
        except ValueError:
            raise InvalidSearchQuery(
                "Invalid value for fingerprint condition. Accepted values are numeric."
            )

    def _message_filter_converter(self, search_filter: SearchFilter) -> WhereType | None:
        return filter_aliases.message_filter_converter(self.builder, search_filter)

    def _project_slug_filter_converter(self, search_filter: SearchFilter) -> WhereType | None:
        return filter_aliases.project_slug_converter(self.builder, search_filter)

    @property
    def field_alias_converter(self) -> Mapping[str, Callable[[str], SelectType]]:
        return {
            "fingerprint": self._resolve_fingerprint_alias,
            PROJECT_ALIAS: self._resolve_project_slug_alias,
            PROJECT_NAME_ALIAS: self._resolve_project_slug_alias,
        }

    def _resolve_fingerprint_alias(self, alias: str) -> SelectType:
        # HACK: temporarily truncate the fingerprint to 32 bits
        # as snuba cannot handle 64 bit unsigned fingerprints
        # once we migrate to a 32 bit unsigned fingerprint
        # we can remove this field alias and directly use the column
        #
        # When removing this, make sure to update the test helper to
        # generate 32 bit function fingerprints as well.
        return Function("toUInt32", [self.builder.column("_fingerprint")], alias)

    def _resolve_project_slug_alias(self, alias: str) -> SelectType:
        return field_aliases.resolve_project_slug_alias(self.builder, alias)

    @property
    def function_converter(self) -> Mapping[str, SnQLFunction]:
        return {
            function.name: function
            for function in [
                SnQLFunction(
                    "count",
                    snql_aggregate=lambda _, alias: Function(
                        "countMerge",
                        [SnQLColumn("count")],
                        alias,
                    ),
                    default_result_type="integer",
                ),
                SnQLFunction(
                    "cpm",  # calls per minute
                    snql_aggregate=lambda args, alias: self._resolve_cpm(args, alias),
                    default_result_type="number",
                ),
                SnQLFunction(
                    "cpm_before",
                    required_args=[TimestampArg("timestamp")],
                    snql_aggregate=lambda args, alias: self._resolve_cpm_cond(args, alias, "less"),
                    default_result_type="number",
                ),
                SnQLFunction(
                    "cpm_after",
                    required_args=[TimestampArg("timestamp")],
                    snql_aggregate=lambda args, alias: self._resolve_cpm_cond(
                        args, alias, "greater"
                    ),
                    default_result_type="number",
                ),
                SnQLFunction(
                    "cpm_delta",
                    required_args=[TimestampArg("timestamp")],
                    snql_aggregate=self._resolve_cpm_delta,
                    default_result_type="number",
                ),
                SnQLFunction(
                    "count_unique",
                    required_args=[ProfileFunctionColumnArg("column")],
                    snql_aggregate=lambda args, alias: Function("uniq", [args["column"]], alias),
                    default_result_type="integer",
                ),
                SnQLFunction(
                    "worst",
                    snql_aggregate=lambda _, alias: Function(
                        "replaceAll",
                        [
                            Function(
                                "toString",
                                [Function("argMaxMerge", [SnQLColumn("worst")])],
                            ),
                            "-",
                            "",
                        ],
                        alias,
                    ),
                    default_result_type="string",  # TODO: support array type
                ),
                SnQLFunction(
                    "examples",
                    snql_aggregate=lambda _, alias: Function(
                        # The worst may collide with one of the examples, so make sure to filter it out.
                        "arrayDistinct",
                        [
                            Function(
                                "arrayFilter",
                                [
                                    # Filter out the profile ids for processed profiles
                                    Lambda(
                                        ["x"],
                                        Function(
                                            "notEquals",
                                            [Identifier("x"), uuid.UUID(int=0).hex],
                                        ),
                                    ),
                                    Function(
                                        "arrayMap",
                                        [
                                            # TODO: should this transform be moved to snuba?
                                            Lambda(
                                                ["x"],
                                                Function(
                                                    "replaceAll",
                                                    [
                                                        Function("toString", [Identifier("x")]),
                                                        "-",
                                                        "",
                                                    ],
                                                ),
                                            ),
                                            Function(
                                                "arrayPushFront",
                                                [
                                                    Function(
                                                        "groupUniqArrayMerge(5)",
                                                        [SnQLColumn("examples")],
                                                    ),
                                                    Function("argMaxMerge", [SnQLColumn("worst")]),
                                                ],
                                            ),
                                        ],
                                    ),
                                ],
                            ),
                        ],
                        alias,
                    ),
                    default_result_type="string",  # TODO: support array type
                ),
                SnQLFunction(
                    "all_examples",
                    snql_aggregate=lambda _, alias: Function(
                        # The worst may collide with one of the examples, so make sure to filter it out.
                        "arrayDistinct",
                        [
                            Function(
                                "arrayFilter",
                                [
                                    # Filter out the profile ids for processed profiles
                                    Lambda(
                                        ["x"],
                                        Function(
                                            "notEquals",
                                            [
                                                Function("tupleElement", [Identifier("x"), 1]),
                                                uuid.UUID(int=0).hex,
                                            ],
                                        ),
                                    ),
                                    Function(
                                        "arrayMap",
                                        [
                                            # TODO: should this transform be moved to snuba?
                                            Lambda(
                                                ["x"],
                                                Function(
                                                    "tuple",
                                                    [
                                                        Function(
                                                            "replaceAll",
                                                            [
                                                                Function(
                                                                    "toString",
                                                                    [
                                                                        Function(
                                                                            "tupleElement",
                                                                            [Identifier("x"), 1],
                                                                        )
                                                                    ],
                                                                ),
                                                                "-",
                                                                "",
                                                            ],
                                                        ),
                                                        Function(
                                                            "tupleElement", [Identifier("x"), 2]
                                                        ),
                                                        Function(
                                                            "tupleElement", [Identifier("x"), 3]
                                                        ),
                                                        Function(
                                                            "tupleElement", [Identifier("x"), 4]
                                                        ),
                                                    ],
                                                ),
                                            ),
                                            Function(
                                                "arrayPushFront",
                                                [
                                                    Function(
                                                        "groupUniqArrayMerge(5)",
                                                        [SnQLColumn("examples_v2")],
                                                    ),
                                                    Function(
                                                        "argMaxMerge", [SnQLColumn("worst_v2")]
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
                    default_result_type="string",  # TODO: support array type
                ),
                SnQLFunction(
                    "unique_examples",
                    snql_aggregate=lambda args, alias: Function(
                        "arrayFilter",
                        [
                            # Filter out the profile ids for processed profiles
                            Lambda(
                                ["x"],
                                Function(
                                    "notEquals",
                                    [Identifier("x"), uuid.UUID(int=0).hex],
                                ),
                            ),
                            Function(
                                "arrayMap",
                                [
                                    # TODO: should this transform be moved to snuba?
                                    Lambda(
                                        ["x"],
                                        Function(
                                            "replaceAll",
                                            [Function("toString", [Identifier("x")]), "-", ""],
                                        ),
                                    ),
                                    Function("groupUniqArrayMerge(5)", [SnQLColumn("examples")]),
                                ],
                            ),
                        ],
                        alias,
                    ),
                    default_result_type="string",  # TODO: support array type
                ),
                SnQLFunction(
                    "percentile",
                    required_args=[
                        ProfileFunctionNumericColumn("column"),
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
                        with_default("function.duration", ProfileFunctionNumericColumn("column")),
                    ],
                    snql_aggregate=lambda args, alias: self._resolve_percentile(args, alias, 0.5),
                    result_type_fn=self.reflective_result_type(),
                    default_result_type="duration",
                    redundant_grouping=True,
                ),
                SnQLFunction(
                    "p75",
                    optional_args=[
                        with_default("function.duration", ProfileFunctionNumericColumn("column")),
                    ],
                    snql_aggregate=lambda args, alias: self._resolve_percentile(args, alias, 0.75),
                    result_type_fn=self.reflective_result_type(),
                    default_result_type="duration",
                    redundant_grouping=True,
                ),
                SnQLFunction(
                    "p95",
                    optional_args=[
                        with_default("function.duration", ProfileFunctionNumericColumn("column")),
                    ],
                    snql_aggregate=lambda args, alias: self._resolve_percentile(args, alias, 0.95),
                    result_type_fn=self.reflective_result_type(),
                    default_result_type="duration",
                    redundant_grouping=True,
                ),
                SnQLFunction(
                    "p99",
                    optional_args=[
                        with_default("function.duration", ProfileFunctionNumericColumn("column")),
                    ],
                    snql_aggregate=lambda args, alias: self._resolve_percentile(args, alias, 0.99),
                    result_type_fn=self.reflective_result_type(),
                    default_result_type="duration",
                    redundant_grouping=True,
                ),
                SnQLFunction(
                    "avg",
                    optional_args=[
                        with_default("function.duration", ProfileFunctionNumericColumn("column")),
                    ],
                    snql_aggregate=lambda args, alias: Function(
                        "avgMerge",
                        [SnQLColumn("avg")],
                        alias,
                    ),
                    result_type_fn=self.reflective_result_type(),
                    default_result_type="duration",
                    redundant_grouping=True,
                ),
                SnQLFunction(
                    "sum",
                    optional_args=[
                        with_default("function.duration", ProfileFunctionNumericColumn("column")),
                    ],
                    snql_aggregate=lambda args, alias: Function(
                        "sumMerge",
                        [SnQLColumn("sum")],
                        alias,
                    ),
                    result_type_fn=self.reflective_result_type(),
                    default_result_type="duration",
                    redundant_grouping=True,
                ),
                SnQLFunction(
                    "percentile_before",
                    required_args=[
                        ProfileFunctionNumericColumn("column"),
                        NumberRange("percentile", 0, 1),
                        TimestampArg("timestamp"),
                    ],
                    snql_aggregate=lambda args, alias: self._resolve_percentile_cond(
                        args, alias, "less"
                    ),
                    result_type_fn=self.reflective_result_type(),
                    default_result_type="duration",
                    redundant_grouping=True,
                ),
                SnQLFunction(
                    "percentile_after",
                    required_args=[
                        ProfileFunctionNumericColumn("column"),
                        NumberRange("percentile", 0, 1),
                        TimestampArg("timestamp"),
                    ],
                    snql_aggregate=lambda args, alias: self._resolve_percentile_cond(
                        args, alias, "greater"
                    ),
                    result_type_fn=self.reflective_result_type(),
                    default_result_type="duration",
                    redundant_grouping=True,
                ),
                SnQLFunction(
                    "percentile_delta",
                    required_args=[
                        ProfileFunctionNumericColumn("column"),
                        NumberRange("percentile", 0, 1),
                        TimestampArg("timestamp"),
                    ],
                    snql_aggregate=self._resolve_percentile_delta,
                    result_type_fn=self.reflective_result_type(),
                    default_result_type="duration",
                    redundant_grouping=True,
                ),
                SnQLFunction(
                    "regression_score",
                    required_args=[
                        ProfileFunctionNumericColumn("column"),
                        NumberRange("percentile", 0, 1),
                        TimestampArg("timestamp"),
                    ],
                    snql_aggregate=lambda args, alias: Function(
                        "minus",
                        [
                            Function(
                                "multiply",
                                [
                                    self._resolve_cpm_cond(args, None, "greater"),
                                    self._resolve_percentile_cond(args, None, "greater"),
                                ],
                            ),
                            Function(
                                "multiply",
                                [
                                    self._resolve_cpm_cond(args, None, "less"),
                                    self._resolve_percentile_cond(args, None, "less"),
                                ],
                            ),
                        ],
                        alias,
                    ),
                    default_result_type="number",
                ),
            ]
        }

    @property
    def orderby_converter(self) -> Mapping[str, OrderBy]:
        return {
            PROJECT_ALIAS: self._project_slug_orderby_converter,
            PROJECT_NAME_ALIAS: self._project_slug_orderby_converter,
        }

    def _project_slug_orderby_converter(self, direction: Direction) -> OrderBy:
        projects = self.builder.params.projects

        # Try to reduce the size of the transform by using any existing conditions on projects
        # Do not optimize projects list if conditions contain OR operator
        if not self.builder.has_or_condition and len(self.builder.projects_to_filter) > 0:
            projects = [
                project for project in projects if project.id in self.builder.projects_to_filter
            ]

        return OrderBy(
            Function(
                "transform",
                [
                    self.builder.column("project.id"),
                    [project.id for project in projects],
                    [project.slug for project in projects],
                    "",
                ],
            ),
            direction,
        )

    def resolve_column(self, column: str) -> str:
        try:
            return COLUMN_MAP[column].column
        except KeyError:
            raise InvalidSearchQuery(f"Unknown field: {column}")

    def resolve_column_type(self, column: str, units: bool = False) -> str | None:
        try:
            col = COLUMN_MAP[column]
            if col.unit:
                # if the column has an associated unit,
                # prioritize that over the kind
                return col.unit.value
            return col.kind.value
        except KeyError:
            return None

    def _resolve_percentile(
        self,
        args: Mapping[str, str | Column | SelectType | int | float],
        alias: str,
        fixed_percentile: float | None = None,
    ) -> SelectType:
        return Function(
            "arrayElement",
            [
                Function(
                    f'quantilesMerge({fixed_percentile if fixed_percentile is not None else args["percentile"]})',
                    [args["column"]],
                ),
                1,
            ],
            alias,
        )

    def _resolve_cpm(
        self,
        args: Mapping[str, str | Column | SelectType | int | float],
        alias: str | None,
    ) -> SelectType:
        assert (
            self.builder.params.end is not None and self.builder.params.start is not None
        ), f"params.end: {self.builder.params.end} - params.start: {self.builder.params.start}"
        interval = (self.builder.params.end - self.builder.params.start).total_seconds()

        return Function(
            "divide",
            [
                Function("countMerge", [SnQLColumn("count")]),
                Function("divide", [interval, 60]),
            ],
            alias,
        )

    def _resolve_cpm_cond(
        self,
        args: Mapping[str, str | Column | SelectType | int | float],
        alias: str | None,
        cond: str,
    ) -> SelectType:
        timestamp = args["timestamp"]
        if cond == "greater":
            assert isinstance(self.builder.params.end, datetime) and isinstance(
                timestamp, datetime
            ), f"params.end: {self.builder.params.end} - timestamp: {timestamp}"
            interval = (self.builder.params.end - timestamp).total_seconds()
        elif cond == "less":
            assert isinstance(self.builder.params.start, datetime) and isinstance(
                timestamp, datetime
            ), f"params.start: {self.builder.params.start} - timestamp: {timestamp}"
            interval = (timestamp - self.builder.params.start).total_seconds()
        else:
            raise InvalidSearchQuery(f"Unsupported condition for cpm: {cond}")

        return Function(
            "divide",
            [
                Function(
                    "countMergeIf",
                    [
                        SnQLColumn("count"),
                        Function(
                            cond,
                            [
                                self.builder.column("timestamp"),
                                args["timestamp"],
                            ],
                        ),
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
                self._resolve_cpm_cond(args, None, "greater"),
                self._resolve_cpm_cond(args, None, "less"),
            ],
            alias,
        )

    def _resolve_percentile_cond(
        self,
        args: Mapping[str, str | Column | SelectType | int | float],
        alias: str | None,
        cond: str,
    ) -> SelectType:
        return Function(
            "arrayElement",
            [
                Function(
                    f'quantilesMergeIf({args["percentile"]})',
                    [
                        args["column"],
                        Function(
                            cond,
                            [
                                self.builder.column("timestamp"),
                                args["timestamp"],
                            ],
                        ),
                    ],
                ),
                1,
            ],
            alias,
        )

    def _resolve_percentile_delta(
        self,
        args: Mapping[str, str | Column | SelectType | int | float],
        alias: str,
    ) -> SelectType:
        return Function(
            "minus",
            [
                self._resolve_percentile_cond(args, None, "greater"),
                self._resolve_percentile_cond(args, None, "less"),
            ],
            alias,
        )
