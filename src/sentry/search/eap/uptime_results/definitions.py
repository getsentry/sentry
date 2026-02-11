from sentry_protos.snuba.v1.request_common_pb2 import TraceItemType

from sentry.search.eap.columns import ColumnDefinitions
from sentry.search.eap.uptime_results.attributes import UPTIME_ATTRIBUTE_DEFINITIONS

UPTIME_RESULT_DEFINITIONS = ColumnDefinitions(
    aggregates={},
    formulas={},
    columns=UPTIME_ATTRIBUTE_DEFINITIONS,
    contexts={},
    trace_item_type=TraceItemType.TRACE_ITEM_TYPE_UPTIME_RESULT,
    filter_aliases={},
    alias_to_column=None,
    column_to_alias=None,
)
