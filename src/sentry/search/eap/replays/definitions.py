from sentry_protos.snuba.v1.request_common_pb2 import TraceItemType

from sentry.search.eap.columns import ColumnDefinitions
from sentry.search.eap.replays.attributes import (
    REPLAY_ATTRIBUTE_DEFINITIONS,
    REPLAY_VIRTUAL_CONTEXTS,
)

REPLAY_DEFINITIONS = ColumnDefinitions(
    aggregates={},
    conditional_aggregates={},
    formulas={},
    columns=REPLAY_ATTRIBUTE_DEFINITIONS,
    contexts=REPLAY_VIRTUAL_CONTEXTS,
    trace_item_type=TraceItemType.TRACE_ITEM_TYPE_REPLAY,
    filter_aliases={},
    column_to_alias=None,
    alias_to_column=None,
)
