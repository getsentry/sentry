import pytest

from sentry.api.event_search import ParenExpression, parse_search_query
from sentry.snuba.dataset import Dataset
from sentry.snuba.metrics.extraction import (
    DerivedMetricParams,
    FieldParser,
    OndemandMetricSpecBuilder,
    QueryParser,
    cleanup_query,
    is_on_demand_metric_query,
    is_standard_metrics_compatible,
    query_tokens_to_string,
    to_standard_metrics_query,
)


@pytest.fixture
def on_demand_spec_builder():
    return OndemandMetricSpecBuilder(field_parser=FieldParser(), query_parser=QueryParser())


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

    def test_standard_comaptible_queries(self):
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
                self.perf_metrics, "count_if(transaction.duration,equals,300)", ""
            )
            is True
        )
        assert (
            is_on_demand_metric_query(self.perf_metrics, 'count_if(release,equals,"foo")', "")
            is False
        )

    def test_is_on_demand_query_failure_rate(self):
        dataset = Dataset.PerformanceMetrics

        assert is_on_demand_metric_query(dataset, "failure_rate()", "") is False
        assert is_on_demand_metric_query(dataset, "failure_rate()", "release:foo") is False
        assert (
            is_on_demand_metric_query(dataset, "failure_rate()", "transaction.duration:1000")
            is True
        )

    def test_is_on_demand_query_apdex(self):
        dataset = Dataset.PerformanceMetrics

        assert is_on_demand_metric_query(dataset, "apdex()", "") is False
        assert is_on_demand_metric_query(dataset, "apdex()", "release:foo") is False
        assert is_on_demand_metric_query(dataset, "apdex()", "transaction.duration:1000") is True


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

    def test_countif(self):
        assert (
            is_standard_metrics_compatible(
                self.perf_metrics, "count_if(transaction.duration,equals,300)", ""
            )
            is False
        )
        assert (
            is_standard_metrics_compatible(self.perf_metrics, 'count_if(release,equals,"foo")', "")
            is True
        )


def test_spec_simple_query_count(on_demand_spec_builder):
    spec = on_demand_spec_builder.build_spec(field="count()", query="transaction.duration:>1s")

    assert spec.metric_type == "c"
    assert spec.field is None
    assert spec.op == "sum"
    assert spec.condition == {"name": "event.duration", "op": "gt", "value": 1000.0}


def test_spec_simple_query_distribution(on_demand_spec_builder):
    spec = on_demand_spec_builder.build_spec(
        field="p75(measurements.fp)", query="transaction.duration:>1s"
    )

    assert spec.metric_type == "d"
    assert spec.field == "event.measurements.fp"
    assert spec.op == "p75"
    assert spec.condition == {"name": "event.duration", "op": "gt", "value": 1000.0}


def test_spec_or_condition(on_demand_spec_builder):
    spec = on_demand_spec_builder.build_spec(
        field="count()", query="transaction.duration:>=100 OR transaction.duration:<1000"
    )

    assert spec.metric_type == "c"
    assert spec.field is None
    assert spec.op == "sum"
    assert spec.condition == {
        "inner": [
            {"name": "event.duration", "op": "gte", "value": 100.0},
            {"name": "event.duration", "op": "lt", "value": 1000.0},
        ],
        "op": "or",
    }


def test_spec_and_condition(on_demand_spec_builder):
    spec = on_demand_spec_builder.build_spec(
        field="count()", query="release:foo transaction.duration:<10s"
    )

    assert spec.metric_type == "c"
    assert spec.field is None
    assert spec.op == "sum"
    assert spec.condition == {
        "inner": [
            {"name": "event.release", "op": "eq", "value": "foo"},
            {"name": "event.duration", "op": "lt", "value": 10000.0},
        ],
        "op": "and",
    }


def test_spec_nested_condition(on_demand_spec_builder):
    spec = on_demand_spec_builder.build_spec(
        field="count()", query="(release:a OR transaction.op:b) transaction.duration:>1s"
    )

    assert spec.metric_type == "c"
    assert spec.field is None
    assert spec.op == "sum"
    assert spec.condition == {
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


def test_spec_boolean_precedence(on_demand_spec_builder):
    spec = on_demand_spec_builder.build_spec(
        field="count()", query="release:a OR transaction.op:b transaction.duration:>1s"
    )

    assert spec.metric_type == "c"
    assert spec.field is None
    assert spec.op == "sum"
    assert spec.condition == {
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


def test_spec_wildcard(on_demand_spec_builder):
    spec = on_demand_spec_builder.build_spec(field="count()", query="release.version:1.*")

    assert spec.metric_type == "c"
    assert spec.field is None
    assert spec.op == "sum"
    assert spec.condition == {
        "name": "event.release.version.short",
        "op": "glob",
        "value": ["1.*"],
    }


def test_spec_countif(on_demand_spec_builder):
    spec = on_demand_spec_builder.build_spec(
        field="count_if(transaction.duration,equals,300)", query=""
    )

    assert spec.metric_type == "c"
    assert spec.field is None
    assert spec.op == "sum"
    assert spec.condition == {
        "name": "event.duration",
        "op": "eq",
        "value": 300.0,
    }


def test_spec_countif_with_query(on_demand_spec_builder):
    spec = on_demand_spec_builder.build_spec(
        field="count_if(transaction.duration,equals,300)", query="release:a OR transaction.op:b"
    )

    assert spec.metric_type == "c"
    assert spec.field is None
    assert spec.op == "sum"
    assert spec.condition == {
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


def test_spec_ignore_fields(on_demand_spec_builder):
    with_ignored_field_spec = on_demand_spec_builder.build_spec(
        field="count()", query="transaction.duration:>=1 project:sentry"
    )
    without_ignored_field_spec = on_demand_spec_builder.build_spec(
        field="count()", query="transaction.duration:>=1"
    )

    assert with_ignored_field_spec.condition == without_ignored_field_spec.condition


def test_spec_failure_rate(on_demand_spec_builder):
    spec = on_demand_spec_builder.build_spec(
        field="failure_rate()", query="transaction.duration:>1s"
    )

    assert spec.metric_type == "e"
    assert spec.field is None
    assert spec.op == "on_demand_failure_rate"
    assert spec.condition == {"name": "event.duration", "op": "gt", "value": 1000.0}
    assert spec.tags_conditions == [
        {
            "condition": {
                "inner": {
                    "name": "event.contexts.trace.status",
                    "op": "eq",
                    "value": ["ok", "cancelled", "unknown"],
                },
                "op": "not",
            },
            "key": "failure",
            "value": "true",
        },
    ]


def test_spec_apdex(on_demand_spec_builder):
    spec = on_demand_spec_builder.build_spec(
        field="apdex(10)",
        query="release:a",
        derived_metric_params=DerivedMetricParams({"field_to_extract": "transaction.duration"}),
    )

    assert spec.metric_type == "e"
    assert spec.field == "10"
    assert spec.op == "on_demand_apdex"
    assert spec.condition == {"name": "event.release", "op": "eq", "value": "a"}
    assert spec.tags_conditions == [
        {
            "condition": {"name": "event.duration", "op": "lte", "value": 10},
            "key": "satisfaction",
            "value": "satisfactory",
        },
        {
            "condition": {
                "inner": [
                    {"name": "event.duration", "op": "gt", "value": 10},
                    {"name": "event.duration", "op": "lte", "value": 40},
                ],
                "op": "and",
            },
            "key": "satisfaction",
            "value": "tolerable",
        },
        {
            "condition": {"name": "event.duration", "op": "gt", "value": 40},
            "key": "satisfaction",
            "value": "frustrated",
        },
    ]


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
