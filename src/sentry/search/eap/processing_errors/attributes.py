from sentry.search.eap.columns import ResolvedAttribute
from sentry.search.eap.common_columns import COMMON_COLUMNS

PROCESSING_ERROR_ATTRIBUTE_DEFINITIONS = {
    column.public_alias: column
    for column in COMMON_COLUMNS
    + [
        ResolvedAttribute(
            public_alias="id",
            internal_name="sentry.item_id",
            search_type="string",
        ),
        ResolvedAttribute(
            public_alias="trace",
            internal_name="sentry.trace_id",
            search_type="string",
        ),
        ResolvedAttribute(
            public_alias="event_id",
            internal_name="event_id",
            search_type="string",
        ),
        ResolvedAttribute(
            public_alias="error_type",
            internal_name="error_type",
            search_type="string",
        ),
        ResolvedAttribute(
            public_alias="symbolicator_type",
            internal_name="symbolicator_type",
            search_type="string",
        ),
        ResolvedAttribute(
            public_alias="release",
            internal_name="release",
            search_type="string",
        ),
        ResolvedAttribute(
            public_alias="environment",
            internal_name="environment",
            search_type="string",
        ),
        ResolvedAttribute(
            public_alias="platform",
            internal_name="platform",
            search_type="string",
        ),
        ResolvedAttribute(
            public_alias="sdk_name",
            internal_name="sdk_name",
            search_type="string",
        ),
        ResolvedAttribute(
            public_alias="sdk_version",
            internal_name="sdk_version",
            search_type="string",
        ),
        ResolvedAttribute(
            public_alias="title",
            internal_name="title",
            search_type="string",
        ),
        ResolvedAttribute(
            public_alias="group_id",
            internal_name="group_id",
            search_type="integer",
        ),
    ]
}
