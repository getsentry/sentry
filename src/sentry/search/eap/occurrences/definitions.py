from sentry_protos.snuba.v1.request_common_pb2 import TraceItemType

from sentry.search.eap.columns import ColumnDefinitions, ResolvedAttribute
from sentry.search.eap.common_columns import COMMON_COLUMNS
from sentry.search.eap.spans.aggregates import SPAN_AGGREGATE_DEFINITIONS

OCCURRENCE_COLUMNS = {
    column.public_alias: column
    for column in (
        COMMON_COLUMNS
        + [
            ResolvedAttribute(
                public_alias="id",
                internal_name="sentry.item_id",
                search_type="string",
            ),
            ResolvedAttribute(
                public_alias="group_id",
                internal_name=f"group_id",
                search_type="integer",
            ),
        ]
    )
}

OCCURRENCE_DEFINITIONS = ColumnDefinitions(
    aggregates=SPAN_AGGREGATE_DEFINITIONS,
    formulas={},
    columns=OCCURRENCE_COLUMNS,
    contexts={},
    trace_item_type=TraceItemType.TRACE_ITEM_TYPE_OCCURRENCE,
    filter_aliases={},
    alias_to_column=None,
    column_to_alias=None,
)
