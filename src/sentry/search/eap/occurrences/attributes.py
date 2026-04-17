from typing import Literal

from sentry.search.eap import constants
from sentry.search.eap.columns import (
    ResolvedAttribute,
    datetime_processor,
)
from sentry.search.eap.common_columns import COMMON_COLUMNS, project_virtual_contexts
from sentry.utils.validators import is_event_id_or_list

OCCURRENCE_ATTRIBUTE_DEFINITIONS = {
    column.public_alias: column
    for column in (
        COMMON_COLUMNS
        + [
            # Top-level fields
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
                public_alias="span_id",
                internal_name="attr[trace.span_id]",
                search_type="string",
            ),
            # Event fields
            ResolvedAttribute(
                public_alias="group_id",
                internal_name="group_id",
                search_type="integer",
            ),
            ResolvedAttribute(
                public_alias="group_first_seen",
                internal_name="group_first_seen",
                internal_type=constants.DOUBLE,
                search_type="string",
                processor=datetime_processor,
            ),
            ResolvedAttribute(
                public_alias="issue_occurrence_id",
                internal_name="issue_occurrence_id",
                search_type="string",
            ),
            ResolvedAttribute(
                public_alias="group_type_id",
                internal_name="group_type_id",
                search_type="integer",
            ),
            ResolvedAttribute(
                public_alias="type",
                internal_name="type",
                search_type="string",
            ),
            ResolvedAttribute(
                public_alias="version",
                internal_name="version",
                search_type="string",
            ),
            ResolvedAttribute(
                public_alias="platform",
                internal_name="platform",
                search_type="string",
            ),
            ResolvedAttribute(
                public_alias="location",
                internal_name="location",
                search_type="string",
            ),
            ResolvedAttribute(
                public_alias="title",
                internal_name="title",
                search_type="string",
            ),
            ResolvedAttribute(
                public_alias="subtitle",
                internal_name="subtitle",
                search_type="string",
            ),
            ResolvedAttribute(
                public_alias="culprit",
                internal_name="culprit",
                search_type="string",
            ),
            ResolvedAttribute(
                public_alias="level",
                internal_name="level",
                search_type="string",
            ),
            ResolvedAttribute(
                public_alias="resource_id",
                internal_name="resource_id",
                search_type="string",
            ),
            ResolvedAttribute(
                public_alias="message",
                internal_name="message",
                search_type="string",
            ),
            ResolvedAttribute(
                public_alias="release",
                internal_name="release",
                search_type="string",
            ),
            ResolvedAttribute(
                public_alias="transaction",
                internal_name="transaction",
                search_type="string",
            ),
            # Renamed fields
            ResolvedAttribute(
                public_alias="exception_main_thread",
                internal_name="exception_main_thread",
                search_type="integer",
            ),
            # Tags & contexts
            ResolvedAttribute(
                public_alias="environment",
                internal_name="environment",
                search_type="string",
            ),
            ResolvedAttribute(
                public_alias="dist",
                internal_name="dist",
                search_type="string",
            ),
            ResolvedAttribute(
                public_alias="user",
                internal_name="user",
                search_type="string",
            ),
            ResolvedAttribute(
                public_alias="profile_id",
                internal_name="profile_id",
                search_type="string",
            ),
            ResolvedAttribute(
                public_alias="replay_id",
                internal_name="replay_id",
                search_type="string",
            ),
            # User data
            ResolvedAttribute(
                public_alias="user.id",
                internal_name="user_id",
                search_type="string",
            ),
            ResolvedAttribute(
                public_alias="user.email",
                internal_name="user_email",
                search_type="string",
            ),
            ResolvedAttribute(
                public_alias="user.username",
                internal_name="user_name",
                search_type="string",
            ),
            ResolvedAttribute(
                public_alias="user.ip",
                internal_name="ip_address_v4",
                search_type="string",
            ),
            ResolvedAttribute(
                public_alias="user.ip_v6",
                internal_name="ip_address_v6",
                search_type="string",
            ),
            # SDK data
            ResolvedAttribute(
                public_alias="sdk.name",
                internal_name="sdk_name",
                search_type="string",
            ),
            ResolvedAttribute(
                public_alias="sdk.version",
                internal_name="sdk_version",
                search_type="string",
            ),
            # Hashes
            ResolvedAttribute(
                public_alias="primary_hash",
                internal_name="primary_hash",
                search_type="string",
            ),
            # Fingerprint
            ResolvedAttribute(
                public_alias="fingerprint",
                internal_name="fingerprint",
                search_type="string",
            ),
            # HTTP data
            ResolvedAttribute(
                public_alias="http.url",
                internal_name="http_url",
                search_type="string",
            ),
            ResolvedAttribute(
                public_alias="http.method",
                internal_name="http_method",
                search_type="string",
            ),
            ResolvedAttribute(
                public_alias="http.referer",
                internal_name="http_referer",
                search_type="string",
            ),
            # Exception data
            ResolvedAttribute(
                public_alias="exception_count",
                internal_name="exception_count",
                search_type="integer",
            ),
            ResolvedAttribute(
                public_alias="error.type",
                internal_name="stack_types",
                search_type="string",
            ),
            ResolvedAttribute(
                public_alias="error.value",
                internal_name="stack_values",
                search_type="string",
            ),
            ResolvedAttribute(
                public_alias="error.mechanism",
                internal_name="stack_mechanism_types",
                search_type="string",
            ),
            ResolvedAttribute(
                public_alias="error.handled",
                internal_name="stack_mechanism_handled",
                search_type="string",
            ),
            ResolvedAttribute(
                public_alias="stack.abs_path",
                internal_name="frame_abs_paths",
                search_type="string",
            ),
            ResolvedAttribute(
                public_alias="stack.filename",
                internal_name="frame_filenames",
                search_type="string",
            ),
            ResolvedAttribute(
                public_alias="stack.function",
                internal_name="frame_functions",
                search_type="string",
            ),
            ResolvedAttribute(
                public_alias="stack.module",
                internal_name="frame_modules",
                search_type="string",
            ),
            ResolvedAttribute(
                public_alias="stack.package",
                internal_name="frame_packages",
                search_type="string",
            ),
            ResolvedAttribute(
                public_alias="stack.in_app",
                internal_name="frame_in_app",
                search_type="string",
            ),
            ResolvedAttribute(
                public_alias="stack.colno",
                internal_name="frame_colnos",
                search_type="string",
            ),
            ResolvedAttribute(
                public_alias="stack.lineno",
                internal_name="frame_linenos",
                search_type="string",
            ),
            ResolvedAttribute(
                public_alias="stack.stack_level",
                internal_name="frame_stack_levels",
                search_type="string",
            ),
            ResolvedAttribute(
                public_alias="issue",
                internal_name="group_id",
                search_type="string",
                internal_type=constants.INT,
            ),
        ]
    )
}


OCCURRENCE_VIRTUAL_CONTEXTS = {
    **project_virtual_contexts(),
}

OCCURRENCE_INTERNAL_TO_PUBLIC_ALIAS_MAPPINGS: dict[
    Literal["string", "number", "boolean"], dict[str, str]
] = {
    "string": {
        definition.internal_name: definition.public_alias
        for definition in OCCURRENCE_ATTRIBUTE_DEFINITIONS.values()
        if not definition.secondary_alias and definition.search_type == "string"
    }
    | {
        # sentry.service is the project id as a string, but map to project for convenience
        "sentry.service": "project",
    },
    "boolean": {
        definition.internal_name: definition.public_alias
        for definition in OCCURRENCE_ATTRIBUTE_DEFINITIONS.values()
        if not definition.secondary_alias and definition.search_type == "boolean"
    },
    "number": {
        definition.internal_name: definition.public_alias
        for definition in OCCURRENCE_ATTRIBUTE_DEFINITIONS.values()
        # Include boolean attributes because they're stored as numbers (0 or 1)
        if not definition.secondary_alias and definition.search_type != "string"
    },
}

OCCURRENCE_PRIVATE_ATTRIBUTES: set[str] = {
    definition.internal_name
    for definition in OCCURRENCE_ATTRIBUTE_DEFINITIONS.values()
    if definition.private
}

# For dynamic internal attributes (eg. meta information for attributes) we match by the beginning of the key.
OCCURRENCE_PRIVATE_ATTRIBUTE_PREFIXES: set[str] = {constants.META_PREFIX}

OCCURRENCE_REPLACEMENT_ATTRIBUTES: set[str] = {
    definition.replacement
    for definition in OCCURRENCE_ATTRIBUTE_DEFINITIONS.values()
    if definition.replacement
}

OCCURRENCE_REPLACEMENT_MAP: dict[str, str] = {
    definition.public_alias: definition.replacement
    for definition in OCCURRENCE_ATTRIBUTE_DEFINITIONS.values()
    if definition.replacement
}

OCCURRENCE_INTERNAL_TO_SECONDARY_ALIASES_MAPPING: dict[str, set[str]] = {}

for definition in OCCURRENCE_ATTRIBUTE_DEFINITIONS.values():
    if not definition.secondary_alias:
        continue

    secondary_aliases = OCCURRENCE_INTERNAL_TO_SECONDARY_ALIASES_MAPPING.get(
        definition.internal_name, set()
    )
    secondary_aliases.add(definition.public_alias)
    OCCURRENCE_INTERNAL_TO_SECONDARY_ALIASES_MAPPING[definition.internal_name] = secondary_aliases

# Attributes excluded from stats queries (e.g., attribute distributions)
# These are typically system-level identifiers that don't provide useful distribution insights
OCCURRENCE_STATS_EXCLUDED_ATTRIBUTES_PUBLIC_ALIAS: set[str] = {
    "id",
    "trace",
    "span_id",
    "group_id",
    "issue_occurrence_id",
    "primary_hash",
    "fingerprint",
    "resource_id",
    "profile_id",
    "replay_id",
}
