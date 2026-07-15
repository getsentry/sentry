import logging
from dataclasses import replace
from typing import Any, Literal

from sentry_conventions.attributes import (
    ATTRIBUTE_METADATA,
    AttributeMetadata,
    DeprecationStatus,
)
from sentry_protos.snuba.v1.trace_item_attribute_pb2 import VirtualColumnContext

from sentry.insights.models import InsightsStarredSegment
from sentry.search.eap import constants
from sentry.search.eap.columns import (
    AttributeContext,
    ResolvedAttribute,
    VirtualColumnDefinition,
    simple_measurements_field,
    simple_sentry_field,
)
from sentry.search.eap.common_columns import COMMON_COLUMNS, project_virtual_contexts
from sentry.search.events.constants import (
    PRECISE_FINISH_TS,
    PRECISE_START_TS,
    SPAN_MODULE_CATEGORY_VALUES,
)
from sentry.search.events.types import SnubaParams
from sentry.search.utils import DEVICE_CLASS, validate_event_id, validate_span_id
from sentry.utils.validators import (
    is_empty_string,
    normalize_event_id_strict,
)

logger = logging.getLogger(__name__)


SPAN_ATTRIBUTE_DEFINITIONS = {
    column.public_alias: column
    for column in COMMON_COLUMNS
    + [
        simple_sentry_field("client_sample_rate", search_type="number"),
        simple_sentry_field("server_sample_rate", search_type="number"),
        ResolvedAttribute(
            public_alias="id",
            internal_name="sentry.item_id",
            search_type="string",
            validator=validate_span_id,
        ),
        ResolvedAttribute(
            public_alias="parent_span",
            internal_name="sentry.parent_span_id",
            search_type="string",
            validator=[is_empty_string, validate_span_id],
        ),
        ResolvedAttribute(
            public_alias="span.name",
            internal_name="sentry.name",
            search_type="string",
        ),
        ResolvedAttribute(
            public_alias="span.kind",
            internal_name="sentry.kind",
            search_type="string",
        ),
        ResolvedAttribute(
            public_alias="span.action",
            internal_name="sentry.action",
            search_type="string",
        ),
        ResolvedAttribute(
            public_alias="span.description",
            internal_name="sentry.raw_description",
            search_type="string",
            context=AttributeContext(brief="Description of the span's operation."),
        ),
        ResolvedAttribute(
            public_alias="description",
            internal_name="sentry.raw_description",
            search_type="string",
            secondary_alias=True,
        ),
        ResolvedAttribute(
            public_alias="sentry.normalized_description",
            internal_name="sentry.normalized_description",
            search_type="string",
        ),
        # Message maps to description, this is to allow wildcard searching
        ResolvedAttribute(
            public_alias="message",
            internal_name="sentry.raw_description",
            search_type="string",
            secondary_alias=True,
            context=AttributeContext(brief="Description of the span's operation."),
        ),
        ResolvedAttribute(
            public_alias="span.domain",
            internal_name="sentry.domain",
            search_type="string",
        ),
        ResolvedAttribute(
            public_alias="span.group",
            internal_name="sentry.group",
            search_type="string",
        ),
        ResolvedAttribute(
            public_alias="span.op",
            internal_name="sentry.op",
            search_type="string",
        ),
        ResolvedAttribute(
            public_alias="span.category",
            internal_name="sentry.category",
            search_type="string",
        ),
        ResolvedAttribute(
            public_alias="span.self_time",
            internal_name="sentry.exclusive_time_ms",
            search_type="millisecond",
            context=AttributeContext(
                brief="The duration of the span excluding the duration of its child spans."
            ),
        ),
        ResolvedAttribute(
            public_alias="span.duration",
            internal_name="sentry.duration_ms",
            search_type="millisecond",
            context=AttributeContext(brief="The total time taken by the span."),
        ),
        ResolvedAttribute(
            public_alias="span.status",
            internal_name="sentry.status",
            search_type="string",
            context=AttributeContext(
                brief="Span status. Indicates whether the operation was successful."
            ),
        ),
        ResolvedAttribute(
            public_alias="span.status_code",
            internal_name="sentry.status_code",
            search_type="string",
        ),
        ResolvedAttribute(
            public_alias="span.status.message",
            internal_name="sentry.status.message",
            search_type="string",
        ),
        ResolvedAttribute(
            public_alias="trace",
            internal_name="sentry.trace_id",
            search_type="string",
            validator=validate_event_id,
            normalizer=normalize_event_id_strict,
            context=AttributeContext(
                brief=(
                    "A trace represents the record of the entire operation you want to "
                    "measure or track — like page load, searched using the UUID generated "
                    "by Sentry's SDK."
                )
            ),
        ),
        ResolvedAttribute(
            public_alias="transaction",
            internal_name="sentry.transaction",
            search_type="string",
        ),
        ResolvedAttribute(
            public_alias="is_transaction",
            internal_name="sentry.is_segment",
            search_type="boolean",
            context=AttributeContext(brief="The span is also a transaction."),
        ),
        ResolvedAttribute(
            public_alias="transaction.span_id",
            internal_name="sentry.segment_id",
            search_type="string",
        ),
        ResolvedAttribute(
            public_alias="transaction.event_id",
            internal_name="sentry.event_id",
            search_type="string",
        ),
        ResolvedAttribute(
            public_alias="profile.id",
            internal_name="sentry.profile_id",
            search_type="string",
        ),
        ResolvedAttribute(
            public_alias="profiler.id",
            internal_name="sentry.profiler_id",
            search_type="string",
        ),
        ResolvedAttribute(
            public_alias="thread.id",
            internal_name="sentry.thread.id",
            search_type="string",
        ),
        ResolvedAttribute(
            public_alias="thread.name",
            internal_name="sentry.thread.name",
            search_type="string",
        ),
        ResolvedAttribute(
            public_alias="replay.id",
            internal_name="sentry.replay_id",
            search_type="string",
        ),
        ResolvedAttribute(
            public_alias="span.ai.pipeline.group",
            internal_name="sentry.ai_pipeline_group",
            search_type="string",
        ),
        ResolvedAttribute(
            public_alias="sentry.links",
            internal_name="sentry.links",
            search_type="string",
            private=True,
        ),
        ResolvedAttribute(
            public_alias="ai.total_tokens.used",
            internal_name="ai_total_tokens_used",
            search_type="integer",
        ),
        ResolvedAttribute(
            public_alias="ai.total_cost",
            internal_name="ai.total_cost",
            search_type="currency",
        ),
        ResolvedAttribute(
            public_alias="gen_ai.conversation.id",
            internal_name="gen_ai.conversation.id",
            search_type="string",
        ),
        ResolvedAttribute(
            public_alias="gen_ai.operation.name",
            internal_name="gen_ai.operation.name",
            search_type="string",
        ),
        ResolvedAttribute(
            public_alias="gen_ai.operation.type",
            internal_name="gen_ai.operation.type",
            search_type="string",
        ),
        ResolvedAttribute(
            public_alias="gen_ai.usage.input_tokens",
            internal_name="gen_ai.usage.input_tokens",
            search_type="integer",
        ),
        ResolvedAttribute(
            public_alias="gen_ai.usage.input_tokens.cached",
            internal_name="gen_ai.usage.input_tokens.cached",
            search_type="integer",
        ),
        ResolvedAttribute(
            public_alias="gen_ai.usage.output_tokens",
            internal_name="gen_ai.usage.output_tokens",
            search_type="integer",
        ),
        ResolvedAttribute(
            public_alias="gen_ai.usage.output_tokens.reasoning",
            internal_name="gen_ai.usage.output_tokens.reasoning",
            search_type="integer",
        ),
        ResolvedAttribute(
            public_alias="gen_ai.usage.reasoning.output_tokens",
            internal_name="gen_ai.usage.reasoning.output_tokens",
            search_type="integer",
        ),
        ResolvedAttribute(
            public_alias="gen_ai.usage.cache_read.input_tokens",
            internal_name="gen_ai.usage.cache_read.input_tokens",
            search_type="integer",
        ),
        ResolvedAttribute(
            public_alias="gen_ai.usage.cache_creation.input_tokens",
            internal_name="gen_ai.usage.cache_creation.input_tokens",
            search_type="integer",
        ),
        ResolvedAttribute(
            public_alias="gen_ai.usage.total_tokens",
            internal_name="gen_ai.usage.total_tokens",
            search_type="integer",
        ),
        ResolvedAttribute(
            public_alias="gen_ai.cost.input_tokens",
            internal_name="gen_ai.cost.input_tokens",
            search_type="currency",
        ),
        ResolvedAttribute(
            public_alias="gen_ai.cost.output_tokens",
            internal_name="gen_ai.cost.output_tokens",
            search_type="currency",
        ),
        ResolvedAttribute(
            public_alias="gen_ai.cost.total_tokens",
            internal_name="gen_ai.cost.total_tokens",
            search_type="currency",
        ),
        ResolvedAttribute(
            public_alias="gen_ai.usage.total_cost",
            internal_name="gen_ai.usage.total_cost",
            search_type="currency",
        ),
        ResolvedAttribute(
            public_alias="gen_ai.request.reasoning.level",
            internal_name="gen_ai.request.reasoning.level",
            search_type="string",
        ),
        ResolvedAttribute(
            public_alias="cloudflare.durable_object.query.bindings",
            internal_name="cloudflare.durable_object.query.bindings",
            search_type="integer",
        ),
        ResolvedAttribute(
            public_alias="cloudflare.durable_object.response.rows_read",
            internal_name="cloudflare.durable_object.response.rows_read",
            search_type="integer",
        ),
        ResolvedAttribute(
            public_alias="cloudflare.durable_object.response.rows_written",
            internal_name="cloudflare.durable_object.response.rows_written",
            search_type="integer",
        ),
        ResolvedAttribute(
            public_alias="http.decoded_response_content_length",
            internal_name="http.decoded_response_content_length",
            search_type="byte",
        ),
        ResolvedAttribute(
            public_alias="http.response_content_length",
            internal_name="http.response_content_length",
            search_type="byte",
        ),
        ResolvedAttribute(
            public_alias="http.response_transfer_size",
            internal_name="http.response_transfer_size",
            search_type="byte",
        ),
        ResolvedAttribute(
            public_alias="http.response_status_code",
            internal_name="http.response.status_code",
            search_type="integer",
        ),
        ResolvedAttribute(
            public_alias="sampling_rate",
            internal_name="sentry.sampling_factor",
            search_type="percentage",
        ),
        ResolvedAttribute(
            public_alias="cache.hit",
            internal_name="cache.hit",
            search_type="boolean",
        ),
        ResolvedAttribute(
            public_alias=PRECISE_START_TS,
            internal_name="sentry.start_timestamp_precise",
            search_type="number",
        ),
        ResolvedAttribute(
            public_alias=PRECISE_FINISH_TS,
            internal_name="sentry.end_timestamp_precise",
            search_type="number",
        ),
        ResolvedAttribute(
            public_alias="received",
            internal_name="sentry.received",
            search_type="number",
        ),
        ResolvedAttribute(
            public_alias="mobile.frames_delay",
            internal_name="frames.delay",
            search_type="second",
        ),
        ResolvedAttribute(
            public_alias="mobile.slow_frames",
            internal_name="frames.slow",
            search_type="number",
        ),
        ResolvedAttribute(
            public_alias="mobile.frozen_frames",
            internal_name="frames.frozen",
            search_type="number",
        ),
        ResolvedAttribute(
            public_alias="mobile.total_frames",
            internal_name="frames.total",
            search_type="number",
        ),
        # These fields are extracted from span measurements but were accessed
        # 2 ways, with + without the measurements. prefix. So expose both for compatibility.
        simple_measurements_field("cache.item_size", search_type="byte", secondary_alias=True),
        ResolvedAttribute(
            public_alias="cache.item_size",
            internal_name="cache.item_size",
            search_type="byte",
        ),
        simple_measurements_field(
            "messaging.message.body.size", search_type="byte", secondary_alias=True
        ),
        ResolvedAttribute(
            public_alias="messaging.message.body.size",
            internal_name="messaging.message.body.size",
            search_type="byte",
        ),
        simple_measurements_field(
            "messaging.message.receive.latency",
            search_type="millisecond",
            secondary_alias=True,
        ),
        ResolvedAttribute(
            public_alias="messaging.message.receive.latency",
            internal_name="messaging.message.receive.latency",
            search_type="millisecond",
        ),
        simple_measurements_field("messaging.message.retry.count", secondary_alias=True),
        ResolvedAttribute(
            public_alias="messaging.message.retry.count",
            internal_name="messaging.message.retry.count",
            search_type="number",
        ),
        ResolvedAttribute(
            public_alias="spans.browser",
            internal_name="span_ops.ops.browser",
            search_type="millisecond",
            context=AttributeContext(
                brief="Cumulative browser time for a transaction, based on the span operations."
            ),
        ),
        ResolvedAttribute(
            public_alias="spans.db",
            internal_name="span_ops.ops.db",
            search_type="millisecond",
            context=AttributeContext(
                brief="Cumulative db time for a transaction, based on span operations."
            ),
        ),
        ResolvedAttribute(
            public_alias="spans.http",
            internal_name="span_ops.ops.http",
            search_type="millisecond",
            context=AttributeContext(
                brief="Cumulative http time for a transaction, based on span operations."
            ),
        ),
        ResolvedAttribute(
            public_alias="spans.resource",
            internal_name="span_ops.ops.resource",
            search_type="millisecond",
            context=AttributeContext(
                brief="Cumulative resource time for a transaction, based on span operations."
            ),
        ),
        ResolvedAttribute(
            public_alias="spans.ui",
            internal_name="span_ops.ops.ui",
            search_type="millisecond",
            context=AttributeContext(
                brief="Cumulative UI time for a transaction, based on span operations."
            ),
        ),
        ResolvedAttribute(
            public_alias="span.system",
            internal_name="db.system",
            search_type="string",
            secondary_alias=True,
        ),
        ResolvedAttribute(
            public_alias="sentry.sampling_weight",
            internal_name="sentry.sampling_weight",
            search_type="number",
        ),
        ResolvedAttribute(
            public_alias="sentry.sampling_factor",
            internal_name="sentry.sampling_factor",
            search_type="number",
        ),
        ResolvedAttribute(
            public_alias="code.lineno",
            internal_name="code.lineno",
            search_type="number",
        ),
        simple_sentry_field("browser.name"),
        simple_sentry_field(
            "file_extension",
            context=AttributeContext(brief="The file extension of a resource span."),
        ),
        simple_sentry_field("device.family"),
        simple_sentry_field("device.arch", context=AttributeContext(brief="CPU architecture.")),
        simple_sentry_field("device.battery_level"),
        simple_sentry_field("device.brand"),
        simple_sentry_field("device.charging"),
        simple_sentry_field("device.locale"),
        simple_sentry_field("device.model_id"),
        simple_sentry_field("device.name"),
        simple_sentry_field("device.online"),
        simple_sentry_field("device.orientation"),
        simple_sentry_field("device.screen_density"),
        simple_sentry_field("device.screen_dpi"),
        simple_sentry_field("device.screen_height_pixels"),
        simple_sentry_field("device.screen_width_pixels"),
        simple_sentry_field("device.simulator"),
        simple_sentry_field("device.uuid"),
        simple_sentry_field("app.device"),
        simple_sentry_field("device.model"),
        simple_sentry_field("runtime"),
        simple_sentry_field("runtime.name"),
        simple_sentry_field("browser"),
        simple_sentry_field("origin"),
        simple_sentry_field("os"),
        simple_sentry_field("os.rooted"),
        simple_sentry_field("gpu.name"),
        simple_sentry_field("gpu.vendor"),
        simple_sentry_field("monitor.id"),
        simple_sentry_field("monitor.slug"),
        simple_sentry_field("request.url"),
        simple_sentry_field("request.method"),
        simple_sentry_field("environment"),
        simple_sentry_field("messaging.destination.name"),
        simple_sentry_field("messaging.message.id"),
        simple_sentry_field("platform"),
        simple_sentry_field("previous_trace"),
        simple_sentry_field("raw_domain"),
        simple_sentry_field("release"),
        simple_sentry_field("sdk.name"),
        simple_sentry_field("sdk.version"),
        ResolvedAttribute(
            public_alias="span_id",
            internal_name="sentry.item_id",
            search_type="string",
        ),
        simple_sentry_field(
            "trace.status",
            context=AttributeContext(brief="The span trace's success or failure status."),
        ),
        simple_sentry_field(
            "transaction.method",
            context=AttributeContext(brief="HTTP method of the containing transaction."),
        ),
        simple_sentry_field(
            "transaction.op",
            context=AttributeContext(brief="Operation of the containing transaction."),
        ),
        simple_sentry_field("user"),
        simple_sentry_field("user.email"),
        simple_sentry_field("user.geo.city"),
        simple_sentry_field("user.geo.country_code"),
        simple_sentry_field("user.geo.region"),
        simple_sentry_field("user.geo.subdivision"),
        simple_sentry_field("user.geo.subregion"),
        simple_sentry_field("user.id"),
        simple_sentry_field("user.ip"),
        simple_sentry_field("user.username"),
        simple_sentry_field("os.name"),
        simple_sentry_field("app_start_type"),
        simple_sentry_field("ttid"),
        simple_measurements_field("app_start_cold", "millisecond"),
        simple_measurements_field("app_start_warm", "millisecond"),
        simple_measurements_field(
            "frames_frozen",
            context=AttributeContext(
                brief="Slow and frozen frames measure the responsiveness of your app."
            ),
        ),
        simple_measurements_field("frames_frozen_rate", "percentage"),
        simple_measurements_field(
            "frames_slow",
            context=AttributeContext(
                brief="Slow and frozen frames measure the responsiveness of your app."
            ),
        ),
        simple_measurements_field("frames_slow_rate", "percentage"),
        simple_measurements_field(
            "frames_total",
            context=AttributeContext(
                brief="Returns results with a matching total number of frames."
            ),
        ),
        simple_measurements_field("time_to_initial_display", "millisecond"),
        simple_measurements_field("time_to_full_display", "millisecond"),
        simple_measurements_field(
            "stall_count",
            context=AttributeContext(
                brief=(
                    "A stall is when the JavaScript event loop takes longer than expected "
                    "to complete. Only applies to React Native."
                )
            ),
        ),
        simple_measurements_field("stall_percentage", "percentage"),
        simple_measurements_field("stall_stall_longest_time"),
        simple_measurements_field("stall_stall_total_time"),
        simple_measurements_field("cls"),
        simple_measurements_field("fcp", "millisecond"),
        simple_measurements_field(
            "fid",
            "millisecond",
            context=AttributeContext(
                brief=(
                    "First Input Delay (FID) measures the response time when the user "
                    "tries to interact with the viewport."
                )
            ),
        ),
        simple_measurements_field("fp", "millisecond"),
        simple_measurements_field("inp", "millisecond"),
        simple_measurements_field("lcp", "millisecond"),
        simple_measurements_field("ttfb", "millisecond"),
        simple_measurements_field(
            "ttfb.requesttime",
            "millisecond",
            context=AttributeContext(
                brief="The time between start of the request and start of the response (see diagram)."
            ),
        ),
        simple_measurements_field("score.cls"),
        simple_measurements_field("score.fcp"),
        simple_measurements_field("score.fid"),
        simple_measurements_field("score.fp"),
        simple_measurements_field("score.inp"),
        simple_measurements_field("score.lcp"),
        simple_measurements_field("score.ttfb"),
        simple_measurements_field("score.total"),
        simple_measurements_field("score.ratio.cls"),
        simple_measurements_field("score.ratio.fcp"),
        simple_measurements_field("score.ratio.fid"),
        simple_measurements_field("score.ratio.fp"),
        simple_measurements_field("score.ratio.inp"),
        simple_measurements_field("score.ratio.lcp"),
        simple_measurements_field("score.ratio.ttfb"),
        simple_measurements_field("score.ratio.total"),
        simple_measurements_field("score.weight.cls"),
        simple_measurements_field("score.weight.fcp"),
        simple_measurements_field("score.weight.fid"),
        simple_measurements_field("score.weight.fp"),
        simple_measurements_field("score.weight.inp"),
        simple_measurements_field("score.weight.lcp"),
        simple_measurements_field("score.weight.ttfb"),
    ]
}


def _normalize_convention_attribute_type(attr_type: str) -> constants.SearchType | None:
    # Convention types are generic value types like integer, double, string, boolean.
    # For convention-only attributes, map those values to EAP search types. Existing
    # local definitions keep unit-specific types like millisecond or byte.
    if attr_type == "double":
        return "number"
    if attr_type in constants.TYPE_MAP:
        return attr_type
    # Array-valued convention types are not represented in EAP search types yet.
    return None


def _update_attribute_definitions_with_deprecations(
    attribute_definitions: dict[str, ResolvedAttribute],
    convention_attributes: dict[str, AttributeMetadata],
) -> None:
    span_attribute_definitions_by_internal_name = {
        definition.internal_name: definition for definition in attribute_definitions.values()
    }

    for key, metadata in convention_attributes.items():
        deprecation = metadata.deprecation
        if (
            deprecation is None
            or deprecation.replacement is None
            or deprecation.status not in (DeprecationStatus.BACKFILL, DeprecationStatus.NORMALIZE)
        ):
            continue

        status = deprecation.status.value
        replacement = deprecation.replacement
        deprecated_attr = attribute_definitions.get(key)
        deprecated_public_alias = key
        if deprecated_attr is None:
            deprecated_attr = span_attribute_definitions_by_internal_name.get(key)
            if deprecated_attr is not None:
                deprecated_public_alias = deprecated_attr.public_alias

        if deprecated_attr is not None:
            attribute_definitions[deprecated_public_alias] = replace(
                deprecated_attr,
                replacement=replacement,
                deprecation_status=status,
            )
            # TODO: Introduce units to attribute schema.
            if (
                replacement not in attribute_definitions
                and replacement not in span_attribute_definitions_by_internal_name
            ):
                attribute_definitions[replacement] = replace(
                    deprecated_attr,
                    public_alias=replacement,
                    internal_name=replacement,
                    secondary_alias=False,
                )
        else:
            attr_type = _normalize_convention_attribute_type(metadata.type.value)
            if attr_type is None:
                continue
            attribute_definitions[key] = ResolvedAttribute(
                public_alias=key,
                internal_name=key,
                search_type=attr_type,
                replacement=replacement,
                deprecation_status=status,
            )

            if (
                replacement not in attribute_definitions
                and replacement not in span_attribute_definitions_by_internal_name
            ):
                attribute_definitions[replacement] = ResolvedAttribute(
                    public_alias=replacement,
                    internal_name=replacement,
                    search_type=attr_type,
                )

        span_attribute_definitions_by_internal_name[key] = attribute_definitions[
            deprecated_public_alias
        ]
        if replacement in attribute_definitions:
            span_attribute_definitions_by_internal_name[replacement] = attribute_definitions[
                replacement
            ]


try:
    _update_attribute_definitions_with_deprecations(SPAN_ATTRIBUTE_DEFINITIONS, ATTRIBUTE_METADATA)

except Exception as e:
    logger.exception("Failed to update attribute definitions: %s", e)


def device_class_context_constructor(params: SnubaParams, _resolver: Any) -> VirtualColumnContext:
    # EAP defaults to lower case `unknown`, but in querybuilder we used `Unknown`
    value_map = {"": "Unknown"}
    for device_class, values in DEVICE_CLASS.items():
        for value in values:
            value_map[value] = device_class
    return VirtualColumnContext(
        from_column_name="sentry.device.class",
        to_column_name="device.class",
        value_map=value_map,
        default_value="Unknown",
    )


def module_context_constructor(params: SnubaParams, _resolver: Any) -> VirtualColumnContext:
    value_map = {key: key for key in SPAN_MODULE_CATEGORY_VALUES}
    return VirtualColumnContext(
        from_column_name="sentry.category",
        to_column_name="span.module",
        value_map=value_map,
    )


def is_starred_segment_context_constructor(
    params: SnubaParams, _resolver: Any
) -> VirtualColumnContext:
    if params.user is None or params.organization_id is None:
        raise ValueError("User and organization is required for is_starred_transaction")

    starred_segment_results = InsightsStarredSegment.objects.filter(
        organization_id=params.organization_id,
        project_id__in=params.project_ids,
        user_id=params.user.id,
    )

    value_map = {result.segment_name: "true" for result in starred_segment_results}

    return VirtualColumnContext(
        from_column_name="sentry.transaction",
        to_column_name="is_starred_transaction",
        value_map=value_map,
        default_value="false",  # We can directly make this a boolean when https://github.com/getsentry/eap-planning/issues/224 is fixed
    )


SPANS_INTERNAL_TO_PUBLIC_ALIAS_MAPPINGS: dict[
    Literal["string", "number", "boolean"], dict[str, str]
] = {
    "string": {
        definition.internal_name: definition.public_alias
        for definition in SPAN_ATTRIBUTE_DEFINITIONS.values()
        if not definition.secondary_alias and definition.search_type == "string"
    }
    | {
        # sentry.service is the project id as a string, but map to project for convenience
        "sentry.service": "project",
        # Temporarily reverse map these old aliases.
        # TODO: Once TraceItemAttributeNamesResponse is updated
        # to return the new aliases, remove these temp mappings.
        "sentry.description": "sentry.normalized_description",
        "sentry.span_id": "id",
        "sentry.segment_name": "transaction",
    },
    "boolean": {
        definition.internal_name: definition.public_alias
        for definition in SPAN_ATTRIBUTE_DEFINITIONS.values()
        if not definition.secondary_alias and definition.search_type == "boolean"
    },
    "number": {
        definition.internal_name: definition.public_alias
        for definition in SPAN_ATTRIBUTE_DEFINITIONS.values()
        # Include boolean attributes because they're stored as numbers (0 or 1)
        if not definition.secondary_alias and definition.search_type != "string"
    }
    | {
        "sentry.start_timestamp": PRECISE_START_TS,
        "sentry.end_timestamp": PRECISE_FINISH_TS,
    },
}

SPANS_PRIVATE_ATTRIBUTES: set[str] = {
    definition.internal_name
    for definition in SPAN_ATTRIBUTE_DEFINITIONS.values()
    if definition.private
}

# For dynamic internal attributes (eg. meta information for attributes) we match by the beginning of the key.
SPANS_PRIVATE_ATTRIBUTE_PREFIXES: set[str] = {constants.META_PREFIX}

SPANS_REPLACEMENT_ATTRIBUTES: set[str] = {
    definition.replacement
    for definition in SPAN_ATTRIBUTE_DEFINITIONS.values()
    if definition.replacement
}

SPANS_REPLACEMENT_MAP: dict[str, str] = {
    definition.public_alias: definition.replacement
    for definition in SPAN_ATTRIBUTE_DEFINITIONS.values()
    if definition.replacement
}

# Attributes excluded from stats queries (e.g., attribute distributions)
# These are typically system-level identifiers that don't provide useful distribution insights
SPANS_STATS_EXCLUDED_ATTRIBUTES: set[str] = {
    "sentry.item_id",
    "sentry.trace_id",
    "sentry.segment_id",
    "sentry.parent_span_id",
    "sentry.profile_id",
    "sentry.event_id",
    "sentry.group",
}

SPANS_STATS_EXCLUDED_ATTRIBUTES_PUBLIC_ALIAS: set[str] = {
    "id",
    "trace",
    "transaction.span_id",
    "parent_span",
    "profile.id",
    "transaction.event_id",
    "span.group",
}


SPAN_VIRTUAL_CONTEXTS = {
    "device.class": VirtualColumnDefinition(
        constructor=device_class_context_constructor,
        filter_column="sentry.device.class",
        # TODO: need to change this so the VCC is using it too, but would require rewriting the term_resolver
        default_value="Unknown",
        sort_column="sentry.device.class",
        search_type="string",
    ),
    "span.module": VirtualColumnDefinition(
        constructor=module_context_constructor,
        search_type="string",
    ),
    "is_starred_transaction": VirtualColumnDefinition(
        constructor=is_starred_segment_context_constructor,
        default_value="false",
        processor=lambda x: True if x == "true" else False,
        search_type="boolean",
    ),
    **project_virtual_contexts(),
}

SPAN_INTERNAL_TO_SECONDARY_ALIASES_MAPPING: dict[str, set[str]] = {}


for definition in SPAN_ATTRIBUTE_DEFINITIONS.values():
    if not definition.secondary_alias:
        continue

    secondary_aliases = SPAN_INTERNAL_TO_SECONDARY_ALIASES_MAPPING.get(
        definition.internal_name, set()
    )
    secondary_aliases.add(definition.public_alias)
    SPAN_INTERNAL_TO_SECONDARY_ALIASES_MAPPING[definition.internal_name] = secondary_aliases
