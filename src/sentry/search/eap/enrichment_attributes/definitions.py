from sentry_protos.snuba.v1.request_common_pb2 import TraceItemType

from sentry.search.eap.columns import ColumnDefinitions
from sentry.search.eap.enrichment_attributes.aggregates import ENRICHMENT_AGGREGATE_DEFINITIONS
from sentry.search.eap.enrichment_attributes.attributes import ENRICHMENT_ATTRIBUTE_DEFINITIONS

ENRICHMENT_DEFINITIONS = ColumnDefinitions(
    aggregates=ENRICHMENT_AGGREGATE_DEFINITIONS,
    formulas={},
    columns=ENRICHMENT_ATTRIBUTE_DEFINITIONS,
    contexts={},
    trace_item_type=TraceItemType.TRACE_ITEM_TYPE_ENRICHMENT_ATTRIBUTES,
    filter_aliases={},
    alias_to_column=None,
    column_to_alias=None,
)
