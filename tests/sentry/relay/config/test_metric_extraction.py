from typing import Optional, Sequence

import pytest

from sentry.incidents.models import AlertRule
from sentry.models.dashboard import Dashboard
from sentry.models.dashboard_widget import (
    DashboardWidget,
    DashboardWidgetDisplayTypes,
    DashboardWidgetQuery,
    DashboardWidgetTypes,
)
from sentry.models.environment import Environment
from sentry.models.project import Project
from sentry.models.transaction_threshold import ProjectTransactionThreshold, TransactionMetric
from sentry.relay.config.metric_extraction import get_metric_extraction_config
from sentry.search.events.constants import VITAL_THRESHOLDS
from sentry.snuba.dataset import Dataset
from sentry.snuba.models import QuerySubscription, SnubaQuery
from sentry.testutils.helpers import Feature
from sentry.testutils.helpers.options import override_options
from sentry.testutils.pytest.fixtures import django_db_all

ON_DEMAND_METRICS = "organizations:on-demand-metrics-extraction"
ON_DEMAND_METRICS_WIDGETS = "organizations:on-demand-metrics-extraction-widgets"
ON_DEMAND_METRICS_PREFILL = "organizations:on-demand-metrics-prefill"


def create_alert(
    aggregate: str,
    query: str,
    project: Project,
    dataset: Dataset = Dataset.PerformanceMetrics,
    environment: Optional[Environment] = None,
) -> AlertRule:
    snuba_query = SnubaQuery.objects.create(
        aggregate=aggregate,
        query=query,
        dataset=dataset.value,
        time_window=300,
        resolution=60,
        environment=environment,
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
    aggregates: Sequence[str],
    query: str,
    project: Project,
    title: Optional[str] = "Dashboard",
    columns: Optional[Sequence[str]] = None,
) -> DashboardWidgetQuery:
    columns = columns or []
    dashboard = Dashboard.objects.create(
        organization=project.organization,
        created_by_id=1,
        title=title,
    )

    widget = DashboardWidget.objects.create(
        dashboard=dashboard,
        order=0,
        widget_type=DashboardWidgetTypes.DISCOVER,
        display_type=DashboardWidgetDisplayTypes.LINE_CHART,
    )

    widget_query = DashboardWidgetQuery.objects.create(
        aggregates=aggregates, conditions=query, columns=columns, order=0, widget=widget
    )

    return widget_query


def create_project_threshold(
    project: Project, threshold: int, metric: int
) -> ProjectTransactionThreshold:
    return ProjectTransactionThreshold.objects.create(
        project=project, organization=project.organization, threshold=threshold, metric=metric
    )


@django_db_all
def test_get_metric_extraction_config_empty_no_alerts(default_project: Project) -> None:
    with Feature(ON_DEMAND_METRICS):
        assert not get_metric_extraction_config(default_project)


@django_db_all
def test_get_metric_extraction_config_empty_feature_flag_off(default_project: Project) -> None:
    create_alert("count()", "transaction.duration:>=1000", default_project)

    assert not get_metric_extraction_config(default_project)


@django_db_all
def test_get_metric_extraction_config_empty_standard_alerts(default_project: Project) -> None:
    with Feature(ON_DEMAND_METRICS):
        # standard alerts are not included in the config
        create_alert("count()", "", default_project)

        assert not get_metric_extraction_config(default_project)


@django_db_all
def test_get_metric_extraction_config_single_alert(default_project: Project) -> None:
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
            "tags": [{"key": "query_hash", "value": "a312e0db"}],
        }


@django_db_all
def test_get_metric_extraction_config_with_double_write_env_alert(
    default_project: Project, default_environment: Environment
) -> None:
    with Feature(ON_DEMAND_METRICS):
        create_alert(
            "count()",
            "device.platform:android OR device.platform:ios",
            default_project,
            environment=default_environment,
        )

        config = get_metric_extraction_config(default_project)

        assert config
        assert len(config["metrics"]) == 2
        # The new way parenthesizes correctly the environment expression, making the original expression resolve first
        # and then AND with the injected environment.
        assert config["metrics"][0] == {
            "category": "transaction",
            "condition": {
                "inner": [
                    {"name": "event.environment", "op": "eq", "value": "development"},
                    {
                        "inner": [
                            {"name": "event.tags.device.platform", "op": "eq", "value": "android"},
                            {"name": "event.tags.device.platform", "op": "eq", "value": "ios"},
                        ],
                        "op": "or",
                    },
                ],
                "op": "and",
            },
            "field": None,
            "mri": "c:transactions/on_demand@none",
            "tags": [{"key": "query_hash", "value": "ca87c609"}],
        }
        # The old way of generating the config has no parentheses, thus if we have lower binding in the original
        # expression, we will prioritize our filter.
        assert config["metrics"][1] == {
            "category": "transaction",
            "condition": {
                "inner": [
                    {
                        "inner": [
                            {"name": "event.environment", "op": "eq", "value": "development"},
                            {"name": "event.tags.device.platform", "op": "eq", "value": "android"},
                        ],
                        "op": "and",
                    },
                    {"name": "event.tags.device.platform", "op": "eq", "value": "ios"},
                ],
                "op": "or",
            },
            "field": None,
            "mri": "c:transactions/on_demand@none",
            "tags": [{"key": "query_hash", "value": "47bc817d"}],
        }


@django_db_all
def test_get_metric_extraction_config_single_alert_with_mri(default_project: Project) -> None:
    with Feature(ON_DEMAND_METRICS):
        create_alert(
            "sum(c:custom/page_load@millisecond)", "transaction.duration:>=1000", default_project
        )
        create_alert(
            "count(d:transactions/measurements.fcp@millisecond)",
            "transaction.duration:>=1000",
            default_project,
        )

        config = get_metric_extraction_config(default_project)

        assert config is None


@django_db_all
def test_get_metric_extraction_config_multiple_alerts(default_project: Project) -> None:
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
def test_get_metric_extraction_config_multiple_alerts_duplicated(default_project: Project) -> None:
    # alerts with the same query should be deduplicated
    with Feature(ON_DEMAND_METRICS):
        create_alert("count()", "transaction.duration:>=1000", default_project)
        create_alert("count()", "transaction.duration:>=1000", default_project)

        config = get_metric_extraction_config(default_project)

        assert config
        assert len(config["metrics"]) == 1


@django_db_all
def test_get_metric_extraction_config_environment(
    default_project: Project, default_environment: Environment
) -> None:
    with Feature(ON_DEMAND_METRICS):
        create_alert("count()", "transaction.duration:>0", default_project)
        create_alert("count()", "transaction.duration:>0", default_project, environment=None)
        create_alert(
            "count()", "transaction.duration:>0", default_project, environment=default_environment
        )

        config = get_metric_extraction_config(default_project)

        assert config
        # assert that the deduplication works with environments
        assert len(config["metrics"]) == 2

        no_env, default_env = config["metrics"]

        # assert that the conditions are different
        assert no_env["condition"] != default_env["condition"]
        # assert that environment is part of the hash
        assert no_env["tags"][0]["value"] != default_env["tags"][0]["value"]


@django_db_all
def test_get_metric_extraction_config_single_standard_widget(default_project: Project) -> None:
    with Feature({ON_DEMAND_METRICS_WIDGETS: True}):
        create_widget(["count()"], "", default_project)

        assert not get_metric_extraction_config(default_project)


@django_db_all
def test_get_metric_extraction_config_single_widget(default_project: Project) -> None:
    with Feature({ON_DEMAND_METRICS_WIDGETS: True}):
        create_widget(["count()"], "transaction.duration:>=1000", default_project)

        config = get_metric_extraction_config(default_project)

        assert config
        assert len(config["metrics"]) == 1
        assert config["metrics"][0] == {
            "category": "transaction",
            "condition": {"name": "event.duration", "op": "gte", "value": 1000.0},
            "field": None,
            "mri": "c:transactions/on_demand@none",
            "tags": [
                {"key": "query_hash", "value": "a312e0db"},
                {"field": "event.environment", "key": "environment"},
            ],
        }


@django_db_all
def test_get_metric_extraction_config_single_widget_multiple_aggregates(
    default_project: Project,
) -> None:
    # widget with multiple fields should result in multiple metrics
    with Feature({ON_DEMAND_METRICS_WIDGETS: True}):
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
            "tags": [
                {"key": "query_hash", "value": "a312e0db"},
                {"field": "event.environment", "key": "environment"},
            ],
        }
        assert config["metrics"][1] == {
            "category": "transaction",
            "condition": {"name": "event.duration", "op": "gte", "value": 1000.0},
            "field": "event.duration",
            "mri": "d:transactions/on_demand@none",
            "tags": [
                {"key": "query_hash", "value": "10acc97f"},
                {"field": "event.environment", "key": "environment"},
            ],
        }


@django_db_all
def test_get_metric_extraction_config_single_widget_multiple_count_if(
    default_project: Project,
) -> None:
    # widget with multiple fields should result in multiple metrics
    with Feature({ON_DEMAND_METRICS_WIDGETS: True}):
        aggregates = [
            "count()",
            "count_if(transaction.duration, greater, 2000)",
            "count_if(transaction.duration, greaterOrEquals, 1000)",
        ]
        create_widget(aggregates, "transaction.duration:>=1000", default_project)

        config = get_metric_extraction_config(default_project)

        assert config
        assert len(config["metrics"]) == 3
        assert config["metrics"][0] == {
            "category": "transaction",
            "condition": {"name": "event.duration", "op": "gte", "value": 1000.0},
            "field": None,
            "mri": "c:transactions/on_demand@none",
            "tags": [
                {"key": "query_hash", "value": "a312e0db"},
                {"field": "event.environment", "key": "environment"},
            ],
        }
        assert config["metrics"][1] == {
            "category": "transaction",
            "condition": {
                "inner": [
                    {"name": "event.duration", "op": "gte", "value": 1000.0},
                    {"name": "event.duration", "op": "gt", "value": 2000.0},
                ],
                "op": "and",
            },
            "field": None,
            "mri": "c:transactions/on_demand@none",
            "tags": [
                {"key": "query_hash", "value": "e2977925"},
                {"field": "event.environment", "key": "environment"},
            ],
        }
        assert config["metrics"][2] == {
            "category": "transaction",
            "condition": {
                "inner": [
                    {"name": "event.duration", "op": "gte", "value": 1000.0},
                    {"name": "event.duration", "op": "gte", "value": 1000.0},
                ],
                "op": "and",
            },
            "field": None,
            "mri": "c:transactions/on_demand@none",
            "tags": [
                {"key": "query_hash", "value": "c50b5bc7"},
                {"field": "event.environment", "key": "environment"},
            ],
        }


@django_db_all
def test_get_metric_extraction_config_multiple_aggregates_single_field(
    default_project: Project,
) -> None:
    # widget with multiple aggregates on the same field in a single metric
    with Feature({ON_DEMAND_METRICS_WIDGETS: True}):
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
            "tags": [
                {"key": "query_hash", "value": "10acc97f"},
                {"field": "event.environment", "key": "environment"},
            ],
        }


@django_db_all
def test_get_metric_extraction_config_multiple_widgets_duplicated(default_project: Project) -> None:
    # metrics should be deduplicated across widgets
    with Feature({ON_DEMAND_METRICS_WIDGETS: True}):
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
            "tags": [
                {"key": "query_hash", "value": "a312e0db"},
                {"field": "event.environment", "key": "environment"},
            ],
        }
        assert config["metrics"][1] == {
            "category": "transaction",
            "condition": {"name": "event.duration", "op": "gte", "value": 1000.0},
            "field": "event.duration",
            "mri": "d:transactions/on_demand@none",
            "tags": [
                {"key": "query_hash", "value": "10acc97f"},
                {"field": "event.environment", "key": "environment"},
            ],
        }


@django_db_all
def test_get_metric_extraction_config_alerts_and_widgets_off(default_project: Project) -> None:
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
            "tags": [{"key": "query_hash", "value": "a312e0db"}],
        }


@django_db_all
def test_get_metric_extraction_config_alerts_and_widgets(default_project: Project) -> None:
    # deduplication should work across alerts and widgets
    with Feature({ON_DEMAND_METRICS_WIDGETS: True}):
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
            "tags": [
                {"key": "query_hash", "value": "a312e0db"},
                {"field": "event.environment", "key": "environment"},
            ],
        }
        assert config["metrics"][1] == {
            "category": "transaction",
            "condition": {"name": "event.duration", "op": "gte", "value": 1000.0},
            "field": "event.duration",
            "mri": "d:transactions/on_demand@none",
            "tags": [
                {"key": "query_hash", "value": "10acc97f"},
                {"key": "environment", "field": "event.environment"},
            ],
        }


@django_db_all
def test_get_metric_extraction_config_with_failure_count(default_project: Project) -> None:
    with Feature({ON_DEMAND_METRICS_WIDGETS: True}):
        create_widget(["failure_count()"], "transaction.duration:>=1000", default_project)

        config = get_metric_extraction_config(default_project)

        assert config
        assert len(config["metrics"]) == 1
        assert config["metrics"][0] == {
            "category": "transaction",
            "condition": {"name": "event.duration", "op": "gte", "value": 1000.0},
            "field": None,
            "mri": "c:transactions/on_demand@none",
            "tags": [
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
                {"key": "query_hash", "value": "c3a2ddea"},
                {"key": "environment", "field": "event.environment"},
            ],
        }


@django_db_all
def test_get_metric_extraction_config_with_apdex(default_project: Project) -> None:
    with Feature({ON_DEMAND_METRICS: True}):
        threshold = 10
        create_alert(f"apdex({threshold})", "transaction.duration:>=1000", default_project)
        # The threshold stored in the database will not be considered and rather the one from the parameter will be
        # preferred.
        create_project_threshold(default_project, 200, TransactionMetric.DURATION.value)

        config = get_metric_extraction_config(default_project)

        assert config
        assert len(config["metrics"]) == 1
        assert config["metrics"][0] == {
            "category": "transaction",
            "condition": {"name": "event.duration", "op": "gte", "value": 1000.0},
            "field": None,
            "mri": "c:transactions/on_demand@none",
            "tags": [
                {
                    "condition": {"name": "event.duration", "op": "lte", "value": threshold},
                    "key": "satisfaction",
                    "value": "satisfactory",
                },
                {
                    "condition": {
                        "inner": [
                            {"name": "event.duration", "op": "gt", "value": threshold},
                            {"name": "event.duration", "op": "lte", "value": threshold * 4},
                        ],
                        "op": "and",
                    },
                    "key": "satisfaction",
                    "value": "tolerable",
                },
                {
                    "condition": {"name": "event.duration", "op": "gt", "value": threshold * 4},
                    "key": "satisfaction",
                    "value": "frustrated",
                },
                {"key": "query_hash", "value": "4445a852"},
            ],
        }


@django_db_all
@pytest.mark.parametrize("measurement_rating", ["good", "meh", "poor", "any"])
@pytest.mark.parametrize("measurement", ["measurements.lcp"])
def test_get_metric_extraction_config_with_count_web_vitals(
    default_project: Project, measurement_rating: str, measurement: str
) -> None:
    with Feature({ON_DEMAND_METRICS_WIDGETS: True}):
        create_widget(
            [f"count_web_vitals({measurement}, {measurement_rating})"],
            "transaction.duration:>=1000",
            default_project,
        )

        config = get_metric_extraction_config(default_project)

        vital = measurement.split(".")[1]

        assert config
        assert len(config["metrics"]) == 1

        if measurement_rating == "good":
            assert config["metrics"][0] == {
                "category": "transaction",
                "condition": {"name": "event.duration", "op": "gte", "value": 1000.0},
                "field": None,
                "mri": "c:transactions/on_demand@none",
                "tags": [
                    {
                        "condition": {
                            "name": f"event.{measurement}.value",
                            "op": "lt",
                            "value": VITAL_THRESHOLDS[vital]["meh"],
                        },
                        "key": "measurement_rating",
                        "value": "matches_hash",
                    },
                    {"key": "query_hash", "value": "30cb4ba5"},
                    {"key": "environment", "field": "event.environment"},
                ],
            }

        if measurement_rating == "meh":
            assert config["metrics"][0] == {
                "category": "transaction",
                "condition": {"name": "event.duration", "op": "gte", "value": 1000.0},
                "field": None,
                "mri": "c:transactions/on_demand@none",
                "tags": [
                    {
                        "condition": {
                            "inner": [
                                {
                                    "name": f"event.{measurement}.value",
                                    "op": "gte",
                                    "value": VITAL_THRESHOLDS[vital]["meh"],
                                },
                                {
                                    "name": f"event.{measurement}.value",
                                    "op": "lt",
                                    "value": VITAL_THRESHOLDS[vital]["poor"],
                                },
                            ],
                            "op": "and",
                        },
                        "key": "measurement_rating",
                        "value": "matches_hash",
                    },
                    {"key": "query_hash", "value": "f207c139"},
                    {"key": "environment", "field": "event.environment"},
                ],
            }

        if measurement_rating == "poor":
            assert config["metrics"][0] == {
                "category": "transaction",
                "condition": {"name": "event.duration", "op": "gte", "value": 1000.0},
                "field": None,
                "mri": "c:transactions/on_demand@none",
                "tags": [
                    {
                        "condition": {
                            "name": f"event.{measurement}.value",
                            "op": "gte",
                            "value": VITAL_THRESHOLDS[vital]["poor"],
                        },
                        "key": "measurement_rating",
                        "value": "matches_hash",
                    },
                    {"key": "query_hash", "value": "051c26d1"},
                    {"key": "environment", "field": "event.environment"},
                ],
            }

        if measurement_rating == "any":
            assert config["metrics"][0] == {
                "category": "transaction",
                "condition": {"name": "event.duration", "op": "gte", "value": 1000.0},
                "field": None,
                "mri": "c:transactions/on_demand@none",
                "tags": [
                    {
                        "condition": {
                            "name": f"event.{measurement}.value",
                            "op": "gte",
                            "value": 0,
                        },
                        "key": "measurement_rating",
                        "value": "matches_hash",
                    },
                    {"key": "query_hash", "value": "511aaa66"},
                    {"key": "environment", "field": "event.environment"},
                ],
            }

        if measurement_rating == "":
            assert config["metrics"][0] == {
                "category": "transaction",
                "condition": {"name": "event.duration", "op": "gte", "value": 1000.0},
                "field": None,
                "mri": "c:transactions/on_demand@none",
                "tags": [
                    {"key": "environment", "field": "event.environment"},
                ],
            }


@django_db_all
def test_get_metric_extraction_config_with_user_misery(default_project: Project) -> None:
    threshold = 100
    duration = 1000
    with Feature({ON_DEMAND_METRICS_WIDGETS: True}):
        create_widget(
            [f"user_misery({threshold})"],
            f"transaction.duration:>={duration}",
            default_project,
        )

        config = get_metric_extraction_config(default_project)

        assert config
        assert config["metrics"] == [
            {
                "category": "transaction",
                "condition": {"name": "event.duration", "op": "gte", "value": float(duration)},
                # This is necessary for calculating unique users
                "field": "event.user.id",
                "mri": "s:transactions/on_demand@none",
                "tags": [
                    {
                        "condition": {"name": "event.duration", "op": "gt", "value": threshold * 4},
                        "key": "satisfaction",
                        "value": "frustrated",
                    },
                    {"key": "query_hash", "value": "1394a552"},
                    {"key": "environment", "field": "event.environment"},
                ],
            }
        ]


@django_db_all
def test_get_metric_extraction_config_user_misery_with_tag_columns(
    default_project: Project,
) -> None:
    threshold = 100
    duration = 1000
    with Feature({ON_DEMAND_METRICS_WIDGETS: True}):
        create_widget(
            [f"user_misery({threshold})"],
            f"transaction.duration:>={duration}",
            default_project,
            "Dashboard",
            columns=["lcp.element", "custom"],
        )

        config = get_metric_extraction_config(default_project)

        assert config
        assert config["metrics"] == [
            {
                "category": "transaction",
                "condition": {"name": "event.duration", "op": "gte", "value": float(duration)},
                # This is necessary for calculating unique users
                "field": "event.user.id",
                "mri": "s:transactions/on_demand@none",
                "tags": [
                    {
                        "condition": {"name": "event.duration", "op": "gt", "value": threshold * 4},
                        "key": "satisfaction",
                        "value": "frustrated",
                    },
                    {"key": "query_hash", "value": "565e1845"},
                    {"key": "lcp.element", "field": "event.tags.lcp.element"},
                    {"key": "custom", "field": "event.tags.custom"},
                    {"key": "environment", "field": "event.environment"},
                ],
            }
        ]


@django_db_all
def test_get_metric_extraction_config_epm_with_non_tag_columns(default_project: Project) -> None:
    duration = 1000
    with Feature({ON_DEMAND_METRICS_WIDGETS: True}):
        create_widget(
            ["epm()"],
            f"transaction.duration:>={duration}",
            default_project,
            "Dashboard",
            columns=["user.id", "release"],
        )

        config = get_metric_extraction_config(default_project)

        assert config
        assert config["metrics"] == [
            {
                "category": "transaction",
                "condition": {"name": "event.duration", "op": "gte", "value": float(duration)},
                "field": None,
                "mri": "c:transactions/on_demand@none",
                "tags": [
                    {"key": "query_hash", "value": "d9f30df7"},
                    {"key": "user.id", "field": "event.user.id"},
                    {"key": "release", "field": "event.release"},
                    {"key": "environment", "field": "event.environment"},
                ],
            }
        ]


@django_db_all
@override_options({"on_demand.max_widget_cardinality.count": -1})
def test_get_metric_extraction_config_with_high_cardinality(default_project: Project) -> None:
    duration = 1000
    with Feature({ON_DEMAND_METRICS_WIDGETS: True}):
        create_widget(
            ["epm()"],
            f"transaction.duration:>={duration}",
            default_project,
            columns=["user.id", "release", "count()"],
        )

        config = get_metric_extraction_config(default_project)

        assert not config


@django_db_all
@override_options({"on_demand.max_widget_cardinality.count": 1})
def test_get_metric_extraction_config_with_low_cardinality(default_project: Project) -> None:
    duration = 1000
    with Feature({ON_DEMAND_METRICS_WIDGETS: True}):
        create_widget(
            ["epm()"],
            f"transaction.duration:>={duration}",
            default_project,
            columns=["user.id", "release", "count()"],
        )

        config = get_metric_extraction_config(default_project)

        assert config


@django_db_all
@pytest.mark.parametrize("metric", [("epm()"), ("eps()")])
def test_get_metric_extraction_config_with_no_tag_spec(
    default_project: Project, metric: str
) -> None:
    query_hash = "8f8293cf" if metric == "epm()" else "9ffdd8ac"
    with Feature({ON_DEMAND_METRICS_WIDGETS: True}):
        create_widget([metric], "transaction.duration:>=1000", default_project)

        config = get_metric_extraction_config(default_project)

        assert config
        assert len(config["metrics"]) == 1
        assert config["metrics"][0] == {
            "category": "transaction",
            "condition": {"name": "event.duration", "op": "gte", "value": 1000.0},
            "field": None,
            "mri": "c:transactions/on_demand@none",
            "tags": [
                {"key": "query_hash", "value": query_hash},
                {"field": "event.environment", "key": "environment"},
            ],
        }


@django_db_all
@pytest.mark.parametrize(
    "enabled_features, number_of_metrics",
    [
        ([ON_DEMAND_METRICS], 1),  # Alerts.
        ([ON_DEMAND_METRICS_PREFILL], 1),  # Alerts.
        ([ON_DEMAND_METRICS, ON_DEMAND_METRICS_PREFILL], 1),  # Alerts.
        ([ON_DEMAND_METRICS, ON_DEMAND_METRICS_WIDGETS], 2),  # Alerts and widgets.
        ([ON_DEMAND_METRICS_WIDGETS], 1),  # Widgets.
        ([ON_DEMAND_METRICS_PREFILL, ON_DEMAND_METRICS_WIDGETS], 2),  # Alerts and widget.
        ([], 0),  # Nothing.
    ],
)
def test_get_metrics_extraction_config_features_combinations(
    enabled_features: str, number_of_metrics: int, default_project: Project
) -> None:
    create_alert("count()", "transaction.duration:>=10", default_project)
    create_widget(["count()"], "transaction.duration:>=20", default_project)

    features = {feature: True for feature in enabled_features}
    with Feature(features):
        config = get_metric_extraction_config(default_project)
        if number_of_metrics == 0:
            assert config is None
        else:
            assert config is not None
            assert len(config["metrics"]) == number_of_metrics


@django_db_all
def test_get_metric_extraction_config_with_transactions_dataset(default_project: Project) -> None:
    create_alert(
        "count()", "transaction.duration:>=10", default_project, dataset=Dataset.PerformanceMetrics
    )
    create_alert(
        "count()", "transaction.duration:>=20", default_project, dataset=Dataset.Transactions
    )

    # We test with prefilling, and we expect that both alerts are fetched since we support both datasets.
    with Feature({ON_DEMAND_METRICS_PREFILL: True}):
        config = get_metric_extraction_config(default_project)

        assert config
        assert len(config["metrics"]) == 2
        assert config["metrics"][0] == {
            "category": "transaction",
            "condition": {"name": "event.duration", "op": "gte", "value": 10.0},
            "field": None,
            "mri": "c:transactions/on_demand@none",
            "tags": [{"key": "query_hash", "value": "f1353b0f"}],
        }
        assert config["metrics"][1] == {
            "category": "transaction",
            "condition": {"name": "event.duration", "op": "gte", "value": 20.0},
            "field": None,
            "mri": "c:transactions/on_demand@none",
            "tags": [{"key": "query_hash", "value": "a547e4d9"}],
        }

    # We test without prefilling, and we expect that only alerts for performance metrics are fetched.
    with Feature({ON_DEMAND_METRICS: True}):
        config = get_metric_extraction_config(default_project)

        assert config
        assert len(config["metrics"]) == 1
        assert config["metrics"][0] == {
            "category": "transaction",
            "condition": {"name": "event.duration", "op": "gte", "value": 10.0},
            "field": None,
            "mri": "c:transactions/on_demand@none",
            "tags": [{"key": "query_hash", "value": "f1353b0f"}],
        }


@django_db_all
def test_get_metric_extraction_config_with_no_spec(default_project: Project) -> None:
    create_alert(
        "apdex(300)",
        "",
        default_project,
        dataset=Dataset.PerformanceMetrics,
    )

    with Feature({ON_DEMAND_METRICS: True}):
        config = get_metric_extraction_config(default_project)

        assert config
        assert len(config["metrics"]) == 1
        assert config["metrics"][0].get("condition") is None
