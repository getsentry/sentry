from unittest.mock import ANY

import sentry.relay.config.metric_extraction as extraction
from sentry.incidents.models import AlertRule
from sentry.snuba.dataset import Dataset
from sentry.snuba.models import SnubaQuery


def create_alert(query: str) -> AlertRule:
    snuba_query = SnubaQuery(
        aggregate="count()",
        query=query,
        dataset=Dataset.PerformanceMetrics.value,
    )
    return AlertRule(snuba_query=snuba_query)


def test_empty_query():
    alert = create_alert("")

    assert extraction.convert_query_to_metric(alert.snuba_query) is None


def test_simple_query_count():
    alert = create_alert("transaction.duration:>=1000")

    metric = extraction.convert_query_to_metric(alert.snuba_query)

    assert metric
    assert metric[1] == {
        "category": "transaction",
        "condition": {"name": "event.duration", "op": "gte", "value": 1000.0},
        "field": None,
        "mri": "c:transactions/on_demand@none",
        "tags": [{"key": "query_hash", "value": ANY}],
    }


def test_get_metric_specs_empty():
    assert len(extraction._get_metric_specs([])) == 0


def test_get_metric_specs_single():
    alert = create_alert("transaction.duration:>=1000")

    specs = extraction._get_metric_specs([alert])

    assert len(specs) == 1
    assert specs[0] == {
        "category": "transaction",
        "condition": {"name": "event.duration", "op": "gte", "value": 1000.0},
        "field": None,
        "mri": "c:transactions/on_demand@none",
        "tags": [{"key": "query_hash", "value": ANY}],
    }


def test_get_metric_specs_multiple():
    alert_1 = create_alert("transaction.duration:>=1")
    alert_2 = create_alert("transaction.duration:>=2")

    specs = extraction._get_metric_specs([alert_1, alert_2])

    assert len(specs) == 2

    first_hash = specs[0]["tags"][0]["value"]
    second_hash = specs[1]["tags"][0]["value"]

    assert first_hash != second_hash


def test_get_metric_specs_multiple_duplicated():
    alert_1 = create_alert("transaction.duration:>=1000")
    alert_2 = create_alert("transaction.duration:>=1000")
    alert_3 = create_alert("transaction.duration:>=1000")

    specs = extraction._get_metric_specs([alert_1, alert_2, alert_3])

    assert len(specs) == 1
    assert specs[0] == {
        "category": "transaction",
        "condition": {"name": "event.duration", "op": "gte", "value": 1000.0},
        "field": None,
        "mri": "c:transactions/on_demand@none",
        "tags": [{"key": "query_hash", "value": ANY}],
    }
