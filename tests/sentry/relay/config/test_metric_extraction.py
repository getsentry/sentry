from typing import Sequence
from unittest.mock import ANY

from sentry.incidents.models import AlertRule
from sentry.models import (
    Dashboard,
    DashboardWidget,
    DashboardWidgetDisplayTypes,
    DashboardWidgetQuery,
    DashboardWidgetTypes,
    Project,
)
from sentry.relay.config.metric_extraction import get_metric_extraction_config
from sentry.snuba.dataset import Dataset
from sentry.snuba.models import QuerySubscription, SnubaQuery
from sentry.testutils.helpers import Feature
from sentry.testutils.pytest.fixtures import django_db_all

ON_DEMAND_METRICS = "organizations:on-demand-metrics-extraction"
ON_DEMAND_METRICS_WIDGETS = "organizations:on-demand-metrics-extraction-experimental"


def create_alert(aggregate: str, query: str, project: Project) -> AlertRule:
    snuba_query = SnubaQuery.objects.create(
        aggregate=aggregate,
        query=query,
        dataset=Dataset.PerformanceMetrics.value,
        time_window=300,
        resolution=60,
        environment=None,
        type=SnubaQuery.Type.PERFORMANCE.value,
    )

    QuerySubscription.objects.create(
        snuba_query=snuba_query,
        project=project,
    )

    alert_rule = AlertRule.objects.create(
        snuba_query=snuba_query, threshold_period=1, organization=project.organization
    )

    return alert_rule


def create_widget(
    aggregates: Sequence[str], query: str, project: Project, title="Dashboard"
) -> DashboardWidgetQuery:
    dashboard = Dashboard.objects.create(
        organization=project.organization,
        created_by_id=1,
        title=title,
    )

    widget = DashboardWidget.objects.create(
        dashboard=dashboard,
        order=0,
        widget_type=DashboardWidgetTypes.ON_DEMAND_METRICS,
        display_type=DashboardWidgetDisplayTypes.LINE_CHART,
    )

    widget_query = DashboardWidgetQuery.objects.create(
        aggregates=aggregates, conditions=query, order=0, widget=widget
    )

    return widget_query


@django_db_all
def test_get_metric_extraction_config_empty_no_alerts(default_project):
    with Feature(ON_DEMAND_METRICS):
        assert not get_metric_extraction_config(default_project)


@django_db_all
def test_get_metric_extraction_config_empty_feature_flag_off(default_project):
    create_alert("count()", "transaction.duration:>=1000", default_project)

    assert not get_metric_extraction_config(default_project)


@django_db_all
def test_get_metric_extraction_config_empty_standard_alerts(default_project):
    with Feature(ON_DEMAND_METRICS):
        # standard alerts are not included in the config
        create_alert("count()", "", default_project)

        assert not get_metric_extraction_config(default_project)


@django_db_all
def test_get_metric_extraction_config_single_alert(default_project):
    with Feature(ON_DEMAND_METRICS):
        create_alert("count()", "transaction.duration:>=1000", default_project)

        config = get_metric_extraction_config(default_project)

        assert config
        assert len(config["metrics"]) == 1
        assert config["metrics"][0] == {
            "category": "transaction",
            "condition": {"name": "event.duration", "op": "gte", "value": 1000.0},
            "field": None,
            "mri": "c:transactions/on_demand@none",
            "tags": [{"key": "query_hash", "value": ANY}],
        }


@django_db_all
def test_get_metric_extraction_config_multiple_alerts(default_project):
    with Feature(ON_DEMAND_METRICS):
        create_alert("count()", "transaction.duration:>=1000", default_project)
        create_alert("count()", "transaction.duration:>=2000", default_project)

        config = get_metric_extraction_config(default_project)

        assert config
        assert len(config["metrics"]) == 2

        first_hash = config["metrics"][0]["tags"][0]["value"]
        second_hash = config["metrics"][1]["tags"][0]["value"]

        assert first_hash != second_hash


@django_db_all
def test_get_metric_extraction_config_multiple_alerts_duplicated(default_project):
    # alerts with the same query should be deduplicated
    with Feature(ON_DEMAND_METRICS):
        create_alert("count()", "transaction.duration:>=1000", default_project)
        create_alert("count()", "transaction.duration:>=1000", default_project)

        config = get_metric_extraction_config(default_project)

        assert config
        assert len(config["metrics"]) == 1


@django_db_all
def test_get_metric_extraction_config_single_standard_widget(default_project):
    with Feature({ON_DEMAND_METRICS: True, ON_DEMAND_METRICS_WIDGETS: True}):
        create_widget(["count()"], "", default_project)

        assert not get_metric_extraction_config(default_project)


@django_db_all
def test_get_metric_extraction_config_single_widget(default_project):
    with Feature({ON_DEMAND_METRICS: True, ON_DEMAND_METRICS_WIDGETS: True}):
        create_widget(["count()"], "transaction.duration:>=1000", default_project)

        config = get_metric_extraction_config(default_project)

        assert config
        assert len(config["metrics"]) == 1
        assert config["metrics"][0] == {
            "category": "transaction",
            "condition": {"name": "event.duration", "op": "gte", "value": 1000.0},
            "field": None,
            "mri": "c:transactions/on_demand@none",
            "tags": [{"key": "query_hash", "value": ANY}],
        }


@django_db_all
def test_get_metric_extraction_config_single_widget_multiple_aggregates(default_project):
    # widget with multiple fields should result in multiple metrics
    with Feature({ON_DEMAND_METRICS: True, ON_DEMAND_METRICS_WIDGETS: True}):
        create_widget(
            ["count()", "avg(transaction.duration)"], "transaction.duration:>=1000", default_project
        )

        config = get_metric_extraction_config(default_project)

        assert config
        assert len(config["metrics"]) == 2
        assert config["metrics"][0] == {
            "category": "transaction",
            "condition": {"name": "event.duration", "op": "gte", "value": 1000.0},
            "field": None,
            "mri": "c:transactions/on_demand@none",
            "tags": [{"key": "query_hash", "value": ANY}],
        }
        assert config["metrics"][1] == {
            "category": "transaction",
            "condition": {"name": "event.duration", "op": "gte", "value": 1000.0},
            "field": "event.duration",
            "mri": "d:transactions/on_demand@none",
            "tags": [{"key": "query_hash", "value": ANY}],
        }


@django_db_all
def test_get_metric_extraction_config_multiple_aggregates_single_field(default_project):
    # widget with multiple aggregates on the same field in a single metric
    with Feature({ON_DEMAND_METRICS: True, ON_DEMAND_METRICS_WIDGETS: True}):
        create_widget(
            ["sum(transaction.duration)", "avg(transaction.duration)"],
            "transaction.duration:>=1000",
            default_project,
        )

        config = get_metric_extraction_config(default_project)

        assert config
        assert len(config["metrics"]) == 1
        assert config["metrics"][0] == {
            "category": "transaction",
            "condition": {"name": "event.duration", "op": "gte", "value": 1000.0},
            "field": "event.duration",
            "mri": "d:transactions/on_demand@none",
            "tags": [{"key": "query_hash", "value": ANY}],
        }


@django_db_all
def test_get_metric_extraction_config_multiple_widgets_duplicated(default_project):
    # metrics should be deduplicated across widgets
    with Feature({ON_DEMAND_METRICS: True, ON_DEMAND_METRICS_WIDGETS: True}):
        create_widget(
            ["count()", "avg(transaction.duration)"], "transaction.duration:>=1000", default_project
        )
        create_widget(["count()"], "transaction.duration:>=1000", default_project, "Dashboard 2")

        config = get_metric_extraction_config(default_project)

        assert config
        assert len(config["metrics"]) == 2
        assert config["metrics"][0] == {
            "category": "transaction",
            "condition": {"name": "event.duration", "op": "gte", "value": 1000.0},
            "field": None,
            "mri": "c:transactions/on_demand@none",
            "tags": [{"key": "query_hash", "value": ANY}],
        }
        assert config["metrics"][1] == {
            "category": "transaction",
            "condition": {"name": "event.duration", "op": "gte", "value": 1000.0},
            "field": "event.duration",
            "mri": "d:transactions/on_demand@none",
            "tags": [{"key": "query_hash", "value": ANY}],
        }


@django_db_all
def test_get_metric_extraction_config_alerts_and_widgets_off(default_project):
    # widgets should be skipped if the feature is off
    with Feature({ON_DEMAND_METRICS: True, ON_DEMAND_METRICS_WIDGETS: False}):
        create_alert("count()", "transaction.duration:>=1000", default_project)
        create_widget(["count()"], "transaction.duration:>=1000", default_project)

        config = get_metric_extraction_config(default_project)

        assert config
        assert len(config["metrics"]) == 1
        assert config["metrics"][0] == {
            "category": "transaction",
            "condition": {"name": "event.duration", "op": "gte", "value": 1000.0},
            "field": None,
            "mri": "c:transactions/on_demand@none",
            "tags": [{"key": "query_hash", "value": ANY}],
        }


@django_db_all
def test_get_metric_extraction_config_alerts_and_widgets(default_project):
    # deduplication should work across alerts and widgets
    with Feature({ON_DEMAND_METRICS: True, ON_DEMAND_METRICS_WIDGETS: True}):
        create_alert("count()", "transaction.duration:>=1000", default_project)
        create_widget(
            ["count()", "avg(transaction.duration)"], "transaction.duration:>=1000", default_project
        )

        config = get_metric_extraction_config(default_project)

        assert config
        assert len(config["metrics"]) == 2
        assert config["metrics"][0] == {
            "category": "transaction",
            "condition": {"name": "event.duration", "op": "gte", "value": 1000.0},
            "field": None,
            "mri": "c:transactions/on_demand@none",
            "tags": [{"key": "query_hash", "value": ANY}],
        }
        assert config["metrics"][1] == {
            "category": "transaction",
            "condition": {"name": "event.duration", "op": "gte", "value": 1000.0},
            "field": "event.duration",
            "mri": "d:transactions/on_demand@none",
            "tags": [{"key": "query_hash", "value": ANY}],
        }
