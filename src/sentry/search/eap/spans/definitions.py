from sentry_protos.snuba.v1.request_common_pb2 import TraceItemType

from sentry.search.eap.columns import ColumnDefinitions
from sentry.search.eap.spans.aggregates import SPAN_AGGREGATE_DEFINITIONS
from sentry.search.eap.spans.attributes import SPAN_ATTRIBUTE_DEFINITIONS, SPAN_VIRTUAL_CONTEXTS
from sentry.search.eap.spans.formulas import SPAN_FORMULA_DEFINITIONS

SPAN_DEFINITIONS = ColumnDefinitions(
    aggregates=SPAN_AGGREGATE_DEFINITIONS,
    formulas=SPAN_FORMULA_DEFINITIONS,
    columns=SPAN_ATTRIBUTE_DEFINITIONS,
    contexts=SPAN_VIRTUAL_CONTEXTS,
    trace_item_type=TraceItemType.TRACE_ITEM_TYPE_SPAN,
)
