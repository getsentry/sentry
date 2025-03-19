import pytest

from sentry.discover.translation.mep_to_eap import QueryParts, translate_mep_to_eap


@pytest.mark.parametrize(
    "input,expected",
    [
        pytest.param(
            "",
            "is_transaction:1",
        ),
        pytest.param(
            "avg(transaction.duration):<10 OR transaction.duration:11",
            "(avg(span.duration):<10 OR span.duration:11) AND is_transaction:1",
        ),
        pytest.param(
            "has:transaction.duration OR has:measurement.lcp",
            "(has:span.duration OR has:measurement.lcp) AND is_transaction:1",
        ),
        pytest.param(
            "tags[foo]:10 OR transaction.duration:11",
            "(tags[foo]:10 OR span.duration:11) AND is_transaction:1",
        ),
        pytest.param(
            "(tags[foo]:10 OR transaction.duration:11) AND (p95(span.duration):<10)",
            "((tags[foo]:10 OR span.duration:11) AND (p95(span.duration):<10)) AND is_transaction:1",
        ),
        pytest.param(
            "count(   ):<10",
            "(count(span.duration):<10) AND is_transaction:1",
        ),
        pytest.param(
            "sum(c:spans/ai.total_cost@usd):<10",
            "(sum(ai.total_cost):<10) AND is_transaction:1",
        ),
    ],
)
def test_mep_to_eap_simple_query(input: str, expected: str):
    old = QueryParts(
        selected_columns=["id"],
        query=input,
        equations=[],
        orderby=[],
    )
    translated = translate_mep_to_eap(old)

    assert translated["query"] == expected


@pytest.mark.parametrize(
    "input,expected",
    [
        pytest.param(
            ["transaction.duration"],
            ["span.duration"],
        ),
        pytest.param(
            ["count()", "avg(transaction.duration)"],
            ["count(span.duration)", "avg(span.duration)"],
        ),
        pytest.param(
            ["avgIf(transaction.duration,greater,300)"],
            ["avgIf(span.duration,greater,300)"],
        ),
    ],
)
def test_mep_to_eap_simple_selected_columns(input: list[str], expected: list[str]):
    old = QueryParts(
        selected_columns=input,
        query="",
        equations=[],
        orderby=[],
    )
    translated = translate_mep_to_eap(old)

    assert translated["selected_columns"] == expected
