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
            "count():<10",
            "(count(span.duration):<10) AND is_transaction:1",
        ),
        pytest.param(
            "sum(c:spans/ai.total_cost@usd):<10",
            "(sum(ai.total_cost):<10) AND is_transaction:1",
        ),
        pytest.param(
            "event.type:transaction AND has:measurement.lcp",
            "(is_transaction:1 AND has:measurement.lcp) AND is_transaction:1",
        ),
        pytest.param(
            "title:/api/0/foo AND http.method:POST",
            "(transaction:/api/0/foo AND transaction.method:POST) AND is_transaction:1",
        ),
        pytest.param(
            "title:tasks.spike_protection.run_spike_projection",
            "(transaction:tasks.spike_protection.run_spike_projection) AND is_transaction:1",
        ),
        pytest.param(
            "geo.country_code:US AND geo.city:San Francisco",
            "(user.geo.country_code:US AND user.geo.city:San Francisco) AND is_transaction:1",
        ),
        pytest.param(
            "percentile(transaction.duration,0.5000):>100 AND percentile(transaction.duration, 0.25):>20",
            "(p50(span.duration):>100 AND percentile(span.duration, 0.25):>20) AND is_transaction:1",
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
            ["geo.country_code", "geo.city", "geo.region", "geo.subdivision", "geo.subregion"],
            [
                "user.geo.country_code",
                "user.geo.city",
                "user.geo.region",
                "user.geo.subdivision",
                "user.geo.subregion",
            ],
        ),
        pytest.param(
            ["count()", "avg(transaction.duration)"],
            ["count(span.duration)", "avg(span.duration)"],
        ),
        pytest.param(
            ["avgIf(transaction.duration,greater,300)"],
            ["avgIf(span.duration,greater,300)"],
        ),
        pytest.param(
            ["percentile(transaction.duration,0.5000)", "percentile(transaction.duration,0.94)"],
            ["p50(span.duration)", "percentile(span.duration,0.94)"],
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
