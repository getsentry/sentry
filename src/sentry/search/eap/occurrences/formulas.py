from sentry_protos.snuba.v1.trace_item_attribute_pb2 import AttributeKey

from sentry.search.eap.columns import FormulaDefinition
from sentry.search.eap.common_formulas import make_epm, make_eps

# group_id is always present on occurrences (OCCURRENCES_ALWAYS_PRESENT_ATTRIBUTES).
_OCCURRENCE_COUNT_KEY = AttributeKey(
    name="group_id",
    type=AttributeKey.Type.TYPE_INT,
)

OCCURRENCE_FORMULA_DEFINITIONS = {
    "eps": FormulaDefinition(
        default_search_type="rate",
        arguments=[],
        formula_resolver=make_eps(_OCCURRENCE_COUNT_KEY),
        is_aggregate=True,
    ),
    "epm": FormulaDefinition(
        default_search_type="rate",
        arguments=[],
        formula_resolver=make_epm(_OCCURRENCE_COUNT_KEY),
        is_aggregate=True,
    ),
}
