import pytest

from sentry.api.event_search import ParenExpression, parse_search_query
from sentry.snuba.dataset import Dataset
from sentry.snuba.metrics.extraction import (
    OndemandMetricSpec,
    cleanup_query,
    query_tokens_to_string,
    should_use_on_demand_metrics,
    to_standard_metrics_query,
)


@pytest.mark.parametrize(
    "dataset",
    [
        Dataset.Events,
        Dataset.Discover,
        Dataset.Outcomes,
        Dataset.Transactions,
    ],
)
def test_wrong_dataset(dataset):
    assert should_use_on_demand_metrics(dataset, "count()", "transaction.duration:>0") is False


@pytest.mark.parametrize(
    "aggregate, query",
    [
        # no query
        ("count()", ""),
        # invalid query
        ("count()", "AND"),
        ("count()", ")AND transaction.duration:>0"),
        ("count_if(}", ""),
        # standard metrics supported queries
        ("p75(transaction.duration)", ""),
        ("count()", "environment:dev"),
        ("count()", "release:initial OR os.name:android"),
        ("count()", "(http.method:POST OR http.status_code:404) browser.name:chrome"),
        ('count_if(release,equals,"foo")', ""),
        # standard metrics unsupported queries
        ("foo.bar", ""),
        ("count()", "foo.bar"),
    ],
)
def test_standard_or_invalid_queries(aggregate, query):
    assert should_use_on_demand_metrics(Dataset.PerformanceMetrics, aggregate, query) is False


@pytest.mark.parametrize(
    "aggregate, query",
    [
        ("count()", "transaction.duration:>0"),  # transaction.duration is a non-standard field
        ("count()", "geo.city:Vienna"),  # geo.city  is a non-standard field
        (
            "count()",
            "geo.city:Vienna os.name:android",
        ),  # os.name is a standard field, geo.city is not
        ("count()", "(release:a OR transaction.op:b) transaction.duration:>1s"),
        ("count_if(geo.city.duration,equals,vienna)", ""),  # geo.city is a non-standard field
    ],
)
def test_on_demand_queries(aggregate, query):
    assert should_use_on_demand_metrics(Dataset.PerformanceMetrics, aggregate, query) is True


@pytest.mark.parametrize(
    "aggregate, query",
    [
        # unsupported aggregate functions
        ("failure_rate()", "transaction.duration:>0"),
        ("count_unique(transaction.duration)", "transaction.duration:>0"),
        ("min(transaction.duration)", "transaction.duration:>0"),
        ("any(transaction.duration)", "transaction.duration:>0"),
        # unsupported aggregate fields
        ("message", "transaction.duration:>0"),
        ("title", "transaction.duration:>0"),
        # unsupported operators
        ("count()", "transaction.duration:[1,2,3]"),
        ("count()", "!transaction.duration:[1,2,3]"),
        # unsupported equations
        ("equation|count() / count()", "transaction.duration:>0"),
        ("equation|count() / count()", ""),
        # unsupported aggregate filter
        ("count()", "p75(measurements.fcp):>100"),
    ],
)
def test_unsupported_queries(aggregate, query):
    assert should_use_on_demand_metrics(Dataset.PerformanceMetrics, aggregate, query) is False


@pytest.mark.parametrize(
    "agg, query, result",
    [
        ("count()", "release:a", False),  # supported by standard metrics
        ("failure_rate()", "release:a", False),  # supported by standard metrics
        ("count_unique(geo.city)", "release:a", False),
        # geo.city not supported by standard metrics, but also not by on demand
        (
            "count()",
            "transaction.duration:>1",
            True,
        ),  # transaction.duration not supported by standard metrics
        ("failure_rate()", "transaction.duration:>1", False),  # has to fall back to indexed
        (
            "count_if(transaction.duration,equals,0)",
            "release:a",
            False,
        ),  # count_if supported by standard metrics
        ("p75(transaction.duration)", "release:a", False),  # supported by standard metrics
        (
            "p75(transaction.duration)",
            "transaction.duration:>1",
            True,
        ),  # transaction.duration query is on-demand
    ],
)
def test_should_use_on_demand(agg, query, result):
    assert should_use_on_demand_metrics(Dataset.PerformanceMetrics, agg, query) is result


def create_spec_if_needed(dataset, agg, query):
    if should_use_on_demand_metrics(dataset, agg, query):
        return OndemandMetricSpec(agg, query)


@pytest.mark.parametrize(
    "aggregate, query",
    [
        ("count()", "transaction.duration:>0"),
        ("p75(measurements.fp)", "transaction.duration:>0"),
        ("p75(transaction.duration)", "transaction.duration:>0"),
        ("count_if(transaction.duration,equals,0)", "transaction.duration:>0"),
        (
            "count()",
            "project:android-symbol-collector-server route.action:CloseBatch level:info",
        ),
    ],
)
def test_creates_on_demand_spec(aggregate, query):
    assert create_spec_if_needed(Dataset.PerformanceMetrics, aggregate, query)


@pytest.mark.parametrize(
    "aggregate, query",
    [
        ("count()", "release:a"),
        ("failure_rate()", "transaction.duration:>0"),
        ("count_unique(user)", "transaction.duration:>0"),
        ("last_seen()", "transaction.duration:>0"),
        ("any(user)", "transaction.duration:>0"),
        ("p95(transaction.duration)", ""),
        ("count()", "p75(transaction.duration):>0"),
        ("message", "transaction.duration:>0"),
        ("count()", "transaction.duration:[1,2,3]"),
        ("equation| count() / count()", "transaction.duration:>0"),
        ("p75(measurements.lcp)", "!event.type:transaction"),
        ("count_web_vitals(measurements.fcp,any)", "transaction.duration:>0"),
        ("p95(measurements.lcp)", ""),
        ("avg(spans.http)", ""),
    ],
)
def test_does_not_create_on_demand_spec(aggregate, query):
    assert not create_spec_if_needed(Dataset.PerformanceMetrics, aggregate, query)


def test_spec_simple_query_count():
    spec = OndemandMetricSpec("count()", "transaction.duration:>1s")

    assert spec.metric_type == "c"
    assert spec.field is None
    assert spec.op == "sum"
    assert spec.condition() == {"name": "event.duration", "op": "gt", "value": 1000.0}


def test_spec_simple_query_distribution():
    spec = OndemandMetricSpec("p75(measurements.fp)", "transaction.duration:>1s")

    assert spec.metric_type == "d"
    assert spec.field == "event.measurements.fp"
    assert spec.op == "p75"
    assert spec.condition() == {"name": "event.duration", "op": "gt", "value": 1000.0}


def test_spec_or_condition():
    spec = OndemandMetricSpec("count()", "transaction.duration:>=100 OR transaction.duration:<1000")

    assert spec.condition() == {
        "inner": [
            {"name": "event.duration", "op": "gte", "value": 100.0},
            {"name": "event.duration", "op": "lt", "value": 1000.0},
        ],
        "op": "or",
    }


def test_spec_and_condition():
    spec = OndemandMetricSpec("count()", "release:foo transaction.duration:<10s")
    assert spec.condition() == {
        "inner": [
            {"name": "event.release", "op": "eq", "value": "foo"},
            {"name": "event.duration", "op": "lt", "value": 10000.0},
        ],
        "op": "and",
    }


def test_spec_nested_condition():
    spec = OndemandMetricSpec("count()", "(release:a OR transaction.op:b) transaction.duration:>1s")
    assert spec.condition() == {
        "op": "and",
        "inner": [
            {
                "op": "or",
                "inner": [
                    {"name": "event.release", "op": "eq", "value": "a"},
                    {"name": "event.contexts.trace.op", "op": "eq", "value": "b"},
                ],
            },
            {"name": "event.duration", "op": "gt", "value": 1000.0},
        ],
    }


def test_spec_boolean_precedence():
    spec = OndemandMetricSpec("count()", "release:a OR transaction.op:b transaction.duration:>1s")
    assert spec.condition() == {
        "op": "or",
        "inner": [
            {"name": "event.release", "op": "eq", "value": "a"},
            {
                "op": "and",
                "inner": [
                    {"name": "event.contexts.trace.op", "op": "eq", "value": "b"},
                    {"name": "event.duration", "op": "gt", "value": 1000.0},
                ],
            },
        ],
    }


def test_spec_wildcard():
    spec = OndemandMetricSpec("count()", "release.version:1.*")
    assert spec.condition() == {
        "name": "event.release.version.short",
        "op": "glob",
        "value": ["1.*"],
    }


def test_spec_countif():
    spec = OndemandMetricSpec("count_if(transaction.duration,equals,300)", "")

    assert spec.metric_type == "c"
    assert spec.field is None
    assert spec.op == "sum"
    assert spec.condition() == {
        "name": "event.duration",
        "op": "eq",
        "value": 300.0,
    }


def test_spec_countif_with_query():
    spec = OndemandMetricSpec(
        "count_if(transaction.duration,equals,300)", "release:a OR transaction.op:b"
    )

    assert spec.condition() == {
        "op": "and",
        "inner": [
            {
                "op": "or",
                "inner": [
                    {"name": "event.release", "op": "eq", "value": "a"},
                    {"name": "event.contexts.trace.op", "op": "eq", "value": "b"},
                ],
            },
            {"name": "event.duration", "op": "eq", "value": 300.0},
        ],
    }


def test_ignore_fields():
    with_ignored_field = OndemandMetricSpec("count()", "transaction.duration:>0 project:sentry")
    without_ignored_field = OndemandMetricSpec("count()", "transaction.duration:>0")

    assert with_ignored_field.condition() == without_ignored_field.condition()


@pytest.mark.parametrize(
    "query",
    [
        "release:initial OR os.name:android",
        "browser.version:1 os.name:android",
        "(release:a OR (transaction.op:b and browser.version:1)) transaction.duration:>1s",
    ],
)
def test_query_tokens_to_string(query):
    tokens = parse_search_query(query)
    new_query = query_tokens_to_string(tokens)
    new_tokens = parse_search_query(new_query)

    assert tokens == new_tokens


@pytest.mark.parametrize(
    "dirty, clean",
    [
        ("release:initial OR os.name:android", "release:initial OR os.name:android"),
        ("OR AND OR release:initial OR os.name:android", "release:initial OR os.name:android"),
        ("release:initial OR os.name:android AND OR AND ", "release:initial OR os.name:android"),
        (
            "release:initial AND (AND OR) (OR )os.name:android ",
            "release:initial AND os.name:android",
        ),
        (
            " AND ((AND OR (OR ))) release:initial (((AND OR  (AND)))) AND os.name:android  (AND OR) ",
            "release:initial AND os.name:android",
        ),
        (" (AND) And (And) Or release:initial or (and) or", "release:initial"),
    ],
)
def test_cleanup_query(dirty, clean):
    dirty_tokens = parse_search_query(dirty)
    clean_tokens = parse_search_query(clean)
    actual_clean = cleanup_query(dirty_tokens)

    assert actual_clean == clean_tokens


def test_cleanup_query_with_empty_parens():
    """
    Separate test with empty parens because we can't parse a string with empty parens correctly
    """

    paren = ParenExpression
    dirty_tokens = (
        [paren([paren(["AND", "OR", paren([])])])]
        + parse_search_query("release:initial AND (AND OR) (OR)")  # ((AND OR (OR ())))
        + [paren([])]
        + parse_search_query("os.name:android")  # ()
        + [paren([paren([paren(["AND", "OR", paren([])])])])]  # ((()))
    )
    clean_tokens = parse_search_query("release:initial AND os.name:android")
    actual_clean = cleanup_query(dirty_tokens)
    assert actual_clean == clean_tokens


@pytest.mark.parametrize(
    "dirty, clean",
    [
        ("transaction.duration:>=1 ", ""),
        ("transaction.duration:>=1 and geo.city:Vienna ", ""),
        ("transaction.duration:>=1 and geo.city:Vienna or os.name:android", "os.name:android"),
        ("(transaction.duration:>=1 and geo.city:Vienna) or os.name:android", "os.name:android"),
        (
            "release:initial OR (os.name:android AND transaction.duration:>=1 OR environment:dev)",
            "release:initial OR (os.name:android or environment:dev)",
        ),
    ],
)
def test_to_standard_metrics_query(dirty, clean):
    cleaned_up_query = to_standard_metrics_query(dirty)
    cleaned_up_tokens = parse_search_query(cleaned_up_query)
    clean_tokens = parse_search_query(clean)

    assert cleaned_up_tokens == clean_tokens
