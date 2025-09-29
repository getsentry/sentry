from sentry_protos.snuba.v1.request_common_pb2 import TraceItemType

from sentry.search.eap.columns import ColumnDefinitions
from sentry.search.eap.tracemetrics.aggregates import TRACEMETRICS_AGGREGATE_DEFINITIONS
from sentry.search.eap.tracemetrics.attributes import (
    TRACEMETRICS_ATTRIBUTE_DEFINITIONS,
    TRACEMETRICS_VIRTUAL_CONTEXTS,
    tracemetrics_column_to_custom_alias,
    tracemetrics_custom_alias_to_column,
)

TRACEMETRICS_DEFINITIONS = ColumnDefinitions(
    aggregates=TRACEMETRICS_AGGREGATE_DEFINITIONS,
    conditional_aggregates={},
    formulas={},
    columns=TRACEMETRICS_ATTRIBUTE_DEFINITIONS,
    contexts=TRACEMETRICS_VIRTUAL_CONTEXTS,
    trace_item_type=TraceItemType.TRACE_ITEM_TYPE_METRIC,
    filter_aliases={},
    alias_to_column=tracemetrics_custom_alias_to_column,
    column_to_alias=tracemetrics_column_to_custom_alias,
)
