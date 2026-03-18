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
}
