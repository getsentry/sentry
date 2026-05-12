from sentry_protos.snuba.v1.request_common_pb2 import TraceItemType

from sentry.search.eap.columns import ColumnDefinitions
from sentry.search.eap.replays.aggregates import REPLAYS_AGGREGATE_DEFINITIONS
from sentry.search.eap.replays.attributes import REPLAYS_ATTRIBUTE_DEFINITIONS

REPLAYS_DEFINITIONS = ColumnDefinitions(
    aggregates=REPLAYS_AGGREGATE_DEFINITIONS,
    formulas={},
    columns=REPLAYS_ATTRIBUTE_DEFINITIONS,
    contexts={},
    trace_item_type=TraceItemType.TRACE_ITEM_TYPE_REPLAY,
    filter_aliases={},
    column_to_alias=None,
    alias_to_column=None,
)
