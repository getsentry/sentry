import pytest

from sentry.api.event_search import ParenExpression, parse_search_query
from sentry.snuba.dataset import Dataset
from sentry.snuba.metrics.extraction import (
    OndemandMetricSpec,
    cleanup_query,
    is_on_demand_metric_query,
    is_standard_metrics_compatible,
    query_tokens_to_string,
    should_use_on_demand_metrics,
    to_standard_metrics_query,
)


class TestIsOnDemandMetricQuery:
    perf_metrics = Dataset.PerformanceMetrics

    def test_wrong_dataset(self):
        assert (
            is_on_demand_metric_query(Dataset.Transactions, "count()", "geo.city:Vienna") is False
        )
        assert (
            is_on_demand_metric_query(
                Dataset.Metrics, "count()", "browser.version:1 os.name:android"
            )
            is False
        )

    def test_no_query(self):
        assert is_on_demand_metric_query(Dataset.PerformanceMetrics, "count()", "") is False

    def test_invalid_query(self):
        assert is_on_demand_metric_query(self.perf_metrics, "count()", "AND") is False
        assert (
            is_on_demand_metric_query(self.perf_metrics, "count()", ")AND transaction.duration:>=1")
            is False
        )
        assert (
            is_on_demand_metric_query(self.perf_metrics, "count()", "transaction.duration:>=abc")
            is False
        )
        assert is_on_demand_metric_query(self.perf_metrics, "count_if(}", "") is False

    def test_on_demand_queries(self):
        # # transaction.duration is a non-standard field
        assert (
            is_on_demand_metric_query(self.perf_metrics, "count()", "transaction.duration:>=1")
            is True
        )
        # # geo.city is a non-standard field
        assert is_on_demand_metric_query(self.perf_metrics, "count()", "geo.city:Vienna") is True
        # os.name is a standard field, browser.version is not
        assert (
            is_on_demand_metric_query(
                self.perf_metrics, "count()", "geo.city:Vienna os.name:android"
            )
            is True
        )
        # os.version is not a standard field
        assert (
            is_on_demand_metric_query(
                self.perf_metrics,
                "count()",
                "(release:a OR transaction.op:b) transaction.duration:>1s",
            )
            is True
        )

    def test_standard_compatible_queries(self):
        assert (
            is_on_demand_metric_query(self.perf_metrics, "p75(transaction.duration)", "") is False
        )
        assert is_on_demand_metric_query(self.perf_metrics, "count()", "") is False
        assert is_on_demand_metric_query(self.perf_metrics, "count()", "environment:dev") is False
        assert (
            is_on_demand_metric_query(
                self.perf_metrics, "count()", "release:initial OR os.name:android"
            )
            is False
        )
        assert (
            is_on_demand_metric_query(
                self.perf_metrics,
                "count()",
                "(http.method:POST OR http.status_code:404) browser.name:chrome",
            )
            is False
        )
        assert is_on_demand_metric_query(self.perf_metrics, "foo.bar", "") is False
        assert is_on_demand_metric_query(self.perf_metrics, "count()", "foo.bar") is False

    def test_countif(self):
        assert (
            is_on_demand_metric_query(
                self.perf_metrics, "count_if(geo.city.duration,equals,vienna)", ""
            )
            is True
        )
        assert (
            is_on_demand_metric_query(self.perf_metrics, 'count_if(release,equals,"foo")', "")
            is False
        )

    def test_unsupported_aggregate_functions(self):
        assert (
            is_on_demand_metric_query(
                self.perf_metrics, "failure_rate()", "transaction.duration:>=1"
            )
            is False
        )
        assert (
            is_on_demand_metric_query(
                self.perf_metrics, "count_unique(transaction.duration)", "transaction.duration:>=1"
            )
            is False
        )
        assert (
            is_on_demand_metric_query(
                self.perf_metrics, "min(transaction.duration)", "transaction.duration:>=1"
            )
            is False
        )
        assert (
            is_on_demand_metric_query(
                self.perf_metrics, "any(transaction.duration)", "transaction.duration:>=1"
            )
            is False
        )

    def test_unsupported_aggregate_fields(self):
        assert (
            is_on_demand_metric_query(self.perf_metrics, "message", "transaction.duration:>=1")
            is False
        )
        assert (
            is_on_demand_metric_query(self.perf_metrics, "title", "transaction.duration:>=1")
            is False
        )

    def test_unsupported_operators(self):
        assert (
            is_on_demand_metric_query(self.perf_metrics, "count()", "transaction.duration:[1,2,3]")
            is False
        )
        assert (
            is_on_demand_metric_query(self.perf_metrics, "count()", "!transaction.duration:[1,2,3]")
            is False
        )

    def test_unsupported_equations(self):
        assert (
            is_on_demand_metric_query(
                self.perf_metrics, "equation|count() / count()", "transaction.duration:>0"
            )
            is False
        )
        assert (
            is_on_demand_metric_query(self.perf_metrics, "equation|count() / count()", "") is False
        )

    def test_unsupported_aggregate_filter(self):
        assert (
            is_on_demand_metric_query(self.perf_metrics, "count()", "p75(measurements.fcp):>100")
            is False
        )


class TestIsStandardMetricsCompatible:
    perf_metrics = Dataset.PerformanceMetrics

    def test_wrong_dataset(self):
        assert is_standard_metrics_compatible(Dataset.Transactions, "count()", "") is False
        assert (
            is_standard_metrics_compatible(Dataset.Discover, "count()", "os.name:android") is False
        )

    def test_no_query(self):
        assert is_standard_metrics_compatible(Dataset.PerformanceMetrics, "count()", "") is True

    def test_invalid_query(self):
        dataset = Dataset.PerformanceMetrics

        assert is_standard_metrics_compatible(dataset, "count()", ")AND os.name:>=1") is False
        assert is_standard_metrics_compatible(dataset, "count()", "os.name><=abc") is False

    def test_on_demand_queries(self):
        # # transaction.duration is a non-standard field
        assert (
            is_standard_metrics_compatible(self.perf_metrics, "count()", "transaction.duration:>=1")
            is False
        )
        # # geo.city is a non-standard field
        assert (
            is_standard_metrics_compatible(self.perf_metrics, "count()", "geo.city:Vienna") is False
        )
        # os.name is a standard field, browser.version is not
        assert (
            is_standard_metrics_compatible(
                self.perf_metrics, "count()", "geo.city:Vienna os.name:android"
            )
            is False
        )
        # os.version is not a standard field
        assert (
            is_standard_metrics_compatible(
                self.perf_metrics,
                "count()",
                "(release:a OR transaction.op:b) transaction.duration:>1s",
            )
            is False
        )

    def test_standard_comaptible_queries(self):
        assert is_standard_metrics_compatible(self.perf_metrics, "count()", "") is True
        assert (
            is_standard_metrics_compatible(self.perf_metrics, "count()", "environment:dev") is True
        )
        assert (
            is_standard_metrics_compatible(
                self.perf_metrics, "count()", "release:initial OR os.name:android"
            )
            is True
        )
        assert (
            is_standard_metrics_compatible(
                self.perf_metrics,
                "count()",
                "(http.method:POST OR http.status_code:404) browser.name:chrome",
            )
            is True
        )

    def test_count_if(self):
        assert (
            is_standard_metrics_compatible(
                self.perf_metrics, "count_if(transaction.duration,equals,300)", ""
            )
            is True
        )
        assert (
            is_standard_metrics_compatible(self.perf_metrics, 'count_if(release,equals,"foo")', "")
            is True
        )


# truth_table = [
#     ('count()', 'release:a', 'standard'),
#     ('failure_rate()', 'release:a', 'standard'),
#     ('count_unique(geo.city)', 'release:a', 'on-demand'),
#     ('count()', 'transaction.duration:>1', 'on-demand'),
#     ('failure_rate()', 'transaction.duration:>1', 'indexed'),
#     ('count_unique(geo.city)', 'transaction.duration:>1', 'on-demand'),
# ]


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
        ("failure_rate()", "transaction.duration:>1", False),  # has to fallback to indexed
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
    with_ignored_field = OndemandMetricSpec("count()", "transaction.duration:>=1 project:sentry")
    without_ignored_field = OndemandMetricSpec("count()", "transaction.duration:>=1")

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
