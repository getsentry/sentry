from typing import Literal

from sentry.search.eap import constants
from sentry.search.eap.columns import (
    ResolvedAttribute,
    VirtualColumnDefinition,
    project_context_constructor,
    project_term_resolver,
    simple_sentry_field,
)
from sentry.search.eap.common_columns import COMMON_COLUMNS
from sentry.utils.validators import is_event_id_or_list

TRACE_METRICS_ATTRIBUTE_DEFINITIONS = {
    column.public_alias: column
    for column in COMMON_COLUMNS
    + [
        ResolvedAttribute(
            public_alias="id",
            internal_name="sentry.item_id",
            search_type="string",
            validator=is_event_id_or_list,
        ),
        ResolvedAttribute(
            public_alias=constants.TRACE_ALIAS,
            internal_name="sentry.trace_id",
            search_type="string",
            validator=is_event_id_or_list,
        ),
        ResolvedAttribute(
            public_alias=constants.TIMESTAMP_PRECISE_ALIAS,
            internal_name="sentry.timestamp_precise",
            search_type="number",
        ),
        ResolvedAttribute(
            public_alias="observed_timestamp",
            internal_name="sentry.observed_timestamp_nanos",
            internal_type=constants.STRING,  # Stored as string, but we want to search as a number.
            search_type="number",
        ),
        simple_sentry_field("browser.name"),
        simple_sentry_field("browser.version"),
        simple_sentry_field("environment"),
        simple_sentry_field("release"),
        simple_sentry_field("replay_id"),
        simple_sentry_field("trace.parent_span_id"),
        simple_sentry_field("sdk.name"),
        simple_sentry_field("sdk.version"),
        simple_sentry_field("origin"),
        # Trace Metric specific fields
        simple_sentry_field("value", search_type="number"),
        ResolvedAttribute(
            public_alias="metric.name",
            internal_name="sentry.metric_name",
            search_type="string",
        ),
        ResolvedAttribute(
            public_alias="metric.type",
            internal_name="sentry.metric_type",
            search_type="string",
        ),
        ResolvedAttribute(
            public_alias="metric.unit",
            internal_name="sentry.metric_unit",
            search_type="string",
        ),
    ]
}

# Ensure that required fields are defined at runtime
for field in {constants.TIMESTAMP_ALIAS, constants.TIMESTAMP_PRECISE_ALIAS, constants.TRACE_ALIAS}:
    assert (
        field in TRACE_METRICS_ATTRIBUTE_DEFINITIONS
    ), f"{field} must be defined for trace metrics"

TRACE_METRICS_VIRTUAL_CONTEXTS = {
    key: VirtualColumnDefinition(
        constructor=project_context_constructor(key),
        term_resolver=project_term_resolver,
        filter_column="project.id",
    )
    for key in constants.PROJECT_FIELDS
}

TRACE_METRICS_INTERNAL_TO_PUBLIC_ALIAS_MAPPINGS: dict[
    Literal["string", "number", "boolean"], dict[str, str]
] = {
    "string": {
        definition.internal_name: definition.public_alias
        for definition in TRACE_METRICS_ATTRIBUTE_DEFINITIONS.values()
        if not definition.secondary_alias and definition.search_type == "string"
    }
    | {
        # sentry.service is the project id as a string, but map to project for convenience
        "sentry.service": "project",
    },
    "boolean": {
        definition.internal_name: definition.public_alias
        for definition in TRACE_METRICS_ATTRIBUTE_DEFINITIONS.values()
        if not definition.secondary_alias and definition.search_type == "boolean"
    },
    "number": {
        definition.internal_name: definition.public_alias
        for definition in TRACE_METRICS_ATTRIBUTE_DEFINITIONS.values()
        if not definition.secondary_alias and definition.search_type != "string"
        # TODO: Add boolean support once we have boolean attributes in the frontend
        # and definition.search_type != "boolean"
    },
}

TRACE_METRICS_PRIVATE_ATTRIBUTES: set[str] = {
    definition.internal_name
    for definition in TRACE_METRICS_ATTRIBUTE_DEFINITIONS.values()
    if definition.private
}

# For dynamic internal attributes (eg. meta information for attributes) we match by the beginning of the key.
TRACE_METRICS_PRIVATE_ATTRIBUTE_PREFIXES: set[str] = {constants.META_PREFIX}

TRACE_METRICS_REPLACEMENT_ATTRIBUTES: set[str] = {
    definition.replacement
    for definition in TRACE_METRICS_ATTRIBUTE_DEFINITIONS.values()
    if definition.replacement
}

TRACE_METRICS_REPLACEMENT_MAP: dict[str, str] = {
    definition.public_alias: definition.replacement
    for definition in TRACE_METRICS_ATTRIBUTE_DEFINITIONS.values()
    if definition.replacement
}
TRACE_METRICS_INTERNAL_TO_SECONDARY_ALIASES_MAPPING: dict[str, set[str]] = {}

for definition in TRACE_METRICS_ATTRIBUTE_DEFINITIONS.values():
    if not definition.secondary_alias:
        continue

    secondary_aliases = TRACE_METRICS_INTERNAL_TO_SECONDARY_ALIASES_MAPPING.get(
        definition.internal_name, set()
    )
    secondary_aliases.add(definition.public_alias)
    TRACE_METRICS_INTERNAL_TO_SECONDARY_ALIASES_MAPPING[definition.internal_name] = (
        secondary_aliases
    )
