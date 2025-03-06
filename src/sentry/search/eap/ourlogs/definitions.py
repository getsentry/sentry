from sentry_protos.snuba.v1.request_common_pb2 import TraceItemType

from sentry.search.eap.columns import ColumnDefinitions
from sentry.search.eap.ourlogs.attributes import (
    OURLOG_ATTRIBUTE_DEFINITIONS,
    OURLOG_VIRTUAL_CONTEXTS,
)

OURLOG_DEFINITIONS = ColumnDefinitions(
    aggregates={},
    formulas={},
    columns=OURLOG_ATTRIBUTE_DEFINITIONS,
    contexts=OURLOG_VIRTUAL_CONTEXTS,
    trace_item_type=TraceItemType.TRACE_ITEM_TYPE_LOG,
)
