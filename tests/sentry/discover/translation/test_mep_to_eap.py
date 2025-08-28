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
            "(p50(span.duration):>100 AND p50(span.duration):>20) AND is_transaction:1",
        ),
        pytest.param(
            "user_misery():>0.5 OR apdex():>0.5",
            "(user_misery(span.duration,300):>0.5 OR apdex(span.duration,300):>0.5) AND is_transaction:1",
        ),
        pytest.param(
            "apdex(1000):>0.5 OR user_misery(1000):>0.5",
            "(apdex(span.duration,1000):>0.5 OR user_misery(span.duration,1000):>0.5) AND is_transaction:1",
        ),
        pytest.param(
            "platform.name:python",
            "(platform:python) AND is_transaction:1",
        ),
    ],
)
def test_mep_to_eap_simple_query(input: str, expected: str) -> None:
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
            [
                "percentile(transaction.duration,0.5000)",
                "percentile(transaction.duration,0.94)",
                "percentile(transaction.duration,0.9999)",
                "percentile(transaction.duration, 0.625)",
            ],
            [
                "p50(span.duration)",
                "p95(span.duration)",
                "p100(span.duration)",
                "p75(span.duration)",
            ],
        ),
        pytest.param(
            ["user_misery(300)", "apdex(300)"],
            ["user_misery(span.duration,300)", "apdex(span.duration,300)"],
        ),
        pytest.param(
            ["any(transaction.duration)", "count_miserable(user,300)", "transaction", "count()"],
            ["transaction", "count(span.duration)"],
        ),
        pytest.param(
            ["platform.name", "count()"],
            ["platform", "count(span.duration)"],
        ),
    ],
)
def test_mep_to_eap_simple_selected_columns(input: list[str], expected: list[str]) -> None:
    old = QueryParts(
        selected_columns=input,
        query="",
        equations=[],
        orderby=[],
    )
    translated = translate_mep_to_eap(old)

    assert translated["selected_columns"] == expected


@pytest.mark.parametrize(
    "input,expected",
    [
        pytest.param(
            ["equation|count() + 5"],
            ["equation|count(span.duration) + 5"],
        ),
        pytest.param(
            [
                "equation|user_misery(300) + count()",
            ],
            ["equation|user_misery(span.duration,300) + count(span.duration)"],
        ),
        pytest.param(
            [
                "equation|sum(transaction.duration) + 5",
                "equation|percentile(transaction.duration,0.437)",
            ],
            ["equation|sum(span.duration) + 5", "equation|p50(span.duration)"],
        ),
        pytest.param(
            ["equation|count(span.duration) + 5", "equation|count_web_vitals(user,300) * 3"],
            ["equation|count(span.duration) + 5"],
        ),
        pytest.param(
            ["equation|count(span.duration) + total.count", "equation|count_miserable(user,300)"],
            [],
        ),
        pytest.param(
            ["equation|transaction.duration * 2"],
            ["equation|span.duration * 2"],
        ),
        pytest.param(
            ["equation|(sum(transaction.duration) + 5) + count_miserable(user,300)"],
            [],
        ),
        pytest.param(
            [
                "equation|(avg(transaction.duration) * 2) + p50(span.duration)",
                "equation|(count_unique(title) / 4) * (count_unique(http.method) * 2)",
                "equation|(total.count * 2) - count()",
            ],
            [
                "equation|(avg(span.duration) * 2) + p50(span.duration)",
                "equation|(count_unique(transaction) / 4) * (count_unique(transaction.method) * 2)",
            ],
        ),
    ],
)
def test_mep_to_eap_simple_equations(input: list[str], expected: list[str]) -> None:
    old = QueryParts(
        selected_columns=["id"],
        query="",
        equations=input,
        orderby=[],
    )
    translated = translate_mep_to_eap(old)

    assert translated["equations"] == expected


@pytest.mark.parametrize(
    "input,expected",
    [
        pytest.param(
            None,
            None,
        ),
        pytest.param(
            ["-count()"],
            ["-count(span.duration)"],
        ),
        pytest.param(
            [
                "-http.method",
                "transaction.duration",
                "-title",
                "url",
            ],
            ["-transaction.method", "span.duration", "-transaction", "request.url"],
        ),
        pytest.param(
            ["-span.op", "browser.name"],
            ["-span.op", "browser.name"],
        ),
        pytest.param(
            ["geo.city", "-geo.country_code"],
            ["user.geo.city", "-user.geo.country_code"],
        ),
        pytest.param(
            ["-apdex(300)", "user_misery(300)", "count_unique(http.method)"],
            [
                "-apdex(span.duration,300)",
                "user_misery(span.duration,300)",
                "count_unique(transaction.method)",
            ],
        ),
        pytest.param(
            ["-percentile(transaction.duration,0.5000)", "percentile(transaction.duration,0.94)"],
            ["-p50(span.duration)", "p95(span.duration)"],
        ),
        pytest.param(
            [
                "-count_miserable(user,300)",
                "count_web_vitals(user,300)",
                "any(transaction.duration)",
            ],
            [],
        ),
        pytest.param(
            ["-equation|count() + 5"],
            ["-equation|count(span.duration) + 5"],
        ),
        pytest.param(
            ["-equation|(count_unique(title) / 4) * (count_unique(http.method) * 2)"],
            ["-equation|(count_unique(transaction) / 4) * (count_unique(transaction.method) * 2)"],
        ),
        pytest.param(
            ["-equation[0]", "equation[1]", "-equation[2]"], ["-equation[0]", "-equation[1]"]
        ),
        pytest.param(["equation[3453]"], []),
    ],
)
def test_mep_to_eap_simple_orderbys(input: list[str], expected: list[str]) -> None:
    old = QueryParts(
        selected_columns=["id"],
        query="",
        equations=[
            "equation|count() * 2",
            "equation|count_miserable(user,300) + 3",
            "equation|count_unique(http.method) / 2",
        ],
        orderby=input,
    )
    translated = translate_mep_to_eap(old)

    assert translated["orderby"] == expected
