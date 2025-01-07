from collections.abc import Callable
from dataclasses import dataclass
from datetime import datetime
from typing import Any, Literal

from dateutil.tz import tz
from sentry_protos.snuba.v1.trace_item_attribute_pb2 import (
    AttributeAggregation,
    AttributeKey,
    ExtrapolationMode,
    Function,
    VirtualColumnContext,
)

from sentry.exceptions import InvalidSearchQuery
from sentry.search.eap import constants
from sentry.search.events.constants import SPAN_MODULE_CATEGORY_VALUES
from sentry.search.events.types import SnubaParams
from sentry.search.utils import DEVICE_CLASS
from sentry.utils.validators import is_event_id, is_span_id


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
    argument_types: list[constants.SearchType] | None = None
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
        return constants.FLOAT


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


SPAN_COLUMN_DEFINITIONS = {
    column.public_alias: column
    for column in [
        ResolvedColumn(
            public_alias="id",
            internal_name="sentry.span_id",
            search_type="string",
            validator=is_span_id,
        ),
        ResolvedColumn(
            public_alias="parent_span",
            internal_name="sentry.parent_span_id",
            search_type="string",
            validator=is_span_id,
        ),
        ResolvedColumn(
            public_alias="organization.id",
            internal_name="sentry.organization_id",
            search_type="string",
        ),
        ResolvedColumn(
            public_alias="project.id",
            internal_name="sentry.project_id",
            internal_type=constants.INT,
            search_type="string",
        ),
        ResolvedColumn(
            public_alias="project_id",
            internal_name="sentry.project_id",
            internal_type=constants.INT,
            search_type="string",
            secondary_alias=True,
        ),
        ResolvedColumn(
            public_alias="span.action",
            internal_name="sentry.action",
            search_type="string",
        ),
        ResolvedColumn(
            public_alias="span.description",
            internal_name="sentry.name",
            search_type="string",
        ),
        ResolvedColumn(
            public_alias="description",
            internal_name="sentry.name",
            search_type="string",
            secondary_alias=True,
        ),
        # Message maps to description, this is to allow wildcard searching
        ResolvedColumn(
            public_alias="message",
            internal_name="sentry.name",
            search_type="string",
            secondary_alias=True,
        ),
        ResolvedColumn(
            public_alias="span.domain",
            internal_name="sentry.domain",
            search_type="string",
        ),
        ResolvedColumn(
            public_alias="span.group",
            internal_name="sentry.group",
            search_type="string",
        ),
        ResolvedColumn(
            public_alias="span.op",
            internal_name="sentry.op",
            search_type="string",
        ),
        ResolvedColumn(
            public_alias="span.category",
            internal_name="sentry.category",
            search_type="string",
        ),
        ResolvedColumn(
            public_alias="span.self_time",
            internal_name="sentry.exclusive_time_ms",
            search_type="millisecond",
        ),
        ResolvedColumn(
            public_alias="span.duration",
            internal_name="sentry.duration_ms",
            search_type="millisecond",
        ),
        ResolvedColumn(
            public_alias="span.status",
            internal_name="sentry.status",
            search_type="string",
        ),
        ResolvedColumn(
            public_alias="span.status_code",
            internal_name="sentry.status_code",
            search_type="string",
        ),
        ResolvedColumn(
            public_alias="trace",
            internal_name="sentry.trace_id",
            search_type="string",
            validator=is_event_id,
        ),
        ResolvedColumn(
            public_alias="transaction",
            internal_name="sentry.segment_name",
            search_type="string",
        ),
        ResolvedColumn(
            public_alias="transaction.span_id",
            internal_name="sentry.segment_id",
            search_type="string",
        ),
        ResolvedColumn(
            public_alias="profile.id",
            internal_name="sentry.profile_id",
            search_type="string",
        ),
        ResolvedColumn(
            public_alias="replay.id",
            internal_name="sentry.replay_id",
            search_type="string",
        ),
        ResolvedColumn(
            public_alias="span.ai.pipeline.group",
            internal_name="sentry.ai_pipeline_group",
            search_type="string",
        ),
        ResolvedColumn(
            public_alias="ai.total_tokens.used",
            internal_name="ai_total_tokens_used",
            search_type="number",
        ),
        ResolvedColumn(
            public_alias="ai.total_cost",
            internal_name="ai.total_cost",
            search_type="number",
        ),
        ResolvedColumn(
            public_alias="http.decoded_response_content_length",
            internal_name="http.decoded_response_content_length",
            search_type="byte",
        ),
        ResolvedColumn(
            public_alias="http.response_content_length",
            internal_name="http.response_content_length",
            search_type="byte",
        ),
        ResolvedColumn(
            public_alias="http.response_transfer_size",
            internal_name="http.response_transfer_size",
            search_type="byte",
        ),
        ResolvedColumn(
            public_alias="sampling_rate",
            internal_name="sentry.sampling_factor",
            search_type="percentage",
        ),
        ResolvedColumn(
            public_alias="timestamp",
            internal_name="sentry.timestamp",
            search_type="string",
            processor=datetime_processor,
        ),
        ResolvedColumn(
            public_alias="mobile.frames_delay",
            internal_name="frames.delay",
            search_type="second",
        ),
        ResolvedColumn(
            public_alias="mobile.frames_slow",
            internal_name="frames.slow",
            search_type="number",
        ),
        ResolvedColumn(
            public_alias="mobile.frames_frozen",
            internal_name="frames.frozen",
            search_type="number",
        ),
        ResolvedColumn(
            public_alias="mobile.frames_total",
            internal_name="frames.total",
            search_type="number",
        ),
        # These fields are extracted from span measurements but were accessed
        # 2 ways, with + without the measurements. prefix. So expose both for compatibility.
        simple_measurements_field("cache.item_size", secondary_alias=True),
        ResolvedColumn(
            public_alias="cache.item_size",
            internal_name="cache.item_size",
            search_type="byte",
        ),
        simple_measurements_field("messaging.message.body.size", secondary_alias=True),
        ResolvedColumn(
            public_alias="messaging.message.body.size",
            internal_name="messaging.message.body.size",
            search_type="byte",
        ),
        simple_measurements_field("messaging.message.receive.latency", secondary_alias=True),
        ResolvedColumn(
            public_alias="messaging.message.receive.latency",
            internal_name="messaging.message.receive.latency",
            search_type="millisecond",
        ),
        simple_measurements_field("messaging.message.retry.count", secondary_alias=True),
        ResolvedColumn(
            public_alias="messaging.message.retry.count",
            internal_name="messaging.message.retry.count",
            search_type="number",
        ),
        simple_sentry_field("browser.name"),
        simple_sentry_field("environment"),
        simple_sentry_field("messaging.destination.name"),
        simple_sentry_field("messaging.message.id"),
        simple_sentry_field("platform"),
        simple_sentry_field("raw_domain"),
        simple_sentry_field("release"),
        simple_sentry_field("sdk.name"),
        simple_sentry_field("sdk.version"),
        simple_sentry_field("span_id"),
        simple_sentry_field("trace.status"),
        simple_sentry_field("transaction.method"),
        simple_sentry_field("transaction.op"),
        simple_sentry_field("user"),
        simple_sentry_field("user.email"),
        simple_sentry_field("user.geo.country_code"),
        simple_sentry_field("user.geo.subregion"),
        simple_sentry_field("user.id"),
        simple_sentry_field("user.ip"),
        simple_sentry_field("user.username"),
        simple_measurements_field("app_start_cold", "millisecond"),
        simple_measurements_field("app_start_warm", "millisecond"),
        simple_measurements_field("frames_frozen"),
        simple_measurements_field("frames_frozen_rate", "percentage"),
        simple_measurements_field("frames_slow"),
        simple_measurements_field("frames_slow_rate", "percentage"),
        simple_measurements_field("frames_total"),
        simple_measurements_field("time_to_initial_display", "millisecond"),
        simple_measurements_field("time_to_full_display", "millisecond"),
        simple_measurements_field("stall_count"),
        simple_measurements_field("stall_percentage", "percentage"),
        simple_measurements_field("stall_stall_longest_time"),
        simple_measurements_field("stall_stall_total_time"),
        simple_measurements_field("cls"),
        simple_measurements_field("fcp", "millisecond"),
        simple_measurements_field("fid", "millisecond"),
        simple_measurements_field("fp", "millisecond"),
        simple_measurements_field("inp", "millisecond"),
        simple_measurements_field("lcp", "millisecond"),
        simple_measurements_field("ttfb", "millisecond"),
        simple_measurements_field("ttfb.requesttime", "millisecond"),
        simple_measurements_field("score.cls"),
        simple_measurements_field("score.fcp"),
        simple_measurements_field("score.fid"),
        simple_measurements_field("score.fp"),
        simple_measurements_field("score.inp"),
        simple_measurements_field("score.lcp"),
        simple_measurements_field("score.ttfb"),
        simple_measurements_field("score.total"),
        simple_measurements_field("score.weight.cls"),
        simple_measurements_field("score.weight.fcp"),
        simple_measurements_field("score.weight.fid"),
        simple_measurements_field("score.weight.fp"),
        simple_measurements_field("score.weight.inp"),
        simple_measurements_field("score.weight.lcp"),
        simple_measurements_field("score.weight.ttfb"),
    ]
}


INTERNAL_TO_PUBLIC_ALIAS_MAPPINGS: dict[Literal["string", "number"], dict[str, str]] = {
    "string": {
        definition.internal_name: definition.public_alias
        for definition in SPAN_COLUMN_DEFINITIONS.values()
        if not definition.secondary_alias and definition.search_type == "string"
    }
    | {
        # sentry.service is the project id as a string, but map to project for convenience
        "sentry.service": "project",
    },
    "number": {
        definition.internal_name: definition.public_alias
        for definition in SPAN_COLUMN_DEFINITIONS.values()
        if not definition.secondary_alias and definition.search_type != "string"
    },
}


def translate_internal_to_public_alias(
    internal_alias: str,
    type: Literal["string", "number"],
) -> str | None:
    mappings = INTERNAL_TO_PUBLIC_ALIAS_MAPPINGS.get(type, {})
    return mappings.get(internal_alias)


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


def device_class_context_constructor(params: SnubaParams) -> VirtualColumnContext:
    # EAP defaults to lower case `unknown`, but in querybuilder we used `Unknown`
    value_map = {"": "Unknown"}
    for device_class, values in DEVICE_CLASS.items():
        for value in values:
            value_map[value] = device_class
    return VirtualColumnContext(
        from_column_name="sentry.device.class",
        to_column_name="device.class",
        value_map=value_map,
    )


def module_context_constructor(params: SnubaParams) -> VirtualColumnContext:
    value_map = {key: key for key in SPAN_MODULE_CATEGORY_VALUES}
    return VirtualColumnContext(
        from_column_name="sentry.category",
        to_column_name="span.module",
        value_map=value_map,
    )


VIRTUAL_CONTEXTS = {
    "project": project_context_constructor("project"),
    "project.slug": project_context_constructor("project.slug"),
    "project.name": project_context_constructor("project.name"),
    "device.class": device_class_context_constructor,
    "span.module": module_context_constructor,
}


SPAN_FUNCTION_DEFINITIONS = {
    "sum": FunctionDefinition(
        internal_function=Function.FUNCTION_SUM,
        default_search_type="duration",
        arguments=[
            ArgumentDefinition(
                argument_types=["byte", "duration", "millisecond", "number"],
                default_arg="span.duration",
            )
        ],
    ),
    "avg": FunctionDefinition(
        internal_function=Function.FUNCTION_AVG,
        default_search_type="duration",
        arguments=[
            ArgumentDefinition(
                argument_types=["byte", "duration", "millisecond", "number", "percentage"],
                default_arg="span.duration",
            )
        ],
    ),
    "avg_sample": FunctionDefinition(
        internal_function=Function.FUNCTION_AVG,
        default_search_type="duration",
        arguments=[
            ArgumentDefinition(
                argument_types=["byte", "duration", "millisecond", "number", "percentage"],
                default_arg="span.duration",
            )
        ],
        extrapolation=False,
    ),
    "count": FunctionDefinition(
        internal_function=Function.FUNCTION_COUNT,
        infer_search_type_from_arguments=False,
        default_search_type="integer",
        arguments=[
            ArgumentDefinition(
                argument_types=["byte", "duration", "millisecond", "number"],
                default_arg="span.duration",
            )
        ],
    ),
    "count_sample": FunctionDefinition(
        internal_function=Function.FUNCTION_COUNT,
        infer_search_type_from_arguments=False,
        default_search_type="integer",
        arguments=[
            ArgumentDefinition(
                argument_types=["byte", "duration", "millisecond", "number"],
                default_arg="span.duration",
            )
        ],
        extrapolation=False,
    ),
    "p50": FunctionDefinition(
        internal_function=Function.FUNCTION_P50,
        default_search_type="duration",
        arguments=[
            ArgumentDefinition(
                argument_types=["byte", "duration", "millisecond", "number"],
                default_arg="span.duration",
            )
        ],
    ),
    "p50_sample": FunctionDefinition(
        internal_function=Function.FUNCTION_P50,
        default_search_type="duration",
        arguments=[
            ArgumentDefinition(
                argument_types=["byte", "duration", "millisecond", "number"],
                default_arg="span.duration",
            )
        ],
        extrapolation=False,
    ),
    "p75": FunctionDefinition(
        internal_function=Function.FUNCTION_P75,
        default_search_type="duration",
        arguments=[
            ArgumentDefinition(
                argument_types=["byte", "duration", "millisecond", "number"],
                default_arg="span.duration",
            )
        ],
    ),
    "p90": FunctionDefinition(
        internal_function=Function.FUNCTION_P90,
        default_search_type="duration",
        arguments=[
            ArgumentDefinition(
                argument_types=["byte", "duration", "millisecond", "number"],
                default_arg="span.duration",
            )
        ],
    ),
    "p95": FunctionDefinition(
        internal_function=Function.FUNCTION_P95,
        default_search_type="duration",
        arguments=[
            ArgumentDefinition(
                argument_types=["byte", "duration", "millisecond", "number"],
                default_arg="span.duration",
            )
        ],
    ),
    "p99": FunctionDefinition(
        internal_function=Function.FUNCTION_P99,
        default_search_type="duration",
        arguments=[
            ArgumentDefinition(
                argument_types=["byte", "duration", "millisecond", "number"],
                default_arg="span.duration",
            )
        ],
    ),
    "p100": FunctionDefinition(
        internal_function=Function.FUNCTION_MAX,
        default_search_type="duration",
        arguments=[
            ArgumentDefinition(
                argument_types=["byte", "duration", "millisecond", "number"],
                default_arg="span.duration",
            )
        ],
    ),
    "max": FunctionDefinition(
        internal_function=Function.FUNCTION_MAX,
        default_search_type="duration",
        arguments=[
            ArgumentDefinition(
                argument_types=["byte", "duration", "millisecond", "number", "percentage"],
                default_arg="span.duration",
            )
        ],
    ),
    "min": FunctionDefinition(
        internal_function=Function.FUNCTION_MIN,
        default_search_type="duration",
        arguments=[
            ArgumentDefinition(
                argument_types=["byte", "duration", "millisecond", "number", "percentage"],
                default_arg="span.duration",
            )
        ],
    ),
    "count_unique": FunctionDefinition(
        internal_function=Function.FUNCTION_UNIQ,
        default_search_type="number",
        arguments=[
            ArgumentDefinition(
                argument_types=["string"],
            )
        ],
    ),
}


Processors: dict[str, Callable[[Any], Any]] = {}
