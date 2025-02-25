from collections.abc import Callable
from typing import Any, Literal

from sentry_protos.snuba.v1.attribute_conditional_aggregation_pb2 import (
    AttributeConditionalAggregation,
)
from sentry_protos.snuba.v1.endpoint_trace_item_table_pb2 import Column
from sentry_protos.snuba.v1.request_common_pb2 import TraceItemType
from sentry_protos.snuba.v1.trace_item_attribute_pb2 import (
    AttributeKey,
    AttributeValue,
    ExtrapolationMode,
    Function,
    StrArray,
    VirtualColumnContext,
)
from sentry_protos.snuba.v1.trace_item_filter_pb2 import ComparisonFilter, TraceItemFilter

from sentry.exceptions import InvalidSearchQuery
from sentry.search.eap import constants
from sentry.search.eap.columns import (
    ArgumentDefinition,
    ColumnDefinitions,
    FormulaDefinition,
    FunctionDefinition,
    ResolvedColumn,
    VirtualColumnDefinition,
    datetime_processor,
    project_context_constructor,
    project_term_resolver,
    simple_measurements_field,
    simple_sentry_field,
)
from sentry.search.eap.common_columns import COMMON_COLUMNS
from sentry.search.eap.constants import RESPONSE_CODE_MAP
from sentry.search.events.constants import (
    PRECISE_FINISH_TS,
    PRECISE_START_TS,
    SPAN_MODULE_CATEGORY_VALUES,
)
from sentry.search.events.types import SnubaParams
from sentry.search.utils import DEVICE_CLASS
from sentry.utils.validators import is_event_id, is_span_id

SPAN_ATTRIBUTE_DEFINITIONS = {
    column.public_alias: column
    for column in COMMON_COLUMNS
    + [
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
            public_alias="is_transaction",
            internal_name="sentry.is_segment",
            search_type="boolean",
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
            public_alias="profiler.id",
            internal_name="profiler_id",
            search_type="string",
        ),
        ResolvedColumn(
            public_alias="thread.id",
            internal_name="thread.id",
            search_type="string",
        ),
        ResolvedColumn(
            public_alias="thread.name",
            internal_name="thread.name",
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
            public_alias=PRECISE_START_TS,
            internal_name="sentry.start_timestamp",
            search_type="number",
        ),
        ResolvedColumn(
            public_alias=PRECISE_FINISH_TS,
            internal_name="sentry.end_timestamp",
            search_type="number",
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
        simple_measurements_field("cache.item_size", search_type="byte", secondary_alias=True),
        ResolvedColumn(
            public_alias="cache.item_size",
            internal_name="cache.item_size",
            search_type="byte",
        ),
        simple_measurements_field(
            "messaging.message.body.size", search_type="byte", secondary_alias=True
        ),
        ResolvedColumn(
            public_alias="messaging.message.body.size",
            internal_name="messaging.message.body.size",
            search_type="byte",
        ),
        simple_measurements_field(
            "messaging.message.receive.latency", search_type="millisecond", secondary_alias=True
        ),
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
        for definition in SPAN_ATTRIBUTE_DEFINITIONS.values()
        if not definition.secondary_alias and definition.search_type == "string"
    }
    | {
        # sentry.service is the project id as a string, but map to project for convenience
        "sentry.service": "project",
    },
    "number": {
        definition.internal_name: definition.public_alias
        for definition in SPAN_ATTRIBUTE_DEFINITIONS.values()
        if not definition.secondary_alias and definition.search_type != "string"
    },
}


def translate_internal_to_public_alias(
    internal_alias: str,
    type: Literal["string", "number"],
) -> str | None:
    mappings = INTERNAL_TO_PUBLIC_ALIAS_MAPPINGS.get(type, {})
    return mappings.get(internal_alias)


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


SPAN_VIRTUAL_CONTEXTS = {
    "device.class": VirtualColumnDefinition(
        constructor=device_class_context_constructor,
        filter_column="sentry.device.class",
        # TODO: need to change this so the VCC is using it too, but would require rewriting the term_resolver
        default_value="Unknown",
    ),
    "span.module": VirtualColumnDefinition(
        constructor=module_context_constructor,
    ),
}
for key in constants.PROJECT_FIELDS:
    SPAN_VIRTUAL_CONTEXTS[key] = VirtualColumnDefinition(
        constructor=project_context_constructor(key),
        term_resolver=project_term_resolver,
        filter_column="project.id",
    )


def count_processor(count_value: int | None) -> int:
    if count_value is None:
        return 0
    else:
        return count_value


def http_response_rate(arg: str) -> Column.BinaryFormula:

    if not arg.isdigit():
        raise InvalidSearchQuery("http_response_rate accepts a single digit (1,2,3,4,5)")

    code = int(
        arg  # TODO - converting this arg is a bit of a hack, we should pass in the int directly if the arg type is int
    )

    # TODO - handling valid parameters should be handled in the function_definitions (span_columns.py)
    if code not in [1, 2, 3, 4, 5]:
        raise InvalidSearchQuery("http_response_rate accepts a single digit (1,2,3,4,5)")

    response_codes = RESPONSE_CODE_MAP[code]
    return Column.BinaryFormula(
        left=Column(
            conditional_aggregation=AttributeConditionalAggregation(
                aggregate=Function.FUNCTION_COUNT,
                key=AttributeKey(
                    name="sentry.status_code",
                    type=AttributeKey.TYPE_STRING,
                ),
                filter=TraceItemFilter(
                    comparison_filter=ComparisonFilter(
                        key=AttributeKey(
                            name="sentry.status_code",
                            type=AttributeKey.TYPE_STRING,
                        ),
                        op=ComparisonFilter.OP_IN,
                        value=AttributeValue(
                            val_str_array=StrArray(
                                values=response_codes,  #
                            ),
                        ),
                    )
                ),
                label="error_request_count",
                extrapolation_mode=ExtrapolationMode.EXTRAPOLATION_MODE_NONE,
            ),
        ),
        op=Column.BinaryFormula.OP_DIVIDE,
        right=Column(
            conditional_aggregation=AttributeConditionalAggregation(
                aggregate=Function.FUNCTION_COUNT,
                key=AttributeKey(
                    name="sentry.status_code",
                    type=AttributeKey.TYPE_STRING,
                ),
                label="total_request_count",
                extrapolation_mode=ExtrapolationMode.EXTRAPOLATION_MODE_NONE,
            ),
        ),
    )


CUSTOM_FUNCTION_RESOLVER: dict[str, Callable[[Any], Column.BinaryFormula]] = {
    "http_response_rate": http_response_rate
}

SPAN_FUNCTION_DEFINITIONS = {
    "sum": FunctionDefinition(
        internal_function=Function.FUNCTION_SUM,
        default_search_type="duration",
        arguments=[
            ArgumentDefinition(
                argument_types={
                    "duration",
                    "number",
                    *constants.SIZE_TYPE,
                    *constants.DURATION_TYPE,
                },
                default_arg="span.duration",
            )
        ],
    ),
    "avg": FunctionDefinition(
        internal_function=Function.FUNCTION_AVG,
        default_search_type="duration",
        arguments=[
            ArgumentDefinition(
                argument_types={
                    "duration",
                    "number",
                    "percentage",
                    *constants.SIZE_TYPE,
                    *constants.DURATION_TYPE,
                },
                default_arg="span.duration",
            )
        ],
    ),
    "avg_sample": FunctionDefinition(
        internal_function=Function.FUNCTION_AVG,
        default_search_type="duration",
        arguments=[
            ArgumentDefinition(
                argument_types={
                    "duration",
                    "number",
                    "percentage",
                    *constants.SIZE_TYPE,
                    *constants.DURATION_TYPE,
                },
                default_arg="span.duration",
            )
        ],
        extrapolation=False,
    ),
    "count": FunctionDefinition(
        internal_function=Function.FUNCTION_COUNT,
        infer_search_type_from_arguments=False,
        default_search_type="integer",
        processor=count_processor,
        arguments=[
            ArgumentDefinition(
                argument_types={
                    "duration",
                    "number",
                    *constants.SIZE_TYPE,
                    *constants.DURATION_TYPE,
                },
                default_arg="span.duration",
            )
        ],
    ),
    "count_sample": FunctionDefinition(
        internal_function=Function.FUNCTION_COUNT,
        infer_search_type_from_arguments=False,
        default_search_type="integer",
        processor=count_processor,
        arguments=[
            ArgumentDefinition(
                argument_types={
                    "duration",
                    "number",
                    *constants.SIZE_TYPE,
                    *constants.DURATION_TYPE,
                },
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
                argument_types={
                    "duration",
                    "number",
                    *constants.SIZE_TYPE,
                    *constants.DURATION_TYPE,
                },
                default_arg="span.duration",
            )
        ],
    ),
    "p50_sample": FunctionDefinition(
        internal_function=Function.FUNCTION_P50,
        default_search_type="duration",
        arguments=[
            ArgumentDefinition(
                argument_types={
                    "duration",
                    "number",
                    *constants.SIZE_TYPE,
                    *constants.DURATION_TYPE,
                },
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
                argument_types={
                    "duration",
                    "number",
                    *constants.SIZE_TYPE,
                    *constants.DURATION_TYPE,
                },
                default_arg="span.duration",
            )
        ],
    ),
    "p90": FunctionDefinition(
        internal_function=Function.FUNCTION_P90,
        default_search_type="duration",
        arguments=[
            ArgumentDefinition(
                argument_types={
                    "duration",
                    "number",
                    *constants.SIZE_TYPE,
                    *constants.DURATION_TYPE,
                },
                default_arg="span.duration",
            )
        ],
    ),
    "p95": FunctionDefinition(
        internal_function=Function.FUNCTION_P95,
        default_search_type="duration",
        arguments=[
            ArgumentDefinition(
                argument_types={
                    "duration",
                    "number",
                    *constants.SIZE_TYPE,
                    *constants.DURATION_TYPE,
                },
                default_arg="span.duration",
            )
        ],
    ),
    "p99": FunctionDefinition(
        internal_function=Function.FUNCTION_P99,
        default_search_type="duration",
        arguments=[
            ArgumentDefinition(
                argument_types={
                    "duration",
                    "number",
                    *constants.SIZE_TYPE,
                    *constants.DURATION_TYPE,
                },
                default_arg="span.duration",
            )
        ],
    ),
    "p100": FunctionDefinition(
        internal_function=Function.FUNCTION_MAX,
        default_search_type="duration",
        arguments=[
            ArgumentDefinition(
                argument_types={
                    "duration",
                    "number",
                    *constants.SIZE_TYPE,
                    *constants.DURATION_TYPE,
                },
                default_arg="span.duration",
            )
        ],
    ),
    "max": FunctionDefinition(
        internal_function=Function.FUNCTION_MAX,
        default_search_type="duration",
        arguments=[
            ArgumentDefinition(
                argument_types={
                    "duration",
                    "number",
                    "percentage",
                    *constants.SIZE_TYPE,
                    *constants.DURATION_TYPE,
                },
                default_arg="span.duration",
            )
        ],
    ),
    "min": FunctionDefinition(
        internal_function=Function.FUNCTION_MIN,
        default_search_type="duration",
        arguments=[
            ArgumentDefinition(
                argument_types={
                    "duration",
                    "number",
                    "percentage",
                    *constants.SIZE_TYPE,
                    *constants.DURATION_TYPE,
                },
                default_arg="span.duration",
            )
        ],
    ),
    "count_unique": FunctionDefinition(
        internal_function=Function.FUNCTION_UNIQ,
        default_search_type="integer",
        infer_search_type_from_arguments=False,
        processor=count_processor,
        arguments=[
            ArgumentDefinition(
                argument_types={"string"},
            )
        ],
    ),
}

SPAN_FORMULA_DEFINITIONS = {
    "http_response_rate": FormulaDefinition(
        default_search_type="percentage",
        arguments=[
            ArgumentDefinition(
                argument_types={
                    "string"
                },  # TODO - this should be an integer, but `resolve_attribute` returns a string
                default_arg=None,  # TODO - this should only accept 2,3,4,5
            )
        ],
        formula_resolver=CUSTOM_FUNCTION_RESOLVER["http_response_rate"],
    ),
}

SPAN_DEFINITIONS = ColumnDefinitions(
    functions=SPAN_FUNCTION_DEFINITIONS,
    formulas=SPAN_FORMULA_DEFINITIONS,
    columns=SPAN_ATTRIBUTE_DEFINITIONS,
    contexts=SPAN_VIRTUAL_CONTEXTS,
    trace_item_type=TraceItemType.TRACE_ITEM_TYPE_SPAN,
)
