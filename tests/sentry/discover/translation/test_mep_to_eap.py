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
    ],
)
def test_mep_to_eap_simple(input: str, expected: str):
    old = QueryParts(
        selected_columns=["id", "transaction.duration"],
        query=input,
        equations=[],
        orderby=[],
    )
    translated = translate_mep_to_eap(old)

    assert translated["query"] == expected
