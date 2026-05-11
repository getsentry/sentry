from sentry_protos.snuba.v1.request_common_pb2 import TraceItemType

from sentry.eventstream.item_helpers import format_attr_key
from sentry.search.eap.columns import ColumnDefinitions
from sentry.search.eap.occurrences.aggregates import OCCURRENCE_AGGREGATE_DEFINITIONS
from sentry.search.eap.occurrences.attributes import (
    OCCURRENCE_ATTRIBUTE_DEFINITIONS,
    OCCURRENCE_VIRTUAL_CONTEXTS,
)
from sentry.search.eap.occurrences.filter_aliases import OCCURRENCE_FILTER_ALIASES
from sentry.search.eap.occurrences.formulas import OCCURRENCE_FORMULA_DEFINITIONS


def _occurrence_alias_to_column(field: str) -> str | None:
    """
    Map user-defined tag names to the EAP ingestion format `attr[{field}]`
    so the resolver produces the correct internal attribute name.
    """
    return format_attr_key(field)


OCCURRENCE_DEFINITIONS = ColumnDefinitions(
    aggregates=OCCURRENCE_AGGREGATE_DEFINITIONS,
    formulas=OCCURRENCE_FORMULA_DEFINITIONS,
    columns=OCCURRENCE_ATTRIBUTE_DEFINITIONS,
    contexts=OCCURRENCE_VIRTUAL_CONTEXTS,
    trace_item_type=TraceItemType.TRACE_ITEM_TYPE_OCCURRENCE,
    filter_aliases=OCCURRENCE_FILTER_ALIASES,
    alias_to_column=_occurrence_alias_to_column,
    column_to_alias=None,
)
