import pytest

from sentry.sentry_metrics.querying.data import MQLQuery
from sentry.sentry_metrics.querying.errors import InvalidMetricsQueryError


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
def test_compile_mql_query(formula, queries, expected_formula):
    sub_queries = {name: MQLQuery(query) for name, query in queries.items()}
    compiled_query = MQLQuery(formula, **sub_queries).compile()  # type: ignore[arg-type]
    assert compiled_query.mql == expected_formula


def test_compile_mql_query_with_wrong_sub_queries():
    with pytest.raises(InvalidMetricsQueryError):
        MQLQuery("$query_1 * 2", query_1="sum(duration)").compile()
