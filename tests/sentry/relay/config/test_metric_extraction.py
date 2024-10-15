from __future__ import annotations

from collections.abc import Sequence
from datetime import timedelta
from unittest import mock

import pytest
from django.utils import timezone

from sentry.incidents.models.alert_rule import AlertRule, AlertRuleProjects
from sentry.models.dashboard_widget import (
    DashboardWidgetQuery,
    DashboardWidgetQueryOnDemand,
    DashboardWidgetTypes,
)
from sentry.models.environment import Environment
from sentry.models.project import Project
from sentry.models.transaction_threshold import ProjectTransactionThreshold, TransactionMetric
from sentry.relay.config.metric_extraction import (
    _set_bulk_cached_query_chunk,
    get_current_widget_specs,
    get_metric_extraction_config,
)
from sentry.relay.types import RuleCondition
from sentry.search.events.constants import VITAL_THRESHOLDS
from sentry.snuba.dataset import Dataset
from sentry.snuba.metrics.extraction import (
    MetricSpec,
    MetricSpecType,
    OnDemandMetricSpec,
    SpecVersion,
    TagSpec,
    _deep_sorted,
    fetch_on_demand_metric_spec,
)
from sentry.snuba.models import QuerySubscription, SnubaQuery
from sentry.tasks.on_demand_metrics import process_widget_specs
from sentry.testutils.helpers import Feature
from sentry.testutils.helpers.on_demand import create_widget
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
    environment: Environment | None = None,
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
        snuba_query=snuba_query,
        threshold_period=1,
        organization=project.organization,
    )
    AlertRuleProjects.objects.create(alert_rule=alert_rule, project=project)

    return alert_rule


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
    default_project: Project,
) -> None:
    with Feature(ON_DEMAND_METRICS):
        create_alert("count()", "transaction.duration:>=1000", default_project)
        create_alert("count()", "transaction.duration:>=2000", default_project)

        config = get_metric_extraction_config(default_project)

        with mock.patch("sentry_sdk.capture_exception") as capture_exception:
            config = get_metric_extraction_config(default_project)
            assert config

            assert capture_exception.call_count == 2
            exception = capture_exception.call_args.args[0]
            assert (
                exception.args[0]
                == "Spec version 2: Too many (2) on demand metric alerts for org baz"
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
@pytest.mark.parametrize(
    "widget_type", [DashboardWidgetTypes.DISCOVER, DashboardWidgetTypes.TRANSACTION_LIKE]
)
def test_get_metric_extraction_config_single_standard_widget(
    default_project: Project, widget_type: int
) -> None:
    with Feature({ON_DEMAND_METRICS_WIDGETS: True}):
        create_widget(["count()"], "", default_project, widget_type=widget_type)

        assert not get_metric_extraction_config(default_project)


@django_db_all
@pytest.mark.parametrize(
    "widget_type", [DashboardWidgetTypes.DISCOVER, DashboardWidgetTypes.TRANSACTION_LIKE]
)
def test_get_metric_extraction_config_single_widget(
    default_project: Project, widget_type: int
) -> None:
    with Feature({ON_DEMAND_METRICS_WIDGETS: True}):
        create_widget(
            ["count()"], "transaction.duration:>=1000", default_project, widget_type=widget_type
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
                "field": None,
                "mri": "c:transactions/on_demand@none",
                "tags": [
                    {"key": "query_hash", "value": "cf5f5100"},
                    {"key": "environment", "field": "event.environment"},
                ],
            },
        ]


@django_db_all
@pytest.mark.parametrize(
    "widget_type", [DashboardWidgetTypes.DISCOVER, DashboardWidgetTypes.TRANSACTION_LIKE]
)
def test_get_metric_extraction_config_single_widget_multiple_aggregates(
    default_project: Project,
    widget_type: int,
) -> None:
    # widget with multiple fields should result in multiple metrics
    with Feature({ON_DEMAND_METRICS_WIDGETS: True}):
        create_widget(
            ["count()", "avg(transaction.duration)"],
            "transaction.duration:>=1000",
            default_project,
            widget_type=widget_type,
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
            {
                "category": "transaction",
                "condition": {"name": "event.duration", "op": "gte", "value": 1000.0},
                "field": None,
                "mri": "c:transactions/on_demand@none",
                "tags": [
                    {"key": "query_hash", "value": "cf5f5100"},
                    {"key": "environment", "field": "event.environment"},
                ],
            },
            {
                "category": "transaction",
                "condition": {"name": "event.duration", "op": "gte", "value": 1000.0},
                "field": "event.duration",
                "mri": "d:transactions/on_demand@none",
                "tags": [
                    {"key": "query_hash", "value": "3a976c6d"},
                    {"key": "environment", "field": "event.environment"},
                ],
            },
        ]


@django_db_all
@pytest.mark.parametrize(
    "widget_type", [DashboardWidgetTypes.DISCOVER, DashboardWidgetTypes.TRANSACTION_LIKE]
)
def test_get_metric_extraction_config_single_widget_multiple_count_if(
    default_project: Project,
    widget_type: int,
) -> None:
    # widget with multiple fields should result in multiple metrics
    with Feature({ON_DEMAND_METRICS_WIDGETS: True}):
        aggregates = [
            "count()",
            "count_if(transaction.duration, greater, 2000)",
            "count_if(transaction.duration, greaterOrEquals, 1000)",
        ]
        create_widget(
            aggregates, "transaction.duration:>=1000", default_project, widget_type=widget_type
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
            {
                "category": "transaction",
                "condition": {"name": "event.duration", "op": "gte", "value": 1000.0},
                "field": None,
                "mri": "c:transactions/on_demand@none",
                "tags": [
                    {"key": "query_hash", "value": "cf5f5100"},
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
                    {"key": "query_hash", "value": "0061cb28"},
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
                    {"key": "query_hash", "value": "9e291845"},
                    {"key": "environment", "field": "event.environment"},
                ],
            },
        ]


@django_db_all
@pytest.mark.parametrize(
    "widget_type", [DashboardWidgetTypes.DISCOVER, DashboardWidgetTypes.TRANSACTION_LIKE]
)
def test_get_metric_extraction_config_multiple_aggregates_single_field(
    default_project: Project,
    widget_type: int,
) -> None:
    # widget with multiple aggregates on the same field in a single metric
    with Feature({ON_DEMAND_METRICS_WIDGETS: True}):
        create_widget(
            ["sum(transaction.duration)", "avg(transaction.duration)"],
            "transaction.duration:>=1000",
            default_project,
            widget_type=widget_type,
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
            {
                "category": "transaction",
                "condition": {"name": "event.duration", "op": "gte", "value": 1000.0},
                "field": "event.duration",
                "mri": "d:transactions/on_demand@none",
                "tags": [
                    {"key": "query_hash", "value": "3a976c6d"},
                    {"key": "environment", "field": "event.environment"},
                ],
            },
        ]


@django_db_all
@pytest.mark.parametrize(
    "widget_type", [DashboardWidgetTypes.DISCOVER, DashboardWidgetTypes.TRANSACTION_LIKE]
)
def test_get_metric_extraction_config_multiple_widgets_duplicated(
    default_project: Project, widget_type: int
) -> None:
    # metrics should be deduplicated across widgets
    with Feature({ON_DEMAND_METRICS_WIDGETS: True}):
        create_widget(
            ["count()", "avg(transaction.duration)"],
            "transaction.duration:>=1000",
            default_project,
            widget_type=widget_type,
        )
        create_widget(
            ["count()"],
            "transaction.duration:>=1000",
            default_project,
            "Dashboard 2",
            widget_type=widget_type,
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
            {
                "category": "transaction",
                "condition": {"name": "event.duration", "op": "gte", "value": 1000.0},
                "field": None,
                "mri": "c:transactions/on_demand@none",
                "tags": [
                    {"key": "query_hash", "value": "cf5f5100"},
                    {"key": "environment", "field": "event.environment"},
                ],
            },
            {
                "category": "transaction",
                "condition": {"name": "event.duration", "op": "gte", "value": 1000.0},
                "field": "event.duration",
                "mri": "d:transactions/on_demand@none",
                "tags": [
                    {"key": "query_hash", "value": "3a976c6d"},
                    {"key": "environment", "field": "event.environment"},
                ],
            },
        ]


@django_db_all
@override_options({"on_demand.max_widget_specs": 1})
@pytest.mark.parametrize(
    "widget_type", [DashboardWidgetTypes.DISCOVER, DashboardWidgetTypes.TRANSACTION_LIKE]
)
def test_get_metric_extraction_config_multiple_widgets_above_max_limit(
    default_project: Project,
    widget_type: int,
) -> None:
    with Feature({ON_DEMAND_METRICS_WIDGETS: True}):
        create_widget(
            ["count()"], "transaction.duration:>=1100", default_project, widget_type=widget_type
        )
        create_widget(
            ["count()"],
            "transaction.duration:>=1000",
            default_project,
            "Dashboard 2",
            widget_type=widget_type,
        )

        with mock.patch("sentry_sdk.capture_exception") as capture_exception:
            config = get_metric_extraction_config(default_project)
            assert config

            assert capture_exception.call_count == 2
            exception = capture_exception.call_args.args[0]
            assert (
                exception.args[0]
                == "Spec version 2: Too many (2) on demand metric widgets for org baz"
            )

        # Revert to 1 after {"include_environment_tag"} becomes the default
        # Since we have set a maximum of 1 we will not get 2
        assert len(config["metrics"]) == 2


@django_db_all
@override_options({"on_demand.max_widget_specs": 1})
@pytest.mark.parametrize(
    "widget_type", [DashboardWidgetTypes.DISCOVER, DashboardWidgetTypes.TRANSACTION_LIKE]
)
def test_get_metric_extraction_config_multiple_widgets_not_above_max_limit_identical_hashes(
    default_project: Project,
    widget_type: int,
) -> None:
    with Feature({ON_DEMAND_METRICS_WIDGETS: True}):
        create_widget(
            ["count()"], "transaction.duration:>=1000", default_project, widget_type=widget_type
        )
        create_widget(
            ["count()"],
            "transaction.duration:>=1000",
            default_project,
            "Dashboard 2",
            widget_type=widget_type,
        )

        with mock.patch("sentry_sdk.capture_exception") as capture_exception:
            config = get_metric_extraction_config(default_project)
            assert config

            assert capture_exception.call_count == 0


@django_db_all
@override_options({"on_demand.max_widget_specs": 4, "on_demand_metrics.check_widgets.enable": True})
@pytest.mark.parametrize(
    "widget_type", [DashboardWidgetTypes.DISCOVER, DashboardWidgetTypes.TRANSACTION_LIKE]
)
def test_get_metric_extraction_config_multiple_widgets_above_max_limit_ordered_specs(
    default_project: Project,
    widget_type: int,
) -> None:
    with Feature({ON_DEMAND_METRICS_WIDGETS: True}):
        create_widget(
            ["count()"],
            "transaction.duration:>=1000",
            default_project,
            "Dashboard 1",
            widget_type=widget_type,
        )
        create_widget(
            ["count()"],
            "transaction.duration:>=1100",
            default_project,
            "Dashboard 2",
            widget_type=widget_type,
        )
        widget_query, _, _ = create_widget(
            ["count()"],
            "transaction.duration:>=1200",
            default_project,
            "Dashboard 3",
            widget_type=widget_type,
        )
        create_widget(
            ["count()"],
            "transaction.duration:>=1300",
            default_project,
            "Dashboard 4",
            widget_type=widget_type,
        )
        create_widget(
            ["count()"],
            "transaction.duration:>=1400",
            default_project,
            "Dashboard 5",
            widget_type=widget_type,
        )

        widget_query.widget.dashboard.last_visited = timezone.now() - timedelta(days=1)
        widget_query.widget.dashboard.save()

        process_widget_specs([widget_query.id])

        with mock.patch("sentry_sdk.capture_exception") as capture_exception:
            config = get_metric_extraction_config(default_project)

            assert config
            assert len(config["metrics"]) == 8  # 4 * 2 spec versions

            duration_conditions = [spec["condition"]["value"] for spec in config["metrics"]]  # type: ignore[typeddict-item]

            assert duration_conditions == [
                1400.0,
                1300.0,
                1100.0,
                1000.0,
                1400.0,
                1300.0,
                1100.0,
                1000.0,
            ]  # We only exclude the oldest spec (1200.0 duration)

            assert capture_exception.call_count == 2
            exception = capture_exception.call_args.args[0]
            assert (
                exception.args[0]
                == "Spec version 2: Too many (5) on demand metric widgets for org baz"
            )

        # Check that state was correctly updated.
        on_demand_entries = widget_query.dashboardwidgetqueryondemand_set.all()
        assert [entry.extraction_state for entry in on_demand_entries] == [
            "disabled:spec-limit",
            "disabled:spec-limit",
        ]  # Only see the one entry disabled


@django_db_all
@override_options({"on_demand.max_widget_specs": 1, "on_demand.extended_max_widget_specs": 0})
@pytest.mark.parametrize(
    "widget_type", [DashboardWidgetTypes.DISCOVER, DashboardWidgetTypes.TRANSACTION_LIKE]
)
def test_get_metric_extraction_config_multiple_widgets_not_using_extended_specs(
    default_project: Project,
    widget_type: int,
) -> None:
    with Feature({ON_DEMAND_METRICS_WIDGETS: True}):
        create_widget(
            ["count()"], "transaction.duration:>=1100", default_project, widget_type=widget_type
        )
        create_widget(
            ["count()"],
            "transaction.duration:>=1000",
            default_project,
            "Dashboard 2",
            widget_type=widget_type,
        )

        with mock.patch("sentry_sdk.capture_exception") as capture_exception:
            config = get_metric_extraction_config(default_project)
            assert config

            assert capture_exception.call_count == 2
            exception = capture_exception.call_args.args[0]
            assert (
                exception.args[0]
                == "Spec version 2: Too many (2) on demand metric widgets for org baz"
            )

        # Revert to 1 after {"include_environment_tag"} becomes the default
        # Since we have set a maximum of 1 we will not get 2
        assert len(config["metrics"]) == 2


@django_db_all
@override_options({"on_demand.max_widget_specs": 0, "on_demand.extended_max_widget_specs": 1})
@pytest.mark.parametrize(
    "widget_type", [DashboardWidgetTypes.DISCOVER, DashboardWidgetTypes.TRANSACTION_LIKE]
)
def test_get_metric_extraction_config_multiple_widgets_above_extended_max_limit(
    default_project: Project,
    widget_type: int,
) -> None:
    with (
        Feature({ON_DEMAND_METRICS_WIDGETS: True}),
        override_options(
            {"on_demand.extended_widget_spec_orgs": [default_project.organization.id]}
        ),
    ):
        create_widget(
            ["count()"], "transaction.duration:>=1100", default_project, widget_type=widget_type
        )
        create_widget(
            ["count()"],
            "transaction.duration:>=1000",
            default_project,
            "Dashboard 2",
            widget_type=widget_type,
        )

        with mock.patch("sentry_sdk.capture_exception") as capture_exception:
            config = get_metric_extraction_config(default_project)
            assert config

            assert capture_exception.call_count == 2
            exception = capture_exception.call_args.args[0]
            assert (
                exception.args[0]
                == "Spec version 2: Too many (2) on demand metric widgets for org baz"
            )

        # Revert to 1 after {"include_environment_tag"} becomes the default
        # Since we have set a maximum of 1 we will not get 2
        assert len(config["metrics"]) == 2


@django_db_all
@override_options({"on_demand.max_widget_specs": 0, "on_demand.extended_max_widget_specs": 2})
@pytest.mark.parametrize(
    "widget_type", [DashboardWidgetTypes.DISCOVER, DashboardWidgetTypes.TRANSACTION_LIKE]
)
def test_get_metric_extraction_config_multiple_widgets_under_extended_max_limit(
    default_project: Project,
    widget_type: int,
) -> None:
    with (
        Feature({ON_DEMAND_METRICS_WIDGETS: True}),
        override_options(
            {"on_demand.extended_widget_spec_orgs": [default_project.organization.id]}
        ),
    ):
        create_widget(
            ["count()"], "transaction.duration:>=1100", default_project, widget_type=widget_type
        )
        create_widget(
            ["count()"],
            "transaction.duration:>=1000",
            default_project,
            "Dashboard 2",
            widget_type=widget_type,
        )

        config = get_metric_extraction_config(default_project)

        assert config
        # Revert to 2 after {"include_environment_tag"} becomes the default
        assert len(config["metrics"]) == 4


@django_db_all
@pytest.mark.parametrize(
    "widget_type", [DashboardWidgetTypes.DISCOVER, DashboardWidgetTypes.TRANSACTION_LIKE]
)
def test_get_metric_extraction_config_alerts_and_widgets_off(
    default_project: Project, widget_type: int
) -> None:
    # widgets should be skipped if the feature is off
    with Feature({ON_DEMAND_METRICS: True, ON_DEMAND_METRICS_WIDGETS: False}):
        create_alert("count()", "transaction.duration:>=1000", default_project)
        create_widget(
            ["count()"], "transaction.duration:>=1000", default_project, widget_type=widget_type
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
                ],
            }
        ]


@django_db_all
@pytest.mark.parametrize(
    "widget_type", [DashboardWidgetTypes.DISCOVER, DashboardWidgetTypes.TRANSACTION_LIKE]
)
def test_get_metric_extraction_config_uses_cache_for_widgets(
    default_project: Project, widget_type: int
) -> None:
    # widgets should be skipped if the feature is off
    original_set_bulk_cached_query = _set_bulk_cached_query_chunk

    with (
        Feature({ON_DEMAND_METRICS: True, ON_DEMAND_METRICS_WIDGETS: True}),
        override_options({"on_demand_metrics.cache_should_use_on_demand": 1.0}),
        mock.patch(
            "sentry.relay.config.metric_extraction._set_bulk_cached_query_chunk"
        ) as mock_set_cache_chunk_spy,
    ):
        mock_set_cache_chunk_spy.side_effect = original_set_bulk_cached_query
        create_widget(
            ["count()"], "transaction.duration:>=1000", default_project, widget_type=widget_type
        )

        get_metric_extraction_config(default_project)

        assert mock_set_cache_chunk_spy.call_count == 6  # One for each chunk

        get_metric_extraction_config(default_project)
        assert mock_set_cache_chunk_spy.call_count == 6


@django_db_all
@pytest.mark.parametrize(
    "widget_type", [DashboardWidgetTypes.DISCOVER, DashboardWidgetTypes.TRANSACTION_LIKE]
)
def test_get_metric_extraction_config_alerts_and_widgets(
    default_project: Project, widget_type: int
) -> None:
    # deduplication should work across alerts and widgets
    with Feature({ON_DEMAND_METRICS_WIDGETS: True}):
        create_alert("count()", "transaction.duration:>=1000", default_project)
        create_widget(
            ["count()", "avg(transaction.duration)"],
            "transaction.duration:>=1000",
            default_project,
            widget_type=widget_type,
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
            {
                "category": "transaction",
                "condition": {"name": "event.duration", "op": "gte", "value": 1000.0},
                "field": None,
                "mri": "c:transactions/on_demand@none",
                "tags": [
                    {"key": "query_hash", "value": "cf5f5100"},
                    {"key": "environment", "field": "event.environment"},
                ],
            },
            {
                "category": "transaction",
                "condition": {"name": "event.duration", "op": "gte", "value": 1000.0},
                "field": "event.duration",
                "mri": "d:transactions/on_demand@none",
                "tags": [
                    {"key": "query_hash", "value": "3a976c6d"},
                    {"key": "environment", "field": "event.environment"},
                ],
            },
        ]


@django_db_all
@pytest.mark.parametrize(
    "widget_type", [DashboardWidgetTypes.DISCOVER, DashboardWidgetTypes.TRANSACTION_LIKE]
)
def test_get_metric_extraction_config_with_failure_count(
    default_project: Project, widget_type: int
) -> None:
    with Feature({ON_DEMAND_METRICS_WIDGETS: True}):
        create_widget(
            ["failure_count()"],
            "transaction.duration:>=1000",
            default_project,
            widget_type=widget_type,
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
                    {"key": "query_hash", "value": "4e66755b"},
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
@pytest.mark.parametrize(
    "field,query_hash",
    [("user", "899e9132"), ("geo.city", "a85d58a1"), ("non-existent-field", "f2d80826")],
)
@pytest.mark.parametrize(
    "widget_type", [DashboardWidgetTypes.DISCOVER, DashboardWidgetTypes.TRANSACTION_LIKE]
)
def test_get_metric_extraction_config_with_count_unique(
    default_project: Project, field: str, query_hash: str, widget_type: int
) -> None:
    duration = 1000
    query = f"transaction.duration:>={duration}"
    with Feature({ON_DEMAND_METRICS_WIDGETS: True}):
        widget_query, _, _ = create_widget(
            [f"count_unique({field})"], query, default_project, widget_type=widget_type
        )
        assert widget_query.aggregates == [f"count_unique({field})"]
        assert widget_query.conditions == query
        assert widget_query.columns == []

        config = get_metric_extraction_config(default_project)
        assert config
        # Let's only assert the current version of the spec
        spec = config["metrics"][0]
        assert spec["mri"] == "s:transactions/on_demand@none"  # A set rather than a counter
        assert spec["condition"] == {"name": "event.duration", "op": "gte", "value": duration}
        assert spec["field"] == field  # We are extracting the specified field
        assert spec["tags"] == [
            {"key": "query_hash", "value": query_hash},
            {"field": "event.environment", "key": "environment"},
        ]


@django_db_all
@pytest.mark.parametrize("measurement_rating", ["good", "meh", "poor", "any"])
@pytest.mark.parametrize("measurement", ["measurements.lcp"])
@pytest.mark.parametrize(
    "widget_type", [DashboardWidgetTypes.DISCOVER, DashboardWidgetTypes.TRANSACTION_LIKE]
)
def test_get_metric_extraction_config_with_count_web_vitals(
    default_project: Project, measurement_rating: str, measurement: str, widget_type: int
) -> None:
    with Feature({ON_DEMAND_METRICS_WIDGETS: True}):
        create_widget(
            [f"count_web_vitals({measurement}, {measurement_rating})"],
            "transaction.duration:>=1000",
            default_project,
            widget_type=widget_type,
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
                        {"key": "query_hash", "value": "e14212cf"},
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
                        {"key": "query_hash", "value": "be0b73bb"},
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
                        {"key": "query_hash", "value": "57d48347"},
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
                        {"key": "query_hash", "value": "401b8e0e"},
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
@pytest.mark.parametrize(
    "widget_type", [DashboardWidgetTypes.DISCOVER, DashboardWidgetTypes.TRANSACTION_LIKE]
)
def test_get_metric_extraction_config_with_user_misery(
    default_project: Project, widget_type: int
) -> None:
    threshold = 100
    duration = 1000
    # User misery is extracted, querying is behind the version 2 feature flag
    with Feature({ON_DEMAND_METRICS_WIDGETS: True}):
        create_widget(
            [f"user_misery({threshold})"],
            f"transaction.duration:>={duration}",
            default_project,
            widget_type=widget_type,
        )

        config = get_metric_extraction_config(default_project)

        assert config
        assert config["metrics"] == [
            {
                # Spec version 1
                "category": "transaction",
                "condition": {"name": "event.duration", "op": "gte", "value": float(duration)},
                # This is necessary for calculating unique users
                "field": "event.sentry_user",
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
            {
                # Spec version 2
                "category": "transaction",
                "condition": {"name": "event.duration", "op": "gte", "value": float(duration)},
                # This is necessary for calculating unique users
                "field": "event.sentry_user",
                "mri": "s:transactions/on_demand@none",
                "tags": [
                    {
                        "condition": {"name": "event.duration", "op": "gt", "value": threshold * 4},
                        "key": "satisfaction",
                        "value": "frustrated",
                    },
                    {"key": "query_hash", "value": "9fbc729c"},
                    {"key": "environment", "field": "event.environment"},
                ],
            },
        ]


@django_db_all
@pytest.mark.parametrize(
    "widget_type", [DashboardWidgetTypes.DISCOVER, DashboardWidgetTypes.TRANSACTION_LIKE]
)
def test_get_metric_extraction_config_user_misery_with_tag_columns(
    default_project: Project,
    widget_type: int,
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
            widget_type=widget_type,
        )

        config = get_metric_extraction_config(default_project)

        assert config
        assert config["metrics"] == [
            {
                "category": "transaction",
                "condition": {"name": "event.duration", "op": "gte", "value": float(duration)},
                # This is necessary for calculating unique users
                "field": "event.sentry_user",
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
            {
                "category": "transaction",
                "condition": {"name": "event.duration", "op": "gte", "value": float(duration)},
                # This is necessary for calculating unique users
                "field": "event.sentry_user",
                "mri": "s:transactions/on_demand@none",
                "tags": [
                    {
                        "condition": {"name": "event.duration", "op": "gt", "value": threshold * 4},
                        "key": "satisfaction",
                        "value": "frustrated",
                    },
                    {"key": "query_hash", "value": "d508d70d"},
                    {"key": "lcp.element", "field": "event.tags.lcp.element"},
                    {"key": "custom", "field": "event.tags.custom"},
                    {"key": "environment", "field": "event.environment"},
                ],
            },
        ]


@django_db_all
@pytest.mark.parametrize(
    "widget_type", [DashboardWidgetTypes.DISCOVER, DashboardWidgetTypes.TRANSACTION_LIKE]
)
def test_get_metric_extraction_config_epm_with_non_tag_columns(
    default_project: Project, widget_type: int
) -> None:
    duration = 1000
    with Feature({ON_DEMAND_METRICS_WIDGETS: True}):
        create_widget(
            ["epm()"],
            f"transaction.duration:>={duration}",
            default_project,
            "Dashboard",
            columns=["user.id", "user", "release"],
            widget_type=widget_type,
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
                    {"key": "query_hash", "value": "cfdef6f8"},
                    {"key": "user.id", "field": "event.user.id"},
                    {"key": "user", "field": "event.sentry_user"},
                    {"key": "release", "field": "event.release"},
                    {"key": "environment", "field": "event.environment"},
                ],
            },
            {
                "category": "transaction",
                "condition": {"name": "event.duration", "op": "gte", "value": float(duration)},
                "field": None,
                "mri": "c:transactions/on_demand@none",
                "tags": [
                    {"key": "query_hash", "value": "2916fc7c"},
                    {"key": "user.id", "field": "event.user.id"},
                    {"key": "user", "field": "event.sentry_user"},
                    {"key": "release", "field": "event.release"},
                    {"key": "environment", "field": "event.environment"},
                ],
            },
        ]


@django_db_all
@override_options({"on_demand.max_widget_cardinality.count": -1})
@pytest.mark.parametrize(
    "widget_type", [DashboardWidgetTypes.DISCOVER, DashboardWidgetTypes.TRANSACTION_LIKE]
)
def test_get_metric_extraction_config_with_high_cardinality(
    default_project: Project, widget_type: int
) -> None:
    duration = 1000
    with Feature({ON_DEMAND_METRICS_WIDGETS: True}):
        create_widget(
            ["epm()"],
            f"transaction.duration:>={duration}",
            default_project,
            columns=["user.id", "release", "count()"],
            widget_type=widget_type,
        )

        config = get_metric_extraction_config(default_project)

        assert not config


@django_db_all
@pytest.mark.parametrize(
    "widget_type", [DashboardWidgetTypes.DISCOVER, DashboardWidgetTypes.TRANSACTION_LIKE]
)
def test_get_metric_extraction_config_multiple_widgets_with_high_cardinality(
    default_project: Project,
    widget_type: int,
) -> None:
    duration = 1000
    with (
        Feature({ON_DEMAND_METRICS_WIDGETS: True}),
        mock.patch(
            "sentry.relay.config.metric_extraction._is_widget_query_low_cardinality"
        ) as mock_cardinality,
    ):
        mock_cardinality.side_effect = [True, False, True]
        create_widget(
            ["epm()"],
            f"transaction.duration:>={duration}",
            default_project,
            columns=["user.id", "release", "count()"],
            title="Widget1",
            widget_type=widget_type,
        )
        create_widget(
            ["epm()"],
            f"transaction.duration:>={duration + 1}",
            default_project,
            columns=["user.id", "release", "count()"],
            title="Widget2",
            widget_type=widget_type,
        )
        create_widget(
            ["epm()"],
            f"transaction.duration:>={duration + 2}",
            default_project,
            columns=["user.id", "release", "count()"],
            title="Widget3",
            widget_type=widget_type,
        )

        config = get_metric_extraction_config(default_project)

        assert config
        # Revert to 2 after {"include_environment_tag"} becomes the default
        assert len(config["metrics"]) == 4


@django_db_all
@override_options({"on_demand.max_widget_cardinality.count": 1})
@pytest.mark.parametrize(
    "widget_type", [DashboardWidgetTypes.DISCOVER, DashboardWidgetTypes.TRANSACTION_LIKE]
)
def test_get_metric_extraction_config_with_extraction_enabled(
    default_project: Project, widget_type: int
) -> None:
    duration = 1000
    with (
        Feature({ON_DEMAND_METRICS_WIDGETS: True}),
        mock.patch(
            "sentry.relay.config.metric_extraction._can_widget_query_use_stateful_extraction"
        ) as mock_can_use_stateful,
        mock.patch(
            "sentry.relay.config.metric_extraction._widget_query_stateful_extraction_enabled"
        ) as mock_extraction_enabled,
    ):
        mock_can_use_stateful.return_value = True
        mock_extraction_enabled.return_value = True
        create_widget(
            ["epm()"],
            f"transaction.duration:>={duration}",
            default_project,
            columns=["user.id", "release", "count()"],
            widget_type=widget_type,
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
@pytest.mark.parametrize(
    "widget_type", [DashboardWidgetTypes.DISCOVER, DashboardWidgetTypes.TRANSACTION_LIKE]
)
def test_stateful_get_metric_extraction_config_with_extraction_disabled(
    default_project: Project,
    widget_type: int,
) -> None:
    duration = 1000
    with (
        Feature({ON_DEMAND_METRICS_WIDGETS: True}),
        mock.patch(
            "sentry.relay.config.metric_extraction._can_widget_query_use_stateful_extraction"
        ) as mock_can_use_stateful,
        mock.patch(
            "sentry.relay.config.metric_extraction._widget_query_stateful_extraction_enabled"
        ) as mock_extraction_enabled,
    ):
        mock_can_use_stateful.return_value = True
        mock_extraction_enabled.return_value = False
        create_widget(
            ["epm()"],
            f"transaction.duration:>={duration}",
            default_project,
            columns=["user.id", "release", "count()"],
            widget_type=widget_type,
        )

        config = get_metric_extraction_config(default_project)

        assert not config


@django_db_all
@override_options({"on_demand_metrics.widgets.use_stateful_extraction": True})
@pytest.mark.parametrize(
    "widget_type", [DashboardWidgetTypes.DISCOVER, DashboardWidgetTypes.TRANSACTION_LIKE]
)
def test_stateful_get_metric_extraction_config_multiple_widgets_with_extraction_partially_disabled(
    default_project: Project,
    widget_type: int,
) -> None:
    duration = 1000
    with (
        Feature({ON_DEMAND_METRICS_WIDGETS: True}),
        mock.patch(
            "sentry.relay.config.metric_extraction._can_widget_query_use_stateful_extraction"
        ) as mock_can_use_stateful,
        mock.patch(
            "sentry.relay.config.metric_extraction._widget_query_stateful_extraction_enabled"
        ) as mock_extraction_enabled,
    ):
        mock_can_use_stateful.return_value = True
        mock_extraction_enabled.side_effect = [True, False, True]
        create_widget(
            ["epm()"],
            f"transaction.duration:>={duration}",
            default_project,
            columns=["user.id", "release", "count()"],
            title="Widget1",
            widget_type=widget_type,
        )
        create_widget(
            ["epm()"],
            f"transaction.duration:>={duration + 1}",
            default_project,
            columns=["user.id", "release", "count()"],
            title="Widget2",
            widget_type=widget_type,
        )
        create_widget(
            ["epm()"],
            f"transaction.duration:>={duration + 2}",
            default_project,
            columns=["user.id", "release", "count()"],
            title="Widget3",
            widget_type=widget_type,
        )

        config = get_metric_extraction_config(default_project)

        assert config
        # Revert to 2 after {"include_environment_tag"} becomes the default
        assert len(config["metrics"]) == 4


@django_db_all
@override_options(
    {
        "on_demand.max_widget_cardinality.count": 1,
        "on_demand_metrics.check_widgets.enable": True,
        "on_demand_metrics.widgets.use_stateful_extraction": True,
    }
)
@pytest.mark.parametrize(
    "widget_type", [DashboardWidgetTypes.DISCOVER, DashboardWidgetTypes.TRANSACTION_LIKE]
)
def test_stateful_get_metric_extraction_config_enabled_with_multiple_versions(
    default_project: Project,
    widget_type: int,
) -> None:
    duration = 1000
    with Feature(
        {
            ON_DEMAND_METRICS_WIDGETS: True,
            "organizations:on-demand-metrics-query-spec-version-two": True,
        }
    ):
        widget_query, _, _ = create_widget(
            ["epm()"],
            f"transaction.duration:>={duration}",
            default_project,
            columns=["user.id", "release", "count()"],
            widget_type=widget_type,
        )

        process_widget_specs([widget_query.id])

        # Check that state was correctly updated.
        on_demand_entries = widget_query.dashboardwidgetqueryondemand_set.all()
        assert [entry.extraction_state for entry in on_demand_entries] == [
            "enabled:enrolled",
            "enabled:enrolled",
        ]

        config = get_metric_extraction_config(default_project)

        # Check that the first version being enabled outputs both specs.
        assert config

        # Check that changing the default spec changes behaviour.
        extraction_row_default = next(
            filter(lambda row: row.spec_version == 1, on_demand_entries), None
        )
        if extraction_row_default:
            extraction_row_default.extraction_state = "disabled:manual"
            extraction_row_default.save()

        config = get_metric_extraction_config(default_project)

        # In the future with separate version decisions, assert that there is only one spec in config here.
        assert not config


@django_db_all
@override_options(
    {
        "on_demand.max_widget_cardinality.count": 1,
        "on_demand_metrics.widgets.use_stateful_extraction": True,
    }
)
@pytest.mark.parametrize(
    "widget_type", [DashboardWidgetTypes.DISCOVER, DashboardWidgetTypes.TRANSACTION_LIKE]
)
def test_stateful_get_metric_extraction_config_with_low_cardinality(
    default_project: Project,
    widget_type: int,
) -> None:
    duration = 1000
    with Feature({ON_DEMAND_METRICS_WIDGETS: True}):
        create_widget(
            ["epm()"],
            f"transaction.duration:>={duration}",
            default_project,
            columns=["user.id", "release", "count()"],
            widget_type=widget_type,
        )

        config = get_metric_extraction_config(default_project)

        assert config


@django_db_all
@pytest.mark.parametrize(
    "widget_type", [DashboardWidgetTypes.DISCOVER, DashboardWidgetTypes.TRANSACTION_LIKE]
)
def test_get_metric_extraction_config_with_unicode_character(
    default_project: Project, widget_type: int
) -> None:
    with Feature({ON_DEMAND_METRICS_WIDGETS: True}):
        # This will cause the Unicode bug to be raised for the current version
        create_widget(["count()"], "user.name:Armén", default_project, widget_type=widget_type)
        create_widget(
            ["count()"],
            "user.name:Kevan",
            default_project,
            title="Dashboard Foo",
            widget_type=widget_type,
        )
        config = get_metric_extraction_config(default_project)

        assert config
        assert config["metrics"] == [
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
                    {"key": "query_hash", "value": "762b5dae"},
                    {"key": "environment", "field": "event.environment"},
                ],
            },
            {
                "category": "transaction",
                "condition": {"name": "event.tags.user.name", "op": "eq", "value": "Armén"},
                "field": None,
                "mri": "c:transactions/on_demand@none",
                "tags": [
                    {"key": "query_hash", "value": "c57cc340"},
                    {"key": "environment", "field": "event.environment"},
                ],
            },
        ]


@django_db_all
@pytest.mark.parametrize(
    "metric,query,query_hashes",
    [
        ("epm()", "transaction.duration:>=1000", ["8f8293cf", "5200e087"]),
        ("eps()", "transaction.duration:>=1000", ["9ffdd8ac", "162178e9"]),
        ("epm()", "", []),
    ],
)
@pytest.mark.parametrize(
    "widget_type", [DashboardWidgetTypes.DISCOVER, DashboardWidgetTypes.TRANSACTION_LIKE]
)
def test_get_metric_extraction_config_epm_eps(
    default_project: Project, metric: str, query: str, query_hashes: list[str], widget_type: int
) -> None:
    with Feature({ON_DEMAND_METRICS_WIDGETS: True}):
        create_widget([metric], query, default_project, widget_type=widget_type)

        config = get_metric_extraction_config(default_project)

        # epm() and eps() are supported by standard metrics when there's no query
        if query == "":
            assert config is None
            return None

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
            {
                "category": "transaction",
                "condition": {"name": "event.duration", "op": "gte", "value": 1000.0},
                "field": None,
                "mri": "c:transactions/on_demand@none",
                "tags": [
                    {"key": "query_hash", "value": query_hashes[1]},
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
        # Revert to 2 after {"include_environment_tag"} becomes the default
        ([ON_DEMAND_METRICS, ON_DEMAND_METRICS_WIDGETS], 3),  # Alerts and widgets.
        # Revert to 1 after {"include_environment_tag"} becomes the default
        ([ON_DEMAND_METRICS_WIDGETS], 2),  # Widgets.
        # Revert to 2 after {"include_environment_tag"} becomes the default
        ([ON_DEMAND_METRICS_PREFILL, ON_DEMAND_METRICS_WIDGETS], 3),  # Alerts and widget.
        ([], 0),  # Nothing.
    ],
)
@pytest.mark.parametrize(
    "widget_type", [DashboardWidgetTypes.DISCOVER, DashboardWidgetTypes.TRANSACTION_LIKE]
)
def test_get_metrics_extraction_config_features_combinations(
    enabled_features: str, number_of_metrics: int, default_project: Project, widget_type: int
) -> None:
    create_alert("count()", "transaction.duration:>=10", default_project)
    create_widget(
        ["count()"], "transaction.duration:>=20", default_project, widget_type=widget_type
    )

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


def _on_demand_spec_from_widget(
    project: Project, widget: DashboardWidgetQuery
) -> OnDemandMetricSpec:
    field = widget.aggregates[0] if widget.aggregates else ""
    return fetch_on_demand_metric_spec(
        project.organization.id,
        field=field,
        query=widget.conditions,
        groupbys=widget.columns,
        spec_type=MetricSpecType.DYNAMIC_QUERY,
    )


def _on_demand_spec_from_alert(project: Project, alert: AlertRule) -> OnDemandMetricSpec:
    assert alert.snuba_query is not None
    return fetch_on_demand_metric_spec(
        project.organization.id,
        field=alert.snuba_query.aggregate,
        query=alert.snuba_query.query,
        spec_type=MetricSpecType.SIMPLE_QUERY,
    )


def widget_to_metric_spec(query_hash: str, condition: RuleCondition | None = None) -> MetricSpec:
    _tags: Sequence[TagSpec] = [
        {"key": "query_hash", "value": query_hash},
        {"field": "event.environment", "key": "environment"},
    ]
    spec: MetricSpec = {
        "category": "transaction",
        "field": None,
        "mri": "c:transactions/on_demand@none",
        "tags": _tags,
    }

    if condition is not None:
        spec["condition"] = condition

    return spec


@django_db_all
@pytest.mark.parametrize(
    "widget_type", [DashboardWidgetTypes.DISCOVER, DashboardWidgetTypes.TRANSACTION_LIKE]
)
def test_include_environment_for_widgets(default_project: Project, widget_type: int) -> None:
    aggr = "count()"
    query = "transaction.duration:>=10"
    condition: RuleCondition = {"name": "event.duration", "op": "gte", "value": 10.0}

    with Feature([ON_DEMAND_METRICS, ON_DEMAND_METRICS_WIDGETS]):
        widget, _, _ = create_widget([aggr], query, default_project, widget_type=widget_type)
        config = get_metric_extraction_config(default_project)
        # Because we have two specs we will have two metrics.
        # The second spec includes the environment tag as part of the query hash.
        assert config and config["metrics"] == [
            widget_to_metric_spec("f1353b0f", condition),
            widget_to_metric_spec("4fb5a472", condition),
        ]

        # We now verify that the string used for hashing is what we expect
        # Since we're using the current spec it will not include the environment tag
        expected_query_str_hash = f"None;{condition}"
        spec = _on_demand_spec_from_widget(default_project, widget)
        assert spec.query_hash == "f1353b0f"
        assert spec._query_str_for_hash == expected_query_str_hash
        assert spec.spec_version.version == 1
        assert spec.spec_version.flags == set()

        with Feature("organizations:on-demand-metrics-query-spec-version-two"):
            spec = _on_demand_spec_from_widget(default_project, widget)
            assert spec._query_str_for_hash == f"{expected_query_str_hash};['environment']"
            assert spec.query_hash == "4fb5a472"
            assert spec.spec_version.version == 2
            assert spec.spec_version.flags == {"include_environment_tag"}


@django_db_all
@override_options({"on_demand_metrics.check_widgets.enable": True})
@pytest.mark.parametrize(
    "widget_type", [DashboardWidgetTypes.DISCOVER, DashboardWidgetTypes.TRANSACTION_LIKE]
)
def test_include_environment_for_widgets_with_multiple_env(
    default_project: Project, widget_type: int
) -> None:
    aggrs = [
        "count()",
        "count_unique(user)",
        "count_miserable(user,300)",
        "count_if(transaction.duration,equals,300)",
        "eps()",
        "epm()",
        "failure_count()",
    ]
    query = 'transaction:"GET /api/chartcuterie/healthcheck/live"'
    columns = [
        "transaction",
        "transaction",
        "project",
        "environment",
        "transaction.op",
        "transaction.status",
        "query.error_reason",
        "query.num_projects",
        "discover.use_snql",
        "query.period",
        "query.num_projects.grouped",
        "query.period.grouped",
        "query_size_group",
    ]

    with Feature([ON_DEMAND_METRICS, ON_DEMAND_METRICS_WIDGETS]):
        widget_query, _, _ = create_widget(
            aggrs, query, default_project, columns=columns, widget_type=widget_type
        )
        config = get_metric_extraction_config(default_project)
        assert config

        config = get_metric_extraction_config(default_project)
        process_widget_specs([widget_query.id])
        assert config
        assert [
            next(filter(lambda t: t["key"] == "query_hash", spec["tags"]))["value"]
            for spec in config["metrics"]
        ] == [
            "4b08d58c",
            "da718f56",
            "470072b4",
            "6bc4f99b",
            "e50094f0",
            "0a272be4",
        ]

        on_demand_entries = widget_query.dashboardwidgetqueryondemand_set.all()
        assert [entry.spec_hashes for entry in on_demand_entries if entry.spec_version == 1] == [
            [
                "4b08d58c",
                "da718f56",
                "470072b4",
                "6bc4f99b",
                "e50094f0",
                "0a272be4",
            ]
        ]

        assert [entry.spec_hashes for entry in on_demand_entries if entry.spec_version == 2] == [
            [
                "4b08d58c",
                "da718f56",
                "470072b4",
                "6bc4f99b",
                "e50094f0",
                "0a272be4",
            ]
        ]


# Remove this test once we drop the current spec version
@django_db_all
@pytest.mark.parametrize(
    "widget_type", [DashboardWidgetTypes.DISCOVER, DashboardWidgetTypes.TRANSACTION_LIKE]
)
def test_alert_and_widget_colliding(default_project: Project, widget_type: int) -> None:
    aggr = "count()"
    query = "transaction.duration:>=10"
    condition: RuleCondition = {"name": "event.duration", "op": "gte", "value": 10.0}

    with Feature([ON_DEMAND_METRICS, ON_DEMAND_METRICS_WIDGETS]):
        widget, _, _ = create_widget([aggr], query, default_project, widget_type=widget_type)
        config = get_metric_extraction_config(default_project)
        # Because we have two specs we will have two metrics.
        assert config and config["metrics"] == [
            widget_to_metric_spec("f1353b0f", condition),
            widget_to_metric_spec("4fb5a472", condition),
        ]

        # Once we deprecate the current spec version, the widget will not create
        # the f1353b0f, thus, there will be no more duplicated specs
        alert = create_alert(aggr, query, default_project)
        config = get_metric_extraction_config(default_project)
        # Now that we iterate over the widgets first, we will pick the spec generated by the widget
        # which includes the environment as a tag
        assert config and config["metrics"] == [
            widget_to_metric_spec("f1353b0f", condition),
            widget_to_metric_spec("4fb5a472", condition),
        ]

        widget_spec = _on_demand_spec_from_widget(default_project, widget)
        alert_spec = _on_demand_spec_from_alert(default_project, alert)
        expected_query_str_hash = f"None;{condition}"
        assert widget_spec._query_str_for_hash == expected_query_str_hash
        assert alert_spec._query_str_for_hash == expected_query_str_hash

        with Feature("organizations:on-demand-metrics-query-spec-version-two"):
            widget_spec = _on_demand_spec_from_widget(default_project, widget)
            assert widget_spec._query_str_for_hash == f"{expected_query_str_hash};['environment']"
            assert widget_spec.query_hash == "4fb5a472"
            assert widget_spec.spec_version.version == 2
            assert widget_spec.spec_version.flags == {"include_environment_tag"}

            # With the new spec version they will not collide anymore
            assert widget_spec.query_hash != alert_spec.query_hash


foo_bar_condition = {"name": "event.tags.foo", "op": "eq", "value": "bar"}
not_event_type_cond = {
    "inner": {"op": "eq", "name": "event.tags.event.type", "value": "error"},
    "op": "not",
}


@django_db_all
@pytest.mark.parametrize(
    "query, config_assertion, expected_hashes, expected_condition",
    [
        ("event.type:default", False, [], None),
        ("!event.type:transaction", False, [], None),
        ('event.type:"error"', False, [], None),
        ("event.type:error", False, [], None),
        ("!event.type:error", True, ["578e7911", "91f78a80"], not_event_type_cond),
        ("event.type:transaction", True, ["5367d030", "f7a47137"], None),
        # These two have the same hashes because event.type:transaction is completely ignored
        ("event.type:transaction foo:bar", True, ["bdb73880", "54cee1ce"], foo_bar_condition),
        ("foo:bar", True, ["bdb73880", "54cee1ce"], foo_bar_condition),
    ],
)
@pytest.mark.parametrize(
    "widget_type", [DashboardWidgetTypes.DISCOVER, DashboardWidgetTypes.TRANSACTION_LIKE]
)
def test_event_type(
    default_project: Project,
    query: str,
    config_assertion: bool,
    expected_hashes: list[str],
    expected_condition: RuleCondition | None,
    widget_type: int,
) -> None:
    aggr = "count()"

    with Feature([ON_DEMAND_METRICS, ON_DEMAND_METRICS_WIDGETS]):
        widget, _, _ = create_widget([aggr], query, default_project, widget_type=widget_type)
        config = get_metric_extraction_config(default_project)
        if not config_assertion:
            assert config is None
        else:
            assert config and config["metrics"] == [
                widget_to_metric_spec(expected_hashes[0], expected_condition),
                widget_to_metric_spec(expected_hashes[1], expected_condition),
            ]
            widget_spec = _on_demand_spec_from_widget(default_project, widget)
            assert widget_spec._query_str_for_hash == f"None;{_deep_sorted(expected_condition)}"


@django_db_all
@pytest.mark.parametrize(
    "widget_type", [DashboardWidgetTypes.DISCOVER, DashboardWidgetTypes.TRANSACTION_LIKE]
)
def test_level_field(default_project: Project, widget_type: int) -> None:
    aggr = "count()"
    query = "level:irrelevant_value"

    with Feature(ON_DEMAND_METRICS_WIDGETS):
        create_widget([aggr], query, default_project, widget_type=widget_type)
        config = get_metric_extraction_config(default_project)
        assert config is None


@django_db_all
@pytest.mark.parametrize(
    "widget_type", [DashboardWidgetTypes.DISCOVER, DashboardWidgetTypes.TRANSACTION_LIKE]
)
def test_widget_modifed_after_on_demand(default_project: Project, widget_type: int) -> None:
    duration = 1000
    with Feature(
        {
            ON_DEMAND_METRICS_WIDGETS: True,
            "organizations:on-demand-metrics-query-spec-version-two": True,
        }
    ):
        widget_query, _, _ = create_widget(
            ["epm()"],
            f"transaction.duration:>={duration}",
            default_project,
            columns=["user.id", "release", "count()"],
            widget_type=widget_type,
        )

        with mock.patch("sentry_sdk.capture_exception") as capture_exception:

            process_widget_specs([widget_query.id])
            config = get_metric_extraction_config(default_project)

            assert config and config["metrics"]

            assert capture_exception.call_count == 0


@pytest.mark.parametrize(
    ["current_version", "expected"],
    [
        pytest.param(SpecVersion(2), {"1234", "5678"}, id="test_returns_current_version"),
        pytest.param(SpecVersion(1), {"abcd", "defg"}, id="test_returns_specified_version"),
    ],
)
@django_db_all
@pytest.mark.parametrize(
    "widget_type", [DashboardWidgetTypes.DISCOVER, DashboardWidgetTypes.TRANSACTION_LIKE]
)
def test_get_current_widget_specs(
    default_project: Project, current_version: SpecVersion, expected: set[str], widget_type: int
) -> None:
    for i, (version, hashes, state) in enumerate(
        (
            (1, ["abcd", "defg"], "enabled:manual"),
            (2, ["1234", "5678"], "enabled:manual"),
            (2, ["ab12", "cd78"], "disabled:high-cardinality"),
            (2, ["1234"], "enabled:manual"),
        )
    ):
        widget_query, _, _ = create_widget(
            ["epm()"],
            f"transaction.duration:>={i}",
            default_project,
            title=f"Dashboard {i}",
            columns=["user.id", "release", "count()"],
            widget_type=widget_type,
        )
        DashboardWidgetQueryOnDemand.objects.create(
            dashboard_widget_query=widget_query,
            spec_version=version,
            spec_hashes=hashes,
            extraction_state=state,
        )
    with mock.patch(
        "sentry.snuba.metrics.extraction.OnDemandMetricSpecVersioning.get_query_spec_version",
        return_value=current_version,
    ):
        specs = get_current_widget_specs(default_project.organization)
    assert specs == expected
