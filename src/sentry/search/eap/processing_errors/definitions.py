from sentry_protos.snuba.v1.request_common_pb2 import TraceItemType

from sentry.search.eap.columns import ColumnDefinitions
from sentry.search.eap.processing_errors.aggregates import PROCESSING_ERROR_AGGREGATE_DEFINITIONS
from sentry.search.eap.processing_errors.attributes import PROCESSING_ERROR_ATTRIBUTE_DEFINITIONS

PROCESSING_ERROR_DEFINITIONS = ColumnDefinitions(
    aggregates=PROCESSING_ERROR_AGGREGATE_DEFINITIONS,
    formulas={},
    columns=PROCESSING_ERROR_ATTRIBUTE_DEFINITIONS,
    contexts={},
    trace_item_type=TraceItemType.TRACE_ITEM_TYPE_PROCESSING_ERROR,
    filter_aliases={},
    alias_to_column=None,
    column_to_alias=None,
)
