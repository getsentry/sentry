from sentry_protos.snuba.v1.request_common_pb2 import TraceItemType

from sentry.search.eap.columns import ColumnDefinitions
from sentry.search.eap.profile_functions.aggregates import PROFILE_FUNCTIONS_AGGREGATE_DEFINITIONS
from sentry.search.eap.profile_functions.attributes import (
    PROFILE_FUNCTIONS_ATTRIBUTE_DEFINITIONS,
    PROFILE_FUNCTIONS_VIRTUAL_CONTEXTS,
)

PROFILE_FUNCTIONS_DEFINITIONS = ColumnDefinitions(
    aggregates=PROFILE_FUNCTIONS_AGGREGATE_DEFINITIONS,
    formulas={},
    columns=PROFILE_FUNCTIONS_ATTRIBUTE_DEFINITIONS,
    contexts=PROFILE_FUNCTIONS_VIRTUAL_CONTEXTS,
    trace_item_type=TraceItemType.TRACE_ITEM_TYPE_PROFILE_FUNCTION,
    filter_aliases={},
    column_to_alias=None,
    alias_to_column=None,
)
