from sentry.search.eap.columns import ResolvedAttribute, simple_sentry_field
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
        # Copied from the classified telemetry, see TelemetryInput.copied_attributes.
        simple_sentry_field("environment"),
        simple_sentry_field("release"),
        simple_sentry_field("user"),
        simple_sentry_field("user.email"),
        simple_sentry_field("user.id"),
        simple_sentry_field("user.ip"),
        simple_sentry_field("user.username"),
    ]
}
