from unittest.mock import ANY

import pytest

import sentry.relay.config.metric_extraction as extraction
from sentry.incidents.models import AlertRule
from sentry.models import Project, ProjectTransactionThreshold, TransactionMetric
from sentry.snuba.dataset import Dataset
from sentry.snuba.models import QuerySubscription, SnubaQuery


def mock_alert(project: Project, aggregate: str, query: str) -> AlertRule:
    snuba_query = SnubaQuery(
        aggregate=aggregate,
        query=query,
        dataset=Dataset.PerformanceMetrics.value,
    )

    QuerySubscription(project=project, snuba_query=snuba_query, type="")

    return AlertRule(snuba_query=snuba_query)


def mock_project_threshold(
    project: Project, threshold: int, metric: int
) -> ProjectTransactionThreshold:
    return ProjectTransactionThreshold.objects.create(
        project=project, organization=project.organization, threshold=threshold, metric=metric
    )


@pytest.mark.django_db
def test_empty_query(default_project):
    alert = mock_alert(default_project, "count()", "")

    assert extraction.convert_query_to_metric(default_project, alert.snuba_query) is None


@pytest.mark.django_db
def test_simple_query_count(default_project):
    alert = mock_alert(default_project, "count()", "transaction.duration:>=1000")

    metric = extraction.convert_query_to_metric(default_project, alert.snuba_query)

    assert metric is not None
    assert metric.metric_spec == {
        "category": "transaction",
        "condition": {"name": "event.duration", "op": "gte", "value": 1000.0},
        "field": None,
        "mri": "c:transactions/on_demand@none",
        "tags": [{"key": "query_hash", "value": ANY}],
    }


@pytest.mark.django_db
def test_get_metric_specs_empty(default_project):
    assert len(extraction._get_metric_specs(default_project, [])) == 0


@pytest.mark.django_db
def test_get_metric_specs_single(default_project):
    alert = mock_alert(default_project, "count()", "transaction.duration:>=1000")

    specs = extraction._get_metric_specs(default_project, [alert])

    assert len(specs) == 1
    assert specs[0] == {
        "category": "transaction",
        "condition": {"name": "event.duration", "op": "gte", "value": 1000.0},
        "field": None,
        "mri": "c:transactions/on_demand@none",
        "tags": [{"key": "query_hash", "value": ANY}],
    }


@pytest.mark.django_db
def test_get_metric_specs_multiple(default_project):
    alert_1 = mock_alert(default_project, "count()", "transaction.duration:>=1")
    alert_2 = mock_alert(default_project, "count()", "transaction.duration:>=2")

    specs = extraction._get_metric_specs(default_project, [alert_1, alert_2])

    assert len(specs) == 2

    first_hash = specs[0]["tags"][0]["value"]
    second_hash = specs[1]["tags"][0]["value"]

    assert first_hash != second_hash


@pytest.mark.django_db
def test_get_metric_specs_multiple_duplicated(default_project):
    alert_1 = mock_alert(default_project, "count()", "transaction.duration:>=1000")
    alert_2 = mock_alert(default_project, "count()", "transaction.duration:>=1000")
    alert_3 = mock_alert(default_project, "count()", "transaction.duration:>=1000")

    specs = extraction._get_metric_specs(default_project, [alert_1, alert_2, alert_3])

    assert len(specs) == 1
    assert specs[0] == {
        "category": "transaction",
        "condition": {"name": "event.duration", "op": "gte", "value": 1000.0},
        "field": None,
        "mri": "c:transactions/on_demand@none",
        "tags": [{"key": "query_hash", "value": ANY}],
    }


@pytest.mark.django_db
def test_get_metric_specs_with_apdex(default_project):
    alert = mock_alert(default_project, "apdex(10)", "transaction.duration:>=1000")
    mock_project_threshold(default_project, 10, TransactionMetric.DURATION.value)

    specs = extraction._get_metric_specs(default_project, [alert])

    assert len(specs) == 1
    assert specs[0] == {
        "category": "transaction",
        "condition": {"name": "event.duration", "op": "gte", "value": 1000.0},
        "field": "on_demand_apdex",
        "mri": "e:transactions/on_demand@none",
        "tags": [
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
            {"key": "query_hash", "value": ANY},
        ],
    }
