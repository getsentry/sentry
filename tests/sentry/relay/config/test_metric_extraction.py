from typing import Any, Optional, Sequence
from unittest import mock

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
from sentry.snuba.metrics.extraction import MetricSpecType, OnDemandMetricSpec
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
        assert config["metrics"] == [
            {
                "category": "transaction",
                "condition": {"name": "event.duration", "op": "gte", "value": 1000.0},
                "field": None,
                "mri": "c:transactions/on_demand@none",
                "tags": [
                    {"key": "query_hash", "value": "a312e0db"},
                ],
            }
        ]


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
        assert config["metrics"] == [
            {
                "category": "transaction",
                "condition": {
                    "inner": [
                        {"name": "event.environment", "op": "eq", "value": "development"},
                        {
                            "inner": [
                                {
                                    "name": "event.tags.device.platform",
                                    "op": "eq",
                                    "value": "android",
                                },
                                {"name": "event.tags.device.platform", "op": "eq", "value": "ios"},
                            ],
                            "op": "or",
                        },
                    ],
                    "op": "and",
                },
                "field": None,
                "mri": "c:transactions/on_demand@none",
                "tags": [
                    {"key": "query_hash", "value": "ca87c609"},
                ],
            }
        ]


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
@override_options({"on_demand.max_alert_specs": 1})
def test_get_metric_extraction_config_multiple_alerts_above_max_limit(
    capfd: Any,
    default_project: Project,
) -> None:
    with Feature(ON_DEMAND_METRICS):
        create_alert("count()", "transaction.duration:>=1000", default_project)
        create_alert("count()", "transaction.duration:>=2000", default_project)

        config = get_metric_extraction_config(default_project)

        with mock.patch("sentry_sdk.capture_exception") as capture_exception:
            config = get_metric_extraction_config(default_project)
            assert config

            assert capture_exception.call_count == 1
            exception = capture_exception.call_args.args[0]
            assert (
                exception.args[0]
                == "Spec version 1: Too many (2) on demand metric alerts for org baz"
            )

        # Since we have set a maximum of 1 we will not get 2
        assert len(config["metrics"]) == 1


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
        assert config["metrics"] == [
            {
                "category": "transaction",
                "condition": {"name": "event.duration", "op": "gte", "value": 1000.0},
                "field": None,
                "mri": "c:transactions/on_demand@none",
                "tags": [
                    {"key": "query_hash", "value": "a312e0db"},
                    {"key": "environment", "field": "event.environment"},
                ],
            }
        ]


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
        assert config["metrics"] == [
            {
                "category": "transaction",
                "condition": {"name": "event.duration", "op": "gte", "value": 1000.0},
                "field": None,
                "mri": "c:transactions/on_demand@none",
                "tags": [
                    {"key": "query_hash", "value": "a312e0db"},
                    {"key": "environment", "field": "event.environment"},
                ],
            },
            {
                "category": "transaction",
                "condition": {"name": "event.duration", "op": "gte", "value": 1000.0},
                "field": "event.duration",
                "mri": "d:transactions/on_demand@none",
                "tags": [
                    {"key": "query_hash", "value": "10acc97f"},
                    {"key": "environment", "field": "event.environment"},
                ],
            },
        ]


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
        assert config["metrics"] == [
            {
                "category": "transaction",
                "condition": {"name": "event.duration", "op": "gte", "value": 1000.0},
                "field": None,
                "mri": "c:transactions/on_demand@none",
                "tags": [
                    {"key": "query_hash", "value": "a312e0db"},
                    {"key": "environment", "field": "event.environment"},
                ],
            },
            {
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
                    {"key": "environment", "field": "event.environment"},
                ],
            },
            {
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
                    {"key": "environment", "field": "event.environment"},
                ],
            },
        ]


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
        assert config["metrics"] == [
            {
                "category": "transaction",
                "condition": {"name": "event.duration", "op": "gte", "value": 1000.0},
                "field": "event.duration",
                "mri": "d:transactions/on_demand@none",
                "tags": [
                    {"key": "query_hash", "value": "10acc97f"},
                    {"key": "environment", "field": "event.environment"},
                ],
            },
        ]


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
        assert config["metrics"] == [
            {
                "category": "transaction",
                "condition": {"name": "event.duration", "op": "gte", "value": 1000.0},
                "field": None,
                "mri": "c:transactions/on_demand@none",
                "tags": [
                    {"key": "query_hash", "value": "a312e0db"},
                    {"key": "environment", "field": "event.environment"},
                ],
            },
            {
                "category": "transaction",
                "condition": {"name": "event.duration", "op": "gte", "value": 1000.0},
                "field": "event.duration",
                "mri": "d:transactions/on_demand@none",
                "tags": [
                    {"key": "query_hash", "value": "10acc97f"},
                    {"key": "environment", "field": "event.environment"},
                ],
            },
        ]


@django_db_all
@override_options({"on_demand.max_widget_specs": 1})
def test_get_metric_extraction_config_multiple_widgets_above_max_limit(
    capfd: Any,
    default_project: Project,
) -> None:
    with Feature({ON_DEMAND_METRICS_WIDGETS: True}):
        create_widget(["count()"], "transaction.duration:>=1100", default_project)
        create_widget(["count()"], "transaction.duration:>=1000", default_project, "Dashboard 2")

        with mock.patch("sentry_sdk.capture_exception") as capture_exception:
            config = get_metric_extraction_config(default_project)
            assert config

            assert capture_exception.call_count == 1
            exception = capture_exception.call_args.args[0]
            assert (
                exception.args[0]
                == "Spec version 1: Too many (2) on demand metric widgets for org baz"
            )

        # Since we have set a maximum of 1 we will not get 2
        assert len(config["metrics"]) == 1


@django_db_all
@override_options({"on_demand.max_widget_specs": 1, "on_demand.extended_max_widget_specs": 0})
def test_get_metric_extraction_config_multiple_widgets_not_using_extended_specs(
    capfd: Any,
    default_project: Project,
) -> None:
    with Feature({ON_DEMAND_METRICS_WIDGETS: True}):
        create_widget(["count()"], "transaction.duration:>=1100", default_project)
        create_widget(["count()"], "transaction.duration:>=1000", default_project, "Dashboard 2")

        with mock.patch("sentry_sdk.capture_exception") as capture_exception:
            config = get_metric_extraction_config(default_project)
            assert config

            assert capture_exception.call_count == 1
            exception = capture_exception.call_args.args[0]
            assert (
                exception.args[0]
                == "Spec version 1: Too many (2) on demand metric widgets for org baz"
            )

        # Since we have set a maximum of 1 we will not get 2
        assert len(config["metrics"]) == 1


@django_db_all
@override_options({"on_demand.max_widget_specs": 0, "on_demand.extended_max_widget_specs": 1})
def test_get_metric_extraction_config_multiple_widgets_above_extended_max_limit(
    capfd: Any,
    default_project: Project,
) -> None:
    with Feature({ON_DEMAND_METRICS_WIDGETS: True}), override_options(
        {"on_demand.extended_widget_spec_orgs": [default_project.organization.id]}
    ):
        create_widget(["count()"], "transaction.duration:>=1100", default_project)
        create_widget(["count()"], "transaction.duration:>=1000", default_project, "Dashboard 2")

        with mock.patch("sentry_sdk.capture_exception") as capture_exception:
            config = get_metric_extraction_config(default_project)
            assert config

            assert capture_exception.call_count == 1
            exception = capture_exception.call_args.args[0]
            assert (
                exception.args[0]
                == "Spec version 1: Too many (2) on demand metric widgets for org baz"
            )

        # Since we have set a maximum of 1 we will not get 2
        assert len(config["metrics"]) == 1


@django_db_all
@override_options({"on_demand.max_widget_specs": 0, "on_demand.extended_max_widget_specs": 2})
def test_get_metric_extraction_config_multiple_widgets_under_extended_max_limit(
    default_project: Project,
) -> None:
    with Feature({ON_DEMAND_METRICS_WIDGETS: True}), override_options(
        {"on_demand.extended_widget_spec_orgs": [default_project.organization.id]}
    ):
        create_widget(["count()"], "transaction.duration:>=1100", default_project)
        create_widget(["count()"], "transaction.duration:>=1000", default_project, "Dashboard 2")

        config = get_metric_extraction_config(default_project)

        assert config
        assert len(config["metrics"]) == 2


@django_db_all
def test_get_metric_extraction_config_alerts_and_widgets_off(default_project: Project) -> None:
    # widgets should be skipped if the feature is off
    with Feature({ON_DEMAND_METRICS: True, ON_DEMAND_METRICS_WIDGETS: False}):
        create_alert("count()", "transaction.duration:>=1000", default_project)
        create_widget(["count()"], "transaction.duration:>=1000", default_project)

        config = get_metric_extraction_config(default_project)

        assert config
        assert config["metrics"] == [
            {
                "category": "transaction",
                "condition": {"name": "event.duration", "op": "gte", "value": 1000.0},
                "field": None,
                "mri": "c:transactions/on_demand@none",
                "tags": [
                    {"key": "query_hash", "value": "a312e0db"},
                ],
            }
        ]


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
        assert config["metrics"] == [
            {
                "category": "transaction",
                "condition": {"name": "event.duration", "op": "gte", "value": 1000.0},
                "field": None,
                "mri": "c:transactions/on_demand@none",
                "tags": [
                    {"key": "query_hash", "value": "a312e0db"},
                    {"key": "environment", "field": "event.environment"},
                ],
            },
            {
                "category": "transaction",
                "condition": {"name": "event.duration", "op": "gte", "value": 1000.0},
                "field": "event.duration",
                "mri": "d:transactions/on_demand@none",
                "tags": [
                    {"key": "query_hash", "value": "10acc97f"},
                    {"key": "environment", "field": "event.environment"},
                ],
            },
        ]


@django_db_all
def test_get_metric_extraction_config_with_failure_count(default_project: Project) -> None:
    with Feature({ON_DEMAND_METRICS_WIDGETS: True}):
        create_widget(["failure_count()"], "transaction.duration:>=1000", default_project)

        config = get_metric_extraction_config(default_project)

        assert config
        assert config["metrics"] == [
            {
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
            },
        ]


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

        if measurement_rating == "good":
            assert config["metrics"] == [
                {
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
                },
            ]

        if measurement_rating == "meh":
            assert config["metrics"] == [
                {
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
                },
            ]

        if measurement_rating == "poor":
            assert config["metrics"] == [
                {
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
                },
            ]

        if measurement_rating == "any":
            assert config["metrics"] == [
                {
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
                },
            ]

        if measurement_rating == "":
            assert config["metrics"] == [
                {
                    "category": "transaction",
                    "condition": {"name": "event.duration", "op": "gte", "value": 1000.0},
                    "field": None,
                    "mri": "c:transactions/on_demand@none",
                    "tags": [
                        {"key": "environment", "field": "event.environment"},
                    ],
                },
            ]


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
            },
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
            },
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
            },
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
def test_get_metric_extraction_config_multiple_widgets_with_high_cardinality(
    default_project: Project,
) -> None:
    duration = 1000
    with Feature({ON_DEMAND_METRICS_WIDGETS: True}), mock.patch(
        "sentry.relay.config.metric_extraction._is_widget_query_low_cardinality"
    ) as mock_cardinality:
        mock_cardinality.side_effect = [True, False, True]
        create_widget(
            ["epm()"],
            f"transaction.duration:>={duration}",
            default_project,
            columns=["user.id", "release", "count()"],
            title="Widget1",
        )
        create_widget(
            ["epm()"],
            f"transaction.duration:>={duration + 1}",
            default_project,
            columns=["user.id", "release", "count()"],
            title="Widget2",
        )
        create_widget(
            ["epm()"],
            f"transaction.duration:>={duration + 2}",
            default_project,
            columns=["user.id", "release", "count()"],
            title="Widget3",
        )

        config = get_metric_extraction_config(default_project)

        assert config
        assert len(config["metrics"]) == 2


@django_db_all
@override_options({"on_demand.max_widget_cardinality.count": 1})
def test_get_metric_extraction_config_with_extraction_enabled(default_project: Project) -> None:
    duration = 1000
    with Feature({ON_DEMAND_METRICS_WIDGETS: True}), mock.patch(
        "sentry.relay.config.metric_extraction._can_widget_query_use_stateful_extraction"
    ) as mock_can_use_stateful, mock.patch(
        "sentry.relay.config.metric_extraction._widget_query_stateful_extraction_enabled"
    ) as mock_extraction_enabled:
        mock_can_use_stateful.return_value = True
        mock_extraction_enabled.return_value = True
        create_widget(
            ["epm()"],
            f"transaction.duration:>={duration}",
            default_project,
            columns=["user.id", "release", "count()"],
        )

        config = get_metric_extraction_config(default_project)

        assert config


@django_db_all
@override_options(
    {
        "on_demand.max_widget_cardinality.count": -1,
        "on_demand_metrics.widgets.use_stateful_extraction": True,
    }
)
def test_stateful_get_metric_extraction_config_with_extraction_disabled(
    default_project: Project,
) -> None:
    duration = 1000
    with Feature({ON_DEMAND_METRICS_WIDGETS: True}), mock.patch(
        "sentry.relay.config.metric_extraction._can_widget_query_use_stateful_extraction"
    ) as mock_can_use_stateful, mock.patch(
        "sentry.relay.config.metric_extraction._widget_query_stateful_extraction_enabled"
    ) as mock_extraction_enabled:
        mock_can_use_stateful.return_value = True
        mock_extraction_enabled.return_value = False
        create_widget(
            ["epm()"],
            f"transaction.duration:>={duration}",
            default_project,
            columns=["user.id", "release", "count()"],
        )

        config = get_metric_extraction_config(default_project)

        assert not config


@django_db_all
@override_options({"on_demand_metrics.widgets.use_stateful_extraction": True})
def test_stateful_get_metric_extraction_config_multiple_widgets_with_extraction_partially_disabled(
    default_project: Project,
) -> None:
    duration = 1000
    with Feature({ON_DEMAND_METRICS_WIDGETS: True}), mock.patch(
        "sentry.relay.config.metric_extraction._can_widget_query_use_stateful_extraction"
    ) as mock_can_use_stateful, mock.patch(
        "sentry.relay.config.metric_extraction._widget_query_stateful_extraction_enabled"
    ) as mock_extraction_enabled:
        mock_can_use_stateful.return_value = True
        mock_extraction_enabled.side_effect = [True, False, True]
        create_widget(
            ["epm()"],
            f"transaction.duration:>={duration}",
            default_project,
            columns=["user.id", "release", "count()"],
            title="Widget1",
        )
        create_widget(
            ["epm()"],
            f"transaction.duration:>={duration + 1}",
            default_project,
            columns=["user.id", "release", "count()"],
            title="Widget2",
        )
        create_widget(
            ["epm()"],
            f"transaction.duration:>={duration + 2}",
            default_project,
            columns=["user.id", "release", "count()"],
            title="Widget3",
        )

        config = get_metric_extraction_config(default_project)

        assert config
        assert len(config["metrics"]) == 2


@django_db_all
@override_options(
    {
        "on_demand.max_widget_cardinality.count": 1,
        "on_demand_metrics.widgets.use_stateful_extraction": True,
    }
)
def test_stateful_get_metric_extraction_config_with_low_cardinality(
    default_project: Project,
) -> None:
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
def test_get_metric_extraction_config_with_unicode_character(default_project: Project) -> None:
    with Feature({ON_DEMAND_METRICS_WIDGETS: True}):
        # This will cause the Unicode bug to be raised for the current version
        create_widget(["count()"], "user.name:Armén", default_project)
        create_widget(["count()"], "user.name:Kevan", default_project, title="Dashboard Foo")
        config = get_metric_extraction_config(default_project)
        assert config
        assert config["metrics"] == [
            {
                "category": "transaction",
                "condition": {"name": "event.tags.user.name", "op": "eq", "value": "Armén"},
                "field": None,
                "mri": "c:transactions/on_demand@none",
                "tags": [
                    {"key": "query_hash", "value": "d3e07bdf"},
                    {"key": "environment", "field": "event.environment"},
                ],
            },
            {
                "category": "transaction",
                "condition": {"name": "event.tags.user.name", "op": "eq", "value": "Kevan"},
                "field": None,
                "mri": "c:transactions/on_demand@none",
                "tags": [
                    {"key": "query_hash", "value": "5142a1f7"},
                    {"key": "environment", "field": "event.environment"},
                ],
            },
        ]


@django_db_all
@pytest.mark.parametrize("metric", [("epm()"), ("eps()")])
def test_get_metric_extraction_config_with_no_tag_spec(
    default_project: Project, metric: str
) -> None:
    query_hashes = ["8f8293cf"] if metric == "epm()" else ["9ffdd8ac"]
    with Feature({ON_DEMAND_METRICS_WIDGETS: True}):
        create_widget([metric], "transaction.duration:>=1000", default_project)

        config = get_metric_extraction_config(default_project)

        assert config
        assert config["metrics"] == [
            {
                "category": "transaction",
                "condition": {"name": "event.duration", "op": "gte", "value": 1000.0},
                "field": None,
                "mri": "c:transactions/on_demand@none",
                "tags": [
                    {"key": "query_hash", "value": query_hashes[0]},
                    {"key": "environment", "field": "event.environment"},
                ],
            },
        ]


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
        assert config["metrics"] == [
            {
                "category": "transaction",
                "condition": {"name": "event.duration", "op": "gte", "value": 10.0},
                "field": None,
                "mri": "c:transactions/on_demand@none",
                "tags": [
                    {"key": "query_hash", "value": "f1353b0f"},
                ],
            },
            {
                "category": "transaction",
                "condition": {"name": "event.duration", "op": "gte", "value": 20.0},
                "field": None,
                "mri": "c:transactions/on_demand@none",
                "tags": [
                    {"key": "query_hash", "value": "a547e4d9"},
                ],
            },
        ]

    # We test without prefilling, and we expect that only alerts for performance metrics are fetched.
    with Feature({ON_DEMAND_METRICS: True}):
        config = get_metric_extraction_config(default_project)

        assert config
        assert config["metrics"] == [
            {
                "category": "transaction",
                "condition": {"name": "event.duration", "op": "gte", "value": 10.0},
                "field": None,
                "mri": "c:transactions/on_demand@none",
                "tags": [
                    {"key": "query_hash", "value": "f1353b0f"},
                ],
            }
        ]


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


# XXX: This may have bugs, therefore, use with caution
def _on_demand_spec_from_widget(widget: DashboardWidgetQuery) -> OnDemandMetricSpec:
    field = widget.aggregates[0] if widget.aggregates else ""
    return OnDemandMetricSpec(
        field=field,
        query=widget.conditions,
        groupbys=widget.columns,
        spec_type=MetricSpecType.DYNAMIC_QUERY,
    )


# XXX: This may have bugs, therefore, use with caution
def _on_demand_spec_from_alert(alert: AlertRule) -> OnDemandMetricSpec:
    return OnDemandMetricSpec(
        field=alert.snuba_query.aggregate,
        query=alert.snuba_query.query,
        spec_type=MetricSpecType.SIMPLE_QUERY,
    )


def _metric_spec(
    query_hash: str,
    condition: Optional[dict[str, Any]] = None,
    tags: Optional[list[dict[str, str]]] = None,
) -> dict[str, Any]:
    tags = [{"key": "query_hash", "value": query_hash}] + (tags or [])
    return {
        "category": "transaction",
        "condition": condition or {},
        "field": None,
        "mri": "c:transactions/on_demand@none",
        "tags": tags,
    }


@django_db_all
def test_widgets_with_without_environment_do_not_collide(default_project: Project) -> None:
    aggr = "count()"
    query = "transaction.duration:>=10"
    condition = {"name": "event.duration", "op": "gte", "value": 10.0}
    env_tag = {"field": "event.environment", "key": "environment"}

    with Feature([ON_DEMAND_METRICS_WIDGETS]):
        widget1 = create_widget([aggr], query, default_project)
        widget2 = create_widget(
            [aggr], query, default_project, columns=["environment"], title="foo"
        )

        config = get_metric_extraction_config(default_project)
        assert config and config["metrics"] == [
            _metric_spec("f1353b0f", condition, [env_tag]),
            _metric_spec("4fb5a472", condition, [env_tag]),
        ]

        spec1 = _on_demand_spec_from_widget(widget1)
        spec2 = _on_demand_spec_from_widget(widget2)

        expected_query_str_hash = f"None;{condition}"
        assert spec1._query_str_for_hash == expected_query_str_hash
        # The environment is included because columns become groupbys which is included in the query hash
        assert spec2._query_str_for_hash == f"{expected_query_str_hash};['environment']"


@django_db_all
def test_alert_and_widget_colliding(default_project: Project) -> None:
    aggr = "count()"
    query = "transaction.duration:>=10"
    condition = {"name": "event.duration", "op": "gte", "value": 10.0}
    env_tag = {"field": "event.environment", "key": "environment"}

    with Feature([ON_DEMAND_METRICS, ON_DEMAND_METRICS_WIDGETS]):
        widget = create_widget([aggr], query, default_project)

        config = get_metric_extraction_config(default_project)

        assert config and config["metrics"] == [_metric_spec("f1353b0f", condition, [env_tag])]

        alert = create_alert(aggr, query, default_project)
        config = get_metric_extraction_config(default_project)
        # Now that we iterate over the widgets first, we will pick the spec generated by the widget
        # which includes the environment as a tag
        assert config and config["metrics"] == [_metric_spec("f1353b0f", condition, [env_tag])]

        widget_spec = _on_demand_spec_from_widget(widget)
        alert_spec = _on_demand_spec_from_alert(alert)
        expected_query_str_hash = f"None;{condition}"
        assert widget_spec._query_str_for_hash == expected_query_str_hash
        assert alert_spec._query_str_for_hash == expected_query_str_hash
