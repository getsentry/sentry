from __future__ import annotations

from dataclasses import dataclass
from enum import Enum
from typing import Callable, Mapping, Optional, Union

from snuba_sdk import Condition, Direction, Op, OrderBy

from sentry.api.event_search import SearchFilter
from sentry.search.events import builder
from sentry.search.events.constants import EQUALITY_OPERATORS, PROJECT_ALIAS, PROJECT_NAME_ALIAS
from sentry.search.events.datasets import field_aliases, filter_aliases
from sentry.search.events.datasets.base import DatasetConfig
from sentry.search.events.fields import (
    ColumnArg,
    Combinator,
    Function,
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
    # the external name to expose
    alias: str
    # the internal name in snuba
    column: str
    # type kind/type associated with this column
    kind: Kind
    # some kinds will have an unit associated with it
    unit: Optional[Unit] = None


COLUMNS = [
    Column(alias="organization.id", column="organization_id", kind=Kind.INTEGER),
    Column(alias="project.id", column="project_id", kind=Kind.INTEGER),
    Column(alias="trace.transaction", column="transaction_id", kind=Kind.STRING),
    Column(alias="id", column="profile_id", kind=Kind.STRING),
    Column(alias="profile.id", column="profile_id", kind=Kind.STRING),
    Column(alias="timestamp", column="received", kind=Kind.DATE),
    Column(alias="device.arch", column="architecture", kind=Kind.STRING),
    Column(alias="device.classification", column="device_classification", kind=Kind.STRING),
    Column(alias="device.locale", column="device_locale", kind=Kind.STRING),
    Column(alias="device.manufacturer", column="device_manufacturer", kind=Kind.STRING),
    Column(alias="device.model", column="device_model", kind=Kind.STRING),
    Column(alias="os.build", column="device_os_build_number", kind=Kind.STRING),
    Column(alias="os.name", column="device_os_name", kind=Kind.STRING),
    Column(alias="os.version", column="device_os_version", kind=Kind.STRING),
    Column(
        alias="profile.duration",
        column="duration_ns",
        kind=Kind.DURATION,
        unit=Duration.NANOSECOND,
    ),
    Column(
        alias="transaction.duration",
        column="duration_ns",
        kind=Kind.DURATION,
        unit=Duration.NANOSECOND,
    ),
    Column(alias="environment", column="environment", kind=Kind.STRING),
    Column(alias="platform.name", column="platform", kind=Kind.STRING),
    Column(alias="trace", column="trace_id", kind=Kind.STRING),
    Column(alias="transaction", column="transaction_name", kind=Kind.STRING),
    # There is a `version_code` column that exists for
    # legacy profiles, we've decided not to support that.
    Column(alias="release", column="version_name", kind=Kind.STRING),
    # We want to alias `project_id` to the column as well
    # because the query builder uses that internally
    Column(alias="project_id", column="project_id", kind=Kind.INTEGER),
    # Snuba adds a time column for the dataset that rounds the timestamp.
    # The exact rounding depends on the granularity in the query.
    Column(alias="time", column="time", kind=Kind.DATE),
    Column(alias="message", column="transaction_name", kind=Kind.STRING),
]

COLUMN_MAP = {column.alias: column for column in COLUMNS}


class ProfileColumnArg(ColumnArg):  # type: ignore
    def normalize(
        self, value: str, params: ParamsType, combinator: Optional[Combinator]
    ) -> NormalizedArg:
        column = COLUMN_MAP.get(value)

        # must be a known column or field alias
        if column is None and value not in {PROJECT_ALIAS, PROJECT_NAME_ALIAS}:
            raise InvalidFunctionArgument(f"{value} is not a valid column")

        return value


class ProfileNumericColumn(NumericColumn):  # type: ignore
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


class ProfilesDatasetConfig(DatasetConfig):
    non_nullable_keys = {
        "organization.id",
        "project.id",
        "trace.transaction",
        "id",
        "timestamp",
        "device.arch",
        "device.classification",
        "device.locale",
        "device.manufacturer",
        "device.model",
        "os.name",
        "os.version",
        "profile.duration",
        "platform.name",
        "trace",
        "transaction",
        "release",
        "project_id",
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
                # TODO: A lot of this is duplicated from the discover dataset.
                # Ideally, we refactor it to be shared across datasets.
                SnQLFunction(
                    "last_seen",
                    snql_aggregate=lambda _, alias: Function(
                        "max",
                        [self.builder.column("timestamp")],
                        alias,
                    ),
                    default_result_type="date",
                    redundant_grouping=True,
                ),
                SnQLFunction(
                    "latest_event",
                    snql_aggregate=lambda _, alias: Function(
                        "argMax",
                        [self.builder.column("id"), self.builder.column("timestamp")],
                        alias,
                    ),
                    default_result_type="string",
                ),
                SnQLFunction(
                    "count",
                    snql_aggregate=lambda _, alias: Function(
                        "count",
                        [],
                        alias,
                    ),
                    default_result_type="integer",
                ),
                SnQLFunction(
                    "count_unique",
                    required_args=[ProfileColumnArg("column")],
                    snql_aggregate=lambda args, alias: Function("uniq", [args["column"]], alias),
                    default_result_type="integer",
                ),
                SnQLFunction(
                    "percentile",
                    required_args=[
                        ProfileNumericColumn("column"),
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
                        with_default("profile.duration", ProfileNumericColumn("column")),
                    ],
                    snql_aggregate=lambda args, alias: self._resolve_percentile(args, alias, 0.5),
                    result_type_fn=self.reflective_result_type(),
                    default_result_type="duration",
                    redundant_grouping=True,
                ),
                SnQLFunction(
                    "p75",
                    optional_args=[
                        with_default("profile.duration", ProfileNumericColumn("column")),
                    ],
                    snql_aggregate=lambda args, alias: self._resolve_percentile(args, alias, 0.75),
                    result_type_fn=self.reflective_result_type(),
                    default_result_type="duration",
                    redundant_grouping=True,
                ),
                SnQLFunction(
                    "p95",
                    optional_args=[
                        with_default("profile.duration", ProfileNumericColumn("column")),
                    ],
                    snql_aggregate=lambda args, alias: self._resolve_percentile(args, alias, 0.95),
                    result_type_fn=self.reflective_result_type(),
                    default_result_type="duration",
                    redundant_grouping=True,
                ),
                SnQLFunction(
                    "p99",
                    optional_args=[
                        with_default("profile.duration", ProfileNumericColumn("column")),
                    ],
                    snql_aggregate=lambda args, alias: self._resolve_percentile(args, alias, 0.99),
                    result_type_fn=self.reflective_result_type(),
                    default_result_type="duration",
                    redundant_grouping=True,
                ),
                SnQLFunction(
                    "p100",
                    optional_args=[
                        with_default("profile.duration", ProfileNumericColumn("column")),
                    ],
                    snql_aggregate=lambda args, alias: self._resolve_percentile(args, alias, 1),
                    result_type_fn=self.reflective_result_type(),
                    default_result_type="duration",
                    redundant_grouping=True,
                ),
                SnQLFunction(
                    "min",
                    required_args=[ProfileNumericColumn("column")],
                    snql_aggregate=lambda args, alias: Function("min", [args["column"]], alias),
                    result_type_fn=self.reflective_result_type(),
                    default_result_type="duration",
                    redundant_grouping=True,
                ),
                SnQLFunction(
                    "max",
                    required_args=[ProfileNumericColumn("column")],
                    snql_aggregate=lambda args, alias: Function("max", [args["column"]], alias),
                    result_type_fn=self.reflective_result_type(),
                    default_result_type="duration",
                    redundant_grouping=True,
                ),
                SnQLFunction(
                    "avg",
                    required_args=[ProfileNumericColumn("column")],
                    snql_aggregate=lambda args, alias: Function("avg", [args["column"]], alias),
                    result_type_fn=self.reflective_result_type(),
                    default_result_type="duration",
                    redundant_grouping=True,
                ),
                SnQLFunction(
                    "sum",
                    required_args=[ProfileNumericColumn("column")],
                    snql_aggregate=lambda args, alias: Function("sum", [args["column"]], alias),
                    result_type_fn=self.reflective_result_type(),
                    default_result_type="duration",
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
