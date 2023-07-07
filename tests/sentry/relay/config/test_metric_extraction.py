from unittest.mock import ANY

from sentry.incidents.models import AlertRule
from sentry.relay.config.metric_extraction import convert_query_to_metric
from sentry.snuba.dataset import Dataset
from sentry.snuba.models import SnubaQuery


def create_alert(query: str):
    snuba_query = SnubaQuery(
        aggregate="p75(measurements.fp)", query=query, dataset=Dataset.PerformanceMetrics.value
    )
    return AlertRule(snuba_query=snuba_query)


def test_empty_query():
    alert = create_alert("")

    assert convert_query_to_metric(alert.snuba_query) is None


def test_standard_metric_query():
    alert = create_alert("transaction:/my/api/url/")

    assert convert_query_to_metric(alert.snuba_query) is None


def test_simple_query_count():
    snuba_query = SnubaQuery(
        aggregate="count()",
        query="transaction.duration:>=1000",
        dataset=Dataset.PerformanceMetrics.value,
    )
    alert = AlertRule(snuba_query=snuba_query)

    metric = convert_query_to_metric(alert.snuba_query)

    expected = {
        "category": "transaction",
        "condition": {"name": "event.duration", "op": "gte", "value": 1000.0},
        "field": None,
        "mri": "c:transactions/on_demand@none",
        "tags": [{"key": "query_hash", "value": ANY}],
    }

    assert metric == expected


def test_simple_query():
    alert = create_alert("transaction.duration:>=1000")
    metric = convert_query_to_metric(alert.snuba_query)

    expected = {
        "category": "transaction",
        "condition": {"name": "event.duration", "op": "gte", "value": 1000.0},
        "field": "event.measurements.fp",
        "mri": "d:transactions/on_demand@none",
        "tags": [{"key": "query_hash", "value": ANY}],
    }

    assert metric == expected


def test_or_boolean_condition():
    alert = create_alert("transaction.duration:>=100 OR transaction.duration:<1000")
    metric = convert_query_to_metric(alert.snuba_query)

    expected = {
        "category": "transaction",
        "condition": {
            "inner": [
                {"name": "event.duration", "op": "gte", "value": 100.0},
                {"name": "event.duration", "op": "lt", "value": 1000.0},
            ],
            "op": "or",
        },
        "field": "event.measurements.fp",
        "mri": "d:transactions/on_demand@none",
        "tags": [{"key": "query_hash", "value": ANY}],
    }

    assert metric == expected


def test_and_boolean_condition():
    alert = create_alert("release:foo transaction.duration:<10s")
    metric = convert_query_to_metric(alert.snuba_query)

    expected = {
        "category": "transaction",
        "condition": {
            "inner": [
                {"name": "event.release", "op": "eq", "value": "foo"},
                {"name": "event.duration", "op": "lt", "value": 10000.0},
            ],
            "op": "and",
        },
        "field": "event.measurements.fp",
        "mri": "d:transactions/on_demand@none",
        "tags": [{"key": "query_hash", "value": ANY}],
    }

    assert metric == expected


def test_nested_conditions():
    query = "(release:=a OR transaction.op:=b) transaction.duration:>1s"
    metric = convert_query_to_metric(create_alert(query).snuba_query)

    expected = {
        "category": "transaction",
        "condition": {
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
        },
        "field": "event.measurements.fp",
        "mri": "d:transactions/on_demand@none",
        "tags": [{"key": "query_hash", "value": ANY}],
    }

    assert metric == expected


def test_wildcard_condition():
    alert = create_alert("release.version:1.*")
    metric = convert_query_to_metric(alert.snuba_query)

    expected = {
        "category": "transaction",
        "condition": {"name": "event.release.version.short", "op": "glob", "value": ["1.*"]},
        "field": "event.measurements.fp",
        "mri": "d:transactions/on_demand@none",
        "tags": [{"key": "query_hash", "value": ANY}],
    }

    assert metric == expected
