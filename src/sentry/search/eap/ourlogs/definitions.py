from sentry_protos.snuba.v1.request_common_pb2 import TraceItemType

from sentry.search.eap.columns import ColumnDefinitions
from sentry.search.eap.ourlogs.attributes import (
    OURLOG_ATTRIBUTE_DEFINITIONS,
    OURLOG_VIRTUAL_CONTEXTS,
)
from sentry.search.eap.spans.aggregates import LOG_AGGREGATE_DEFINITIONS

OURLOG_DEFINITIONS = ColumnDefinitions(
    aggregates=LOG_AGGREGATE_DEFINITIONS,
    conditional_aggregates={},
    formulas={},
    columns=OURLOG_ATTRIBUTE_DEFINITIONS,
    contexts=OURLOG_VIRTUAL_CONTEXTS,
    trace_item_type=TraceItemType.TRACE_ITEM_TYPE_LOG,
    filter_aliases={},
)
