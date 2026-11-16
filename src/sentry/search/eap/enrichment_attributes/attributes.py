from sentry.search.eap.columns import ResolvedAttribute
from sentry.search.eap.common_columns import COMMON_COLUMNS

ENRICHMENT_ATTRIBUTE_DEFINITIONS = {
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
    ]
}
