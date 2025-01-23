from collections.abc import Callable
from dataclasses import dataclass
from datetime import datetime
from typing import Any

from dateutil.tz import tz
from sentry_protos.snuba.v1.request_common_pb2 import TraceItemType
from sentry_protos.snuba.v1.trace_item_attribute_pb2 import (
    AttributeAggregation,
    AttributeKey,
    ExtrapolationMode,
    Function,
    VirtualColumnContext,
)

from sentry.exceptions import InvalidSearchQuery
from sentry.search.eap import constants
from sentry.search.events.types import SnubaParams


@dataclass(frozen=True, kw_only=True)
class ResolvedAttribute:
    # The alias for this column
    public_alias: (
        str  # `p95() as foo` has the public alias `foo` and `p95()` has the public alias `p95()`
    )
    # The public type for this column
    search_type: constants.SearchType
    # The internal rpc type for this column, optional as it can mostly be inferred from search_type
    internal_type: AttributeKey.Type.ValueType | None = None
    # Only for aggregates, we only support functions with 1 argument right now
    argument: AttributeKey | None = None
    # Processor is the function run in the post process step to transform a row into the final result
    processor: Callable[[Any], Any] | None = None
    # Validator to check if the value in a query is correct
    validator: Callable[[Any], bool] | None = None
    # Indicates this attribute is a secondary alias for the attribute.
    # It exists for compatibility or convenience reasons and should NOT be preferred.
    secondary_alias: bool = False

    def process_column(self, value: Any) -> Any:
        """Given the value from results, return a processed value if a processor is defined otherwise return it"""
        if self.processor:
            return self.processor(value)
        return value

    def validate(self, value: Any) -> None:
        if self.validator is not None:
            if not self.validator(value):
                raise InvalidSearchQuery(f"{value} is an invalid value for {self.public_alias}")

    @property
    def proto_type(self) -> AttributeKey.Type.ValueType:
        """The proto's AttributeKey type for this column"""
        if self.internal_type is not None:
            return self.internal_type
        else:
            return constants.TYPE_MAP[self.search_type]


@dataclass(frozen=True, kw_only=True)
class ResolvedColumn(ResolvedAttribute):
    # The internal rpc alias for this column
    internal_name: str

    @property
    def proto_definition(self) -> AttributeKey:
        """The definition of this function as needed by the RPC"""
        return AttributeKey(
            name=self.internal_name,
            type=self.proto_type,
        )


@dataclass
class ArgumentDefinition:
    argument_types: set[constants.SearchType] | None = None
    # The public alias for the default arg, the SearchResolver will resolve this value
    default_arg: str | None = None
    # Whether this argument is completely ignored, used for `count()`
    ignored: bool = False


@dataclass
class FunctionDefinition:
    internal_function: Function.ValueType
    # The list of arguments for this function
    arguments: list[ArgumentDefinition]
    # The search_type the argument should be the default type for this column
    default_search_type: constants.SearchType
    # Try to infer the search type from the function arguments
    infer_search_type_from_arguments: bool = True
    # The internal rpc type for this function, optional as it can mostly be inferred from search_type
    internal_type: AttributeKey.Type.ValueType | None = None
    # Processor is the function run in the post process step to transform a row into the final result
    processor: Callable[[Any], Any] | None = None
    # Whether to request extrapolation or not, should be true for all functions except for _sample functions for debugging
    extrapolation: bool = True

    @property
    def required_arguments(self) -> list[ArgumentDefinition]:
        return [arg for arg in self.arguments if arg.default_arg is None and not arg.ignored]


@dataclass
class VirtualColumnDefinition:
    constructor: Callable[[SnubaParams], VirtualColumnContext]
    # Allows additional processing to the term after its been resolved
    term_resolver: (
        Callable[
            [str | list[str]],
            int | str | list[int] | list[str],
        ]
        | None
    ) = None
    filter_column: str | None = None
    default_value: str | None = None


@dataclass(frozen=True, kw_only=True)
class ResolvedFunction(ResolvedAttribute):
    # The internal rpc alias for this column
    internal_name: Function.ValueType
    # Whether to enable extrapolation
    extrapolation: bool = True

    @property
    def proto_definition(self) -> AttributeAggregation:
        """The definition of this function as needed by the RPC"""
        return AttributeAggregation(
            aggregate=self.internal_name,
            key=self.argument,
            label=self.public_alias,
            extrapolation_mode=(
                ExtrapolationMode.EXTRAPOLATION_MODE_SAMPLE_WEIGHTED
                if self.extrapolation
                else ExtrapolationMode.EXTRAPOLATION_MODE_NONE
            ),
        )

    @property
    def proto_type(self) -> AttributeKey.Type.ValueType:
        """The rpc always returns functions as floats, especially count() even though it should be an integer

        see: https://www.notion.so/sentry/Should-count-return-an-int-in-the-v1-RPC-API-1348b10e4b5d80498bfdead194cc304e
        """
        return constants.DOUBLE


def simple_sentry_field(field) -> ResolvedColumn:
    """For a good number of fields, the public alias matches the internal alias
    without the `sentry.` suffix. This helper functions makes defining them easier"""
    return ResolvedColumn(public_alias=field, internal_name=f"sentry.{field}", search_type="string")


def simple_measurements_field(
    field,
    search_type: constants.SearchType = "number",
    secondary_alias: bool = False,
) -> ResolvedColumn:
    """For a good number of fields, the public alias matches the internal alias
    with the `measurements.` prefix. This helper functions makes defining them easier"""
    return ResolvedColumn(
        public_alias=f"measurements.{field}",
        internal_name=field,
        search_type=search_type,
        secondary_alias=secondary_alias,
    )


def datetime_processor(datetime_string: str) -> str:
    return datetime.fromisoformat(datetime_string).replace(tzinfo=tz.tzutc()).isoformat()


def project_context_constructor(column_name: str) -> Callable[[SnubaParams], VirtualColumnContext]:
    def context_constructor(params: SnubaParams) -> VirtualColumnContext:
        return VirtualColumnContext(
            from_column_name="sentry.project_id",
            to_column_name=column_name,
            value_map={
                str(project_id): project_name
                for project_id, project_name in params.project_id_map.items()
            },
        )

    return context_constructor


def project_term_resolver(
    raw_value: str | list[str],
) -> list[int] | int:
    if isinstance(raw_value, list):
        return [int(val) for val in raw_value]
    else:
        return int(raw_value)


@dataclass(frozen=True)
class ColumnDefinitions:
    functions: dict[str, FunctionDefinition]
    columns: dict[str, ResolvedColumn]
    contexts: dict[str, VirtualColumnDefinition]
    trace_item_type: TraceItemType.ValueType
