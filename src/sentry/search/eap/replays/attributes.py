from sentry.search.eap.columns import (
    ResolvedAttribute,
)
from sentry.search.eap.common_columns import COMMON_COLUMNS

REPLAYS_ATTRIBUTE_DEFINITIONS = {
    column.public_alias: column
    for column in COMMON_COLUMNS
    + [
        ResolvedAttribute(
            public_alias="replay.id",
            internal_name="replay_id",
            search_type="string",
        ),
        ResolvedAttribute(
            public_alias="replay.category",
            internal_name="category",
            search_type="string",
        ),
        ResolvedAttribute(
            public_alias="replay.url",
            internal_name="to",
            search_type="string",
        ),
        ResolvedAttribute(
            public_alias="transaction.span_id",
            internal_name="segment_id",
            search_type="integer",
        ),
        ResolvedAttribute(
            public_alias="dead_clicks",
            internal_name="is_dead",
            search_type="integer",
        ),
        ResolvedAttribute(
            public_alias="rage_clicks",
            internal_name="is_rage",
            search_type="integer",
        ),
    ]
}
