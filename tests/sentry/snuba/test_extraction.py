import pytest

from sentry.snuba.dataset import Dataset
from sentry.snuba.metrics.extraction import (
    DerivedMetricParams,
    FieldParser,
    OndemandMetricSpecBuilder,
    QueryParser,
    is_on_demand_query,
)


@pytest.fixture
def on_demand_spec_builder():
    return OndemandMetricSpecBuilder(field_parser=FieldParser(), query_parser=QueryParser())


def test_is_on_demand_query_wrong_dataset():
    assert is_on_demand_query(Dataset.Transactions, "count()", "geo.city:Vienna") is False
    assert (
        is_on_demand_query(Dataset.Metrics, "count()", "browser.version:1 os.name:android") is False
    )


def test_is_on_demand_query_no_query():
    assert is_on_demand_query(Dataset.PerformanceMetrics, "count()", "") is False


def test_is_on_demand_query_invalid_query():
    dataset = Dataset.PerformanceMetrics

    assert is_on_demand_query(dataset, "count()", "AND") is False
    assert is_on_demand_query(dataset, "count()", ")AND transaction.duration:>=1") is False
    assert is_on_demand_query(dataset, "count()", "transaction.duration:>=abc") is False
    assert is_on_demand_query(dataset, "count_if(}", "") is False


def test_is_on_demand_query_true():
    dataset = Dataset.PerformanceMetrics

    # transaction.duration is a non-standard field
    assert is_on_demand_query(dataset, "count()", "transaction.duration:>=1") is True
    # transaction.duration is a non-standard field
    assert is_on_demand_query(dataset, "count()", "geo.city:Vienna") is True
    # os.name is a standard field, browser.version is not
    assert is_on_demand_query(dataset, "count()", "browser.version:1 os.name:android") is True
    # os.version is not a standard field
    assert (
        is_on_demand_query(
            dataset, "count()", "(release:a OR transaction.op:b) transaction.duration:>1s"
        )
        is True
    )


def test_is_on_demand_query_false():
    dataset = Dataset.PerformanceMetrics

    assert is_on_demand_query(dataset, "count()", "") is False
    assert is_on_demand_query(dataset, "count()", "environment:dev") is False
    assert is_on_demand_query(dataset, "count()", "release:initial OR os.name:android") is False
    assert (
        is_on_demand_query(
            dataset, "count()", "(http.method:POST OR http.status_code:404) browser.name:chrome"
        )
        is False
    )


def test_is_on_demand_query_countif():
    dataset = Dataset.PerformanceMetrics

    assert is_on_demand_query(dataset, "count_if(transaction.duration,equals,300)", "") is True
    assert is_on_demand_query(dataset, 'count_if(release,equals,"foo")', "") is False


def test_spec_simple_query_count(on_demand_spec_builder):
    specs = on_demand_spec_builder.build_specs(field="count()", query="transaction.duration:>1s")

    assert len(specs) == 1
    spec = specs[0]
    assert spec.metric_type == "c"
    assert spec.field is None
    assert spec.op == "sum"
    assert spec.rule_condition == {"name": "event.duration", "op": "gt", "value": 1000.0}


def test_spec_simple_query_distribution(on_demand_spec_builder):
    specs = on_demand_spec_builder.build_specs(
        field="p75(measurements.fp)", query="transaction.duration:>1s"
    )

    assert len(specs) == 1
    spec = specs[0]
    assert spec.metric_type == "d"
    assert spec.field == "event.measurements.fp"
    assert spec.op == "p75"
    assert spec.rule_condition == {"name": "event.duration", "op": "gt", "value": 1000.0}


def test_spec_or_condition(on_demand_spec_builder):
    specs = on_demand_spec_builder.build_specs(
        field="count()", query="transaction.duration:>=100 OR transaction.duration:<1000"
    )

    assert len(specs) == 1
    assert specs[0].rule_condition == {
        "inner": [
            {"name": "event.duration", "op": "gte", "value": 100.0},
            {"name": "event.duration", "op": "lt", "value": 1000.0},
        ],
        "op": "or",
    }


def test_spec_and_condition(on_demand_spec_builder):
    specs = on_demand_spec_builder.build_specs(
        field="count()", query="release:foo transaction.duration:<10s"
    )

    assert len(specs) == 1
    assert specs[0].rule_condition == {
        "inner": [
            {"name": "event.release", "op": "eq", "value": "foo"},
            {"name": "event.duration", "op": "lt", "value": 10000.0},
        ],
        "op": "and",
    }


def test_spec_nested_condition(on_demand_spec_builder):
    specs = on_demand_spec_builder.build_specs(
        field="count()", query="(release:a OR transaction.op:b) transaction.duration:>1s"
    )

    assert len(specs) == 1
    assert specs[0].rule_condition == {
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
    specs = on_demand_spec_builder.build_specs(
        field="count()", query="release:a OR transaction.op:b transaction.duration:>1s"
    )

    assert len(specs) == 1
    assert specs[0].rule_condition == {
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
    specs = on_demand_spec_builder.build_specs(field="count()", query="release.version:1.*")

    assert len(specs) == 1
    assert specs[0].rule_condition == {
        "name": "event.release.version.short",
        "op": "glob",
        "value": ["1.*"],
    }


def test_spec_countif(on_demand_spec_builder):
    specs = on_demand_spec_builder.build_specs(
        field="count_if(transaction.duration,equals,300)", query=""
    )

    assert len(specs) == 1
    spec = specs[0]
    assert spec.metric_type == "c"
    assert spec.field is None
    assert spec.op == "sum"
    assert spec.rule_condition == {
        "name": "event.duration",
        "op": "eq",
        "value": 300.0,
    }


def test_spec_countif_with_query(on_demand_spec_builder):
    specs = on_demand_spec_builder.build_specs(
        field="count_if(transaction.duration,equals,300)", query="release:a OR transaction.op:b"
    )

    assert len(specs) == 1
    assert specs[0].rule_condition == {
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
    with_ignored_field_specs = on_demand_spec_builder.build_specs(
        field="count()", query="transaction.duration:>=1 project:sentry"
    )
    without_ignored_field_specs = on_demand_spec_builder.build_specs(
        field="count()", query="transaction.duration:>=1"
    )

    assert (
        with_ignored_field_specs[0].rule_condition == without_ignored_field_specs[0].rule_condition
    )


def test_spec_failure_rate(on_demand_spec_builder):
    specs = on_demand_spec_builder.build_specs(
        field="failure_rate()", query="transaction.duration:>1s"
    )

    assert len(specs) == 2
    assert specs[0].rule_condition == {
        "inner": [
            {"name": "event.contexts.trace.status", "op": "eq", "value": "aborted"},
            {"name": "event.duration", "op": "gt", "value": 1000.0},
        ],
        "op": "and",
    }
    assert specs[1].rule_condition == {"name": "event.duration", "op": "gt", "value": 1000.0}


def test_spec_apdex(on_demand_spec_builder):
    t = 10
    specs = on_demand_spec_builder.build_specs(
        field="apdex()", query="release:a", derived_metric_params=DerivedMetricParams({"t": t})
    )

    assert len(specs) == 3
    assert specs[0].rule_condition == {
        "inner": [
            {"name": "event.duration", "op": "lte", "value": t},
            {"name": "event.release", "op": "eq", "value": "a"},
        ],
        "op": "and",
    }
    assert specs[1].rule_condition == {
        "inner": [
            {
                "inner": [
                    {"name": "event.duration", "op": "gt", "value": t},
                    {"name": "event.duration", "op": "lte", "value": t * 4},
                ],
                "op": "and",
            },
            {"name": "event.release", "op": "eq", "value": "a"},
        ],
        "op": "and",
    }
    assert specs[2].rule_condition == {
        "inner": [
            {"name": "event.duration", "op": "gt", "value": t * 4},
            {"name": "event.release", "op": "eq", "value": "a"},
        ],
        "op": "and",
    }
