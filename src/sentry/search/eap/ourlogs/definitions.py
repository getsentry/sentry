from sentry_protos.snuba.v1.request_common_pb2 import TraceItemType

from sentry.search.eap.columns import ColumnDefinitions
from sentry.search.eap.ourlogs.aggregates import LOG_AGGREGATE_DEFINITIONS
from sentry.search.eap.ourlogs.attributes import (
    OURLOG_ATTRIBUTE_DEFINITIONS,
    OURLOG_VIRTUAL_CONTEXTS,
    ourlog_column_to_custom_alias,
    ourlog_custom_alias_to_column,
)

OURLOG_DEFINITIONS = ColumnDefinitions(
    aggregates=LOG_AGGREGATE_DEFINITIONS,
    formulas={},
    columns=OURLOG_ATTRIBUTE_DEFINITIONS,
    contexts=OURLOG_VIRTUAL_CONTEXTS,
    trace_item_type=TraceItemType.TRACE_ITEM_TYPE_LOG,
    filter_aliases={},
    alias_to_column=ourlog_custom_alias_to_column,
    column_to_alias=ourlog_column_to_custom_alias,
)
