from __future__ import annotations

from dataclasses import dataclass
from enum import Enum
from typing import Callable, Mapping, Optional, Union

from snuba_sdk import Column as SnQLColumn
from snuba_sdk import Condition, Direction, Op, OrderBy
from snuba_sdk.function import Function, Identifier, Lambda

from sentry.api.event_search import SearchFilter
from sentry.exceptions import InvalidSearchQuery
from sentry.search.events import builder
from sentry.search.events.constants import EQUALITY_OPERATORS, PROJECT_ALIAS, PROJECT_NAME_ALIAS
from sentry.search.events.datasets import field_aliases, filter_aliases
from sentry.search.events.datasets.base import DatasetConfig
from sentry.search.events.fields import (
    ColumnArg,
    Combinator,
    IntArg,
    InvalidFunctionArgument,
    NumberRange,
    NumericColumn,
    SnQLFunction,
    TimestampArg,
    with_default,
)
from sentry.search.events.types import NormalizedArg, ParamsType, SelectType, WhereType


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
    alias: Optional[str] = None
    # some kinds will have an unit associated with it
    unit: Optional[Unit] = None


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
    def normalize(
        self, value: str, params: ParamsType, combinator: Optional[Combinator]
    ) -> NormalizedArg:
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

    def get_type(self, value: str) -> str:
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

    def __init__(self, builder: builder.QueryBuilder):
        self.builder = builder

    @property
    def search_filter_converter(
        self,
    ) -> Mapping[str, Callable[[SearchFilter], Optional[WhereType]]]:
        return {
            "fingerprint": self._fingerprint_filter_converter,
            "message": self._message_filter_converter,
            PROJECT_ALIAS: self._project_slug_filter_converter,
            PROJECT_NAME_ALIAS: self._project_slug_filter_converter,
        }

    def _fingerprint_filter_converter(self, search_filter: SearchFilter) -> Optional[WhereType]:
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

    def _message_filter_converter(self, search_filter: SearchFilter) -> Optional[WhereType]:
        value = search_filter.value.value
        if search_filter.value.is_wildcard():
            # XXX: We don't want the '^$' values at the beginning and end of
            # the regex since we want to find the pattern anywhere in the
            # message. Strip off here
            value = search_filter.value.value[1:-1]
            return Condition(
                Function("match", [self.builder.column("message"), f"(?i){value}"]),
                Op(search_filter.operator),
                1,
            )
        elif value == "":
            operator = Op.EQ if search_filter.operator == "=" else Op.NEQ
            return Condition(
                Function("equals", [self.builder.column("message"), value]), operator, 1
            )
        else:
            if search_filter.is_in_filter:
                return Condition(
                    self.builder.column("message"),
                    Op(search_filter.operator),
                    value,
                )

            # make message search case insensitive
            return Condition(
                Function("positionCaseInsensitive", [self.builder.column("message"), value]),
                Op.NEQ if search_filter.operator in EQUALITY_OPERATORS else Op.EQ,
                0,
            )

    def _project_slug_filter_converter(self, search_filter: SearchFilter) -> Optional[WhereType]:
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
                        "arrayMap",
                        [
                            # TODO: should this transform be moved to snuba?
                            Lambda(
                                ["x"],
                                Function(
                                    "replaceAll", [Function("toString", [Identifier("x")]), "-", ""]
                                ),
                            ),
                            Function(
                                "arrayPushFront",
                                [
                                    Function("groupUniqArrayMerge(5)", [SnQLColumn("examples")]),
                                    Function("argMaxMerge", [SnQLColumn("worst")]),
                                ],
                            ),
                        ],
                        alias,
                    ),
                    default_result_type="string",  # TODO: support array type
                ),
                SnQLFunction(
                    "unique_examples",
                    optional_args=[
                        with_default(5, IntArg("count", negative=False)),
                    ],
                    snql_aggregate=lambda args, alias: Function(
                        "arrayMap",
                        [
                            # TODO: should this transform be moved to snuba?
                            Lambda(
                                ["x"],
                                Function(
                                    "replaceAll", [Function("toString", [Identifier("x")]), "-", ""]
                                ),
                            ),
                            Function(
                                f"groupUniqArrayMerge({args['count']})", [SnQLColumn("examples")]
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

    def resolve_column_type(self, column: str, units: bool = False) -> Optional[str]:
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
        args: Mapping[str, Union[str, Column, SelectType, int, float]],
        alias: str,
        fixed_percentile: Optional[float] = None,
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
        args: Mapping[str, Union[str, Column, SelectType, int, float]],
        alias: str | None,
    ) -> SelectType:
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
        args: Mapping[str, Union[str, Column, SelectType, int, float]],
        alias: str | None,
        cond: str,
    ) -> SelectType:
        if cond == "greater":
            interval = (self.builder.params.end - args["timestamp"]).total_seconds()
        elif cond == "less":
            interval = (args["timestamp"] - self.builder.params.start).total_seconds()
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
        args: Mapping[str, Union[str, Column, SelectType, int, float]],
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
        args: Mapping[str, Union[str, Column, SelectType, int, float]],
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
        args: Mapping[str, Union[str, Column, SelectType, int, float]],
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
