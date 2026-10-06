from sentry_protos.snuba.v1.request_common_pb2 import TraceItemType

from sentry.search.eap.columns import ColumnDefinitions
from sentry.search.eap.spans.aggregates import (
    DEPRECATED_SPAN_AGGREGATE_DEFINITIONS,
    SPAN_AGGREGATE_DEFINITIONS,
)
from sentry.search.eap.spans.attributes import SPAN_ATTRIBUTE_DEFINITIONS, SPAN_VIRTUAL_CONTEXTS
from sentry.search.eap.spans.filter_aliases import SPAN_FILTER_ALIAS_DEFINITIONS
from sentry.search.eap.spans.formulas import SPAN_FORMULA_DEFINITIONS
from sentry.search.eap.types import FieldsACL

SPAN_DEFINITIONS = ColumnDefinitions(
    aggregates=SPAN_AGGREGATE_DEFINITIONS,
    formulas=SPAN_FORMULA_DEFINITIONS,
    columns=SPAN_ATTRIBUTE_DEFINITIONS,
    contexts=SPAN_VIRTUAL_CONTEXTS,
    trace_item_type=TraceItemType.TRACE_ITEM_TYPE_SPAN,
    filter_aliases=SPAN_FILTER_ALIAS_DEFINITIONS,
    column_to_alias=None,
    alias_to_column=None,
    aggregate_deprecations=DEPRECATED_SPAN_AGGREGATE_DEFINITIONS,
)

# Private fields that user-facing span queries may still use. Every endpoint
# that resolves span queries on behalf of Explore must grant the same set, or
# the validate endpoint will reject a query the events endpoint accepts.
SPAN_FIELDS_ACL = FieldsACL(functions={"time_spent_percentage"}, attributes={"sentry.links"})
