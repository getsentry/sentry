from __future__ import annotations

from dataclasses import dataclass
from enum import Enum
from typing import Callable, Mapping, Optional, Union

from snuba_sdk import Column as SnQLColumn
from snuba_sdk import Condition, Direction, Op, OrderBy
from snuba_sdk.function import Function, Identifier, Lambda

from sentry.api.event_search import SearchFilter
from sentry.search.events import builder
from sentry.search.events.constants import EQUALITY_OPERATORS, PROJECT_ALIAS, PROJECT_NAME_ALIAS
from sentry.search.events.datasets import field_aliases, filter_aliases
from sentry.search.events.datasets.base import DatasetConfig
from sentry.search.events.fields import (
    ColumnArg,
    Combinator,
    InvalidFunctionArgument,
    InvalidSearchQuery,
    NumberRange,
    NumericColumn,
    SnQLFunction,
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
    # type kind/type associated with this column
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
    Column(alias="fingerprint", column="fingerprint", kind=Kind.INTEGER),
    Column(alias="function", column="name", kind=Kind.STRING),
    Column(alias="package", column="package", kind=Kind.STRING),
    Column(alias="is_application", column="is_application", kind=Kind.INTEGER),
    Column(alias="platform.name", column="platform", kind=Kind.STRING),
    Column(alias="environment", column="environment", kind=Kind.STRING),
    Column(alias="release", column="release", kind=Kind.STRING),
    Column(alias="retention_days", column="retention_days", kind=Kind.INTEGER),
    Column(alias="function.duration", column="percentiles", kind=Kind.DURATION),
]

COLUMN_MAP = {column.alias: column for column in COLUMNS}


class ProfileFunctionColumnArg(ColumnArg):  # type: ignore
    def normalize(
        self, value: str, params: ParamsType, combinator: Optional[Combinator]
    ) -> NormalizedArg:
        column = COLUMN_MAP.get(value)

        # must be a known column or field alias
        if column is None and value not in {PROJECT_ALIAS, PROJECT_NAME_ALIAS}:
            raise InvalidFunctionArgument(f"{value} is not a valid column")

        return value


class ProfileFunctionNumericColumn(NumericColumn):  # type: ignore
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
        "transaction_name",
        "timestamp",
        "depth",
        "parent_fingerprint",
        "fingerprint",
        "name",
        "package",
        "path",
        "is_application",
        "platform",
        "os_name",
        "os_version",
        "retention_days",
    }

    def __init__(self, builder: builder.QueryBuilder):
        self.builder = builder

    @property
    def search_filter_converter(
        self,
    ) -> Mapping[str, Callable[[SearchFilter], Optional[WhereType]]]:
        return {
            "message": self._message_filter_converter,
            PROJECT_ALIAS: self._project_slug_filter_converter,
            PROJECT_NAME_ALIAS: self._project_slug_filter_converter,
        }

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
            PROJECT_ALIAS: self._resolve_project_slug_alias,
            PROJECT_NAME_ALIAS: self._resolve_project_slug_alias,
        }

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
                    "count_unique",
                    required_args=[ProfileFunctionColumnArg("column")],
                    snql_aggregate=lambda args, alias: Function("uniq", [args["column"]], alias),
                    default_result_type="integer",
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
                    "percentiles",
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
