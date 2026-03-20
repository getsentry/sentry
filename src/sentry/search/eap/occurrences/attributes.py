from sentry_protos.snuba.v1.trace_item_attribute_pb2 import VirtualColumnContext

from sentry.models.group import Group
from sentry.search.eap import constants
from sentry.search.eap.columns import (
    ResolvedAttribute,
    VirtualColumnDefinition,
    datetime_processor,
    project_term_resolver,
)
from sentry.search.eap.common_columns import COMMON_COLUMNS, project_virtual_contexts
from sentry.search.events.types import SnubaParams
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
        ]
    )
}


def issue_context_constructor(params: SnubaParams) -> VirtualColumnContext:
    if params.project_ids is None or len(params.project_ids) == 0:
        raise ValueError("Project IDs required for Issue")
    groups = Group.objects.filter(
        project_id__in=params.project_ids,
    )
    return VirtualColumnContext(
        from_column_name="group_id",
        to_column_name="issue",
        value_map={
            str(group.id): group.qualified_short_id
            for group in groups
            if group.qualified_short_id is not None
        },
    )


OCCURRENCE_VIRTUAL_CONTEXTS = {
    **project_virtual_contexts(),
    "issue": VirtualColumnDefinition(
        constructor=issue_context_constructor,
        filter_column="group_id",
        term_resolver=project_term_resolver,
    ),
}
