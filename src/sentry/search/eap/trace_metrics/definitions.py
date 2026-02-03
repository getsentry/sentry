from sentry_protos.snuba.v1.request_common_pb2 import TraceItemType

from sentry.search.eap.columns import ColumnDefinitions
from sentry.search.eap.trace_metrics.aggregates import TRACE_METRICS_AGGREGATE_DEFINITIONS
from sentry.search.eap.trace_metrics.attributes import (
    TRACE_METRICS_ATTRIBUTE_DEFINITIONS,
    TRACE_METRICS_VIRTUAL_CONTEXTS,
)
from sentry.search.eap.trace_metrics.formulas import TRACE_METRICS_FORMULA_DEFINITIONS

TRACE_METRICS_DEFINITIONS = ColumnDefinitions(
    aggregates=TRACE_METRICS_AGGREGATE_DEFINITIONS,
    formulas=TRACE_METRICS_FORMULA_DEFINITIONS,
    columns=TRACE_METRICS_ATTRIBUTE_DEFINITIONS,
    contexts=TRACE_METRICS_VIRTUAL_CONTEXTS,
    trace_item_type=TraceItemType.TRACE_ITEM_TYPE_METRIC,
    filter_aliases={},
    column_to_alias=None,
    alias_to_column=None,
)
