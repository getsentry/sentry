from unittest.mock import ANY

from sentry.incidents.models import AlertRule
from sentry.relay.config.metric_extraction import convert_query_to_metric
from sentry.snuba.dataset import Dataset
from sentry.snuba.models import SnubaQuery


def test_empty_query():
    snuba_query = SnubaQuery(
        aggregate="p75(measurements.fp)",
        query="transaction.duration:>=1000",
        dataset=Dataset.PerformanceMetrics.value,
    )
    alert = AlertRule(snuba_query=snuba_query)

    assert convert_query_to_metric(alert.snuba_query) is None


def test_simple_query_count():
    snuba_query = SnubaQuery(
        aggregate="count()",
        query="transaction.duration:>=1000",
        dataset=Dataset.PerformanceMetrics.value,
    )
    alert = AlertRule(snuba_query=snuba_query)

    metric = convert_query_to_metric(alert.snuba_query)
    assert metric == {
        "category": "transaction",
        "condition": {"name": "event.duration", "op": "gte", "value": 1000.0},
        "field": None,
        "mri": "c:transactions/on_demand@none",
        "tags": [{"key": "query_hash", "value": ANY}],
    }
