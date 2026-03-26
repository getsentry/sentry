from sentry_protos.snuba.v1.trace_item_attribute_pb2 import ExtrapolationMode

from sentry.search.eap.columns import FormulaDefinition
from sentry.search.eap.common_formulas import make_epm, make_eps
from sentry.search.eap.occurrences.aggregates import OCCURRENCE_GROUP_ID_KEY

OCCURRENCE_FORMULA_DEFINITIONS = {
    "eps": FormulaDefinition(
        default_search_type="rate",
        arguments=[],
        formula_resolver=make_eps(OCCURRENCE_GROUP_ID_KEY),
        is_aggregate=True,
    ),
    "epm": FormulaDefinition(
        default_search_type="rate",
        arguments=[],
        formula_resolver=make_epm(OCCURRENCE_GROUP_ID_KEY),
        is_aggregate=True,
    ),
    "sample_eps": FormulaDefinition(
        default_search_type="rate",
        arguments=[],
        formula_resolver=make_eps(OCCURRENCE_GROUP_ID_KEY),
        is_aggregate=True,
        extrapolation_mode_override=ExtrapolationMode.EXTRAPOLATION_MODE_NONE,
    ),
    "sample_epm": FormulaDefinition(
        default_search_type="rate",
        arguments=[],
        formula_resolver=make_epm(OCCURRENCE_GROUP_ID_KEY),
        is_aggregate=True,
        extrapolation_mode_override=ExtrapolationMode.EXTRAPOLATION_MODE_NONE,
    ),
}
