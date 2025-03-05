from typing import Literal

from sentry_protos.snuba.v1.request_common_pb2 import TraceItemType

from sentry.search.eap.columns import ColumnDefinitions
from sentry.search.eap.span_column_definitions.aggregates import SPAN_AGGREGATE_DEFINITIONS
from sentry.search.eap.span_column_definitions.attributes import SPAN_ATTRIBUTE_DEFINITIONS
from sentry.search.eap.span_column_definitions.contexts import SPAN_VIRTUAL_CONTEXTS
from sentry.search.eap.span_column_definitions.formulas import SPAN_FORMULA_DEFINITIONS

INTERNAL_TO_PUBLIC_ALIAS_MAPPINGS: dict[Literal["string", "number"], dict[str, str]] = {
    "string": {
        definition.internal_name: definition.public_alias
        for definition in SPAN_ATTRIBUTE_DEFINITIONS.values()
        if not definition.secondary_alias and definition.search_type == "string"
    }
    | {
        # sentry.service is the project id as a string, but map to project for convenience
        "sentry.service": "project",
    },
    "number": {
        definition.internal_name: definition.public_alias
        for definition in SPAN_ATTRIBUTE_DEFINITIONS.values()
        if not definition.secondary_alias and definition.search_type != "string"
    },
}


def translate_internal_to_public_alias(
    internal_alias: str,
    type: Literal["string", "number"],
) -> str | None:
    mappings = INTERNAL_TO_PUBLIC_ALIAS_MAPPINGS.get(type, {})
    return mappings.get(internal_alias)


SPAN_DEFINITIONS = ColumnDefinitions(
    aggregates=SPAN_AGGREGATE_DEFINITIONS,
    formulas=SPAN_FORMULA_DEFINITIONS,
    columns=SPAN_ATTRIBUTE_DEFINITIONS,
    contexts=SPAN_VIRTUAL_CONTEXTS,
    trace_item_type=TraceItemType.TRACE_ITEM_TYPE_SPAN,
)
