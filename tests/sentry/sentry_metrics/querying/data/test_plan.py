import pytest

from sentry.sentry_metrics.querying.data import MetricsQueriesPlan


@pytest.mark.parametrize(
    "formula, queries, expected_formula",
    [
        ("$a + $b", {"a": "query_1", "b": "query_2"}, "query_1 + query_2"),
        ("$a + $b + $c", {"a": "query_1", "b": "query_2"}, "query_1 + query_2 + $c"),
        (
            "$a / $aa + $ab * $b",
            {"a": "query_1", "b": "query_2", "aa": "query_3", "ab": "query_4"},
            "query_1 / query_3 + query_4 * query_2",
        ),
    ],
)
def test_get_replaced_formulas(formula, queries, expected_formula):
    plan = MetricsQueriesPlan()
    for query_name, query in queries.items():
        plan.declare_query(query_name, query)

    plan.apply_formula(formula)

    replaced_formulas = plan.get_replaced_formulas()
    assert len(replaced_formulas) == 1
    assert replaced_formulas[0].mql == expected_formula
