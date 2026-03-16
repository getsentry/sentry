from sentry_protos.snuba.v1.request_common_pb2 import TraceItemType

from sentry.search.eap.columns import ColumnDefinitions
from sentry.search.eap.occurrences.aggregates import OCCURRENCE_AGGREGATE_DEFINITIONS
from sentry.search.eap.occurrences.attributes import (
    OCCURRENCE_ATTRIBUTE_DEFINITIONS,
    OCCURRENCE_VIRTUAL_CONTEXTS,
)
from sentry.search.eap.occurrences.formulas import OCCURRENCE_FORMULA_DEFINITIONS

OCCURRENCE_DEFINITIONS = ColumnDefinitions(
    aggregates=OCCURRENCE_AGGREGATE_DEFINITIONS,
    formulas=OCCURRENCE_FORMULA_DEFINITIONS,
    columns=OCCURRENCE_ATTRIBUTE_DEFINITIONS,
    contexts=OCCURRENCE_VIRTUAL_CONTEXTS,
    trace_item_type=TraceItemType.TRACE_ITEM_TYPE_OCCURRENCE,
    filter_aliases={},
    alias_to_column=None,
    column_to_alias=None,
)
