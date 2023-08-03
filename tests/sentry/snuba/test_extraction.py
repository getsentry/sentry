from sentry.snuba.dataset import Dataset
from sentry.snuba.metrics.extraction import (
    OndemandMetricSpec,
    is_on_demand_metric_query,
    is_standard_metrics_compatible,
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

    def test_returns_true(self):
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

    def test_returns_false(self):
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

    def test_returns_false(self):
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

    def test_returns_true(self):
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
