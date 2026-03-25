"""Test Occurrences related utils in SearchResolver"""

from sentry.api import event_search
from sentry.api.event_search import SearchFilter, SearchKey, SearchValue
from sentry.search.eap.resolver import collect_issue_short_ids_from_parsed_terms


def test_collect_issue_short_ids_flat_and_parens() -> None:
    terms = [
        SearchFilter(SearchKey("issue"), "=", SearchValue("PROJ-1")),
        event_search.SearchBoolean.BOOLEAN_OR,
        SearchFilter(SearchKey("issue"), "=", SearchValue("PROJ-2")),
    ]
    assert collect_issue_short_ids_from_parsed_terms(terms) == {"PROJ-1", "PROJ-2"}


def test_collect_issue_short_ids_nested() -> None:
    inner = [
        SearchFilter(SearchKey("issue"), "=", SearchValue("A-1")),
        event_search.SearchBoolean.BOOLEAN_OR,
        SearchFilter(SearchKey("issue"), "=", SearchValue("B-2")),
    ]
    terms = [event_search.ParenExpression(inner)]
    assert collect_issue_short_ids_from_parsed_terms(terms) == {"A-1", "B-2"}


def test_collect_issue_skips_empty_and_other_keys() -> None:
    terms = [
        SearchFilter(SearchKey("environment"), "=", SearchValue("prod")),
        SearchFilter(SearchKey("issue"), "!=", SearchValue("")),
    ]
    assert collect_issue_short_ids_from_parsed_terms(terms) == set()
