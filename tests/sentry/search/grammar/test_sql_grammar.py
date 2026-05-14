import pytest

from sentry.search.grammar.sql import Condition, OrderBy, ParsedQuery, parse_sql_query


@pytest.mark.parametrize(
    ("query", "expected"),
    [
        (
            "SELECT foo, bar FROM logs",
            ParsedQuery(
                fields=["foo", "bar"],
                dataset="logs",
                where=[],
                orderby=[],
            ),
        ),
        (
            "SELECT foo, bar FROM logs WHERE bar=2",
            ParsedQuery(
                fields=["foo", "bar"],
                dataset="logs",
                where=[Condition(column="bar", operator="=", value="2")],
                orderby=[],
            ),
        ),
        (
            "SELECT foo, bar FROM logs ORDER BY foo ASC",
            ParsedQuery(
                fields=["foo", "bar"],
                dataset="logs",
                where=[],
                orderby=[OrderBy(column="foo", direction="ASC")],
            ),
        ),
    ],
)
def test_search_filter_to_query_string(query, expected) -> None:
    parsed_query = parse_sql_query(query)

    assert parsed_query == expected, parsed_query
