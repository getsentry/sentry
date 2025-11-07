from typing import Literal

from sentry.search.eap import constants
from sentry.search.eap.columns import (
    ResolvedAttribute,
    VirtualColumnDefinition,
    project_context_constructor,
    project_term_resolver,
)
from sentry.search.eap.common_columns import COMMON_COLUMNS
from sentry.utils.validators import is_event_id_or_list

PROFILE_FUNCTIONS_ATTRIBUTE_DEFINITIONS = {
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
            public_alias="environment",
            internal_name="environment",
            search_type="string",
        ),
        ResolvedAttribute(
            public_alias="release",
            internal_name="release",
            search_type="string",
        ),
        ResolvedAttribute(
            public_alias="transaction",
            internal_name="transaction_name",
            search_type="string",
        ),
        ResolvedAttribute(
            public_alias="function",
            internal_name="name",
            search_type="string",
        ),
        ResolvedAttribute(
            public_alias="fingerprint",
            internal_name="fingerprint",
            search_type="integer",
        ),
        ResolvedAttribute(
            public_alias="stack_fingerprint",
            internal_name="stack_fingerprint",
            search_type="integer",
        ),
        ResolvedAttribute(
            public_alias="parent_fingerprint",
            internal_name="parent_fingerprint",
            search_type="integer",
        ),
        # will contain profile_id for tnx profiles and profiler_id for continuous profiles
        ResolvedAttribute(
            public_alias="profile_id",
            internal_name="profile_id",
            search_type="string",
        ),
        # enum ("transaction" | "continuous")
        ResolvedAttribute(
            public_alias="profiling_type",
            internal_name="profiling_type",
            search_type="string",
        ),
        ResolvedAttribute(
            public_alias="package",
            internal_name="package",
            search_type="string",
        ),
        ResolvedAttribute(
            public_alias="is_application",
            internal_name="is_application",
            search_type="string",
        ),
        ResolvedAttribute(
            public_alias="platform.name",
            internal_name="platform",
            search_type="string",
        ),
        ResolvedAttribute(
            public_alias="function.self_time",
            internal_name="self_time_ns",
            search_type="integer",
        ),
        ResolvedAttribute(
            public_alias="depth",
            internal_name="depth",
            search_type="integer",
        ),
        ResolvedAttribute(
            public_alias="function.duration",
            internal_name="total_time_ns",
            search_type="integer",
        ),
        ResolvedAttribute(
            public_alias="thread.id",
            internal_name="thread_id",
            search_type="string",
        ),
        # only for continuous profiles
        ResolvedAttribute(
            public_alias="start_timestamp",
            internal_name="start_timestamp",
            search_type="number",
        ),
        # only for continuous profiles
        ResolvedAttribute(
            public_alias="end_timestamp",
            internal_name="end_timestamp",
            search_type="number",
        ),
    ]
}


# Ensure that required fields are defined at runtime
for field in {constants.TIMESTAMP_ALIAS, constants.TRACE_ALIAS}:
    assert (
        field in PROFILE_FUNCTIONS_ATTRIBUTE_DEFINITIONS
    ), f"{field} must be defined for profile functions"

PROFILE_FUNCTIONS_VIRTUAL_CONTEXTS = {
    key: VirtualColumnDefinition(
        constructor=project_context_constructor(key),
        term_resolver=project_term_resolver,
        filter_column="project.id",
    )
    for key in constants.PROJECT_FIELDS
}

PROFILE_FUNCTIONS_INTERNAL_TO_PUBLIC_ALIAS_MAPPINGS: dict[
    Literal["string", "number"], dict[str, str]
] = {
    "string": {
        definition.internal_name: definition.public_alias
        for definition in PROFILE_FUNCTIONS_ATTRIBUTE_DEFINITIONS.values()
        if not definition.secondary_alias and definition.search_type == "string"
    }
    | {
        # sentry.service is the project id as a string, but map to project for convenience
        "sentry.service": "project",
    },
    "number": {
        definition.internal_name: definition.public_alias
        for definition in PROFILE_FUNCTIONS_ATTRIBUTE_DEFINITIONS.values()
        if not definition.secondary_alias and definition.search_type != "string"
    },
}

PROFILE_FUNCTIONS_PRIVATE_ATTRIBUTES: set[str] = {
    definition.internal_name
    for definition in PROFILE_FUNCTIONS_ATTRIBUTE_DEFINITIONS.values()
    if definition.private
}

# For dynamic internal attributes (eg. meta information for attributes) we match by the beginning of the key.
PROFILE_FUNCTIONS_PRIVATE_ATTRIBUTE_PREFIXES: set[str] = {constants.META_PREFIX}

PROFILE_FUNCTIONS_REPLACEMENT_ATTRIBUTES: set[str] = {
    definition.replacement
    for definition in PROFILE_FUNCTIONS_ATTRIBUTE_DEFINITIONS.values()
    if definition.replacement
}

PROFILE_FUNCTIONS_REPLACEMENT_MAP: dict[str, str] = {
    definition.public_alias: definition.replacement
    for definition in PROFILE_FUNCTIONS_ATTRIBUTE_DEFINITIONS.values()
    if definition.replacement
}
PROFILE_FUNCTIONS_INTERNAL_TO_SECONDARY_ALIASES_MAPPING: dict[str, set[str]] = {}

for definition in PROFILE_FUNCTIONS_ATTRIBUTE_DEFINITIONS.values():
    if not definition.secondary_alias:
        continue

    secondary_aliases = PROFILE_FUNCTIONS_INTERNAL_TO_SECONDARY_ALIASES_MAPPING.get(
        definition.internal_name, set()
    )
    secondary_aliases.add(definition.public_alias)
    PROFILE_FUNCTIONS_INTERNAL_TO_SECONDARY_ALIASES_MAPPING[definition.internal_name] = (
        secondary_aliases
    )
