from sentry_protos.snuba.v1.request_common_pb2 import TraceItemType

from sentry.search.eap.columns import ColumnDefinitions
from sentry.search.eap.preprod_size.aggregates import PREPROD_SIZE_AGGREGATE_DEFINITIONS
from sentry.search.eap.preprod_size.attributes import PREPROD_SIZE_ATTRIBUTE_DEFINITIONS

PREPROD_SIZE_DEFINITIONS = ColumnDefinitions(
    aggregates=PREPROD_SIZE_AGGREGATE_DEFINITIONS,
    formulas={},
    columns=PREPROD_SIZE_ATTRIBUTE_DEFINITIONS,
    contexts={},
    trace_item_type=TraceItemType.TRACE_ITEM_TYPE_PREPROD,
    filter_aliases={},
    alias_to_column=None,
    column_to_alias=None,
)
