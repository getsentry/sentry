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

OURLOG_ATTRIBUTE_DEFINITIONS = {
    column.public_alias: column
    for column in COMMON_COLUMNS
    + [
        ResolvedAttribute(
            public_alias="severity_number",
            internal_name="sentry.severity_number",
            search_type="integer",
        ),
        ResolvedAttribute(
            public_alias="severity",
            internal_name="sentry.severity_text",
            search_type="string",
        ),
        ResolvedAttribute(
            public_alias="message",
            internal_name="sentry.body",
            search_type="string",
        ),
        ResolvedAttribute(
            public_alias="trace",
            internal_name="sentry.trace_id",
            search_type="string",
            validator=is_event_id_or_list,
        ),
        simple_sentry_field("browser.name"),
        simple_sentry_field("browser.version"),
        simple_sentry_field("environment"),
        simple_sentry_field("message.template"),
        simple_sentry_field("release"),
        simple_sentry_field("trace.parent_span_id"),
        simple_sentry_field("sdk.name"),
        simple_sentry_field("sdk.version"),
        simple_sentry_field("origin"),
        # Deprecated
        ResolvedAttribute(
            public_alias="log.body",
            internal_name="sentry.body",
            search_type="string",
            secondary_alias=True,
        ),
        # Deprecated
        ResolvedAttribute(
            public_alias="log.severity_number",
            internal_name="sentry.severity_number",
            search_type="integer",
            secondary_alias=True,
        ),
        # Deprecated
        ResolvedAttribute(
            public_alias="severity_text",
            internal_name="sentry.severity_text",
            search_type="string",
            secondary_alias=True,
        ),
        ResolvedAttribute(
            public_alias="log.severity_text",
            internal_name="sentry.severity_text",
            search_type="string",
            secondary_alias=True,
        ),
    ]
}

OURLOG_VIRTUAL_CONTEXTS = {
    key: VirtualColumnDefinition(
        constructor=project_context_constructor(key),
        term_resolver=project_term_resolver,
        filter_column="project.id",
    )
    for key in constants.PROJECT_FIELDS
}

LOGS_INTERNAL_TO_PUBLIC_ALIAS_MAPPINGS: dict[Literal["string", "number"], dict[str, str]] = {
    "string": {
        definition.internal_name: definition.public_alias
        for definition in OURLOG_ATTRIBUTE_DEFINITIONS.values()
        if not definition.secondary_alias and definition.search_type == "string"
    }
    | {
        # sentry.service is the project id as a string, but map to project for convenience
        "sentry.service": "project",
    },
    "number": {
        definition.internal_name: definition.public_alias
        for definition in OURLOG_ATTRIBUTE_DEFINITIONS.values()
        if not definition.secondary_alias and definition.search_type != "string"
    },
}

LOGS_PRIVATE_ATTRIBUTES: set[str] = {
    definition.internal_name
    for definition in OURLOG_ATTRIBUTE_DEFINITIONS.values()
    if definition.private
}

# For dynamic internal attributes (eg. meta information for attributes) we match by the beginning of the key.
LOGS_PRIVATE_ATTRIBUTE_PREFIXES: set[str] = {"sentry._meta"}

LOGS_REPLACEMENT_ATTRIBUTES: set[str] = {
    definition.replacement
    for definition in OURLOG_ATTRIBUTE_DEFINITIONS.values()
    if definition.replacement
}

LOGS_REPLACEMENT_MAP: dict[str, str] = {
    definition.public_alias: definition.replacement
    for definition in OURLOG_ATTRIBUTE_DEFINITIONS.values()
    if definition.replacement
}

LOGS_INTERNAL_TO_SECONDARY_ALIASES_MAPPING: dict[str, set[str]] = {}

for definition in OURLOG_ATTRIBUTE_DEFINITIONS.values():
    if not definition.secondary_alias:
        continue

    secondary_aliases = LOGS_INTERNAL_TO_SECONDARY_ALIASES_MAPPING.get(
        definition.internal_name, set()
    )
    secondary_aliases.add(definition.public_alias)
    LOGS_INTERNAL_TO_SECONDARY_ALIASES_MAPPING[definition.internal_name] = secondary_aliases
