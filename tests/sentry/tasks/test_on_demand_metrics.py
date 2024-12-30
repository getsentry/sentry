from collections.abc import Sequence
from typing import Any
from unittest import mock

import pytest

from sentry.models.dashboard_widget import DashboardWidgetQueryOnDemand, DashboardWidgetTypes
from sentry.models.organization import Organization
from sentry.models.project import Project
from sentry.tasks import on_demand_metrics
from sentry.tasks.on_demand_metrics import (
    get_field_cardinality_cache_key,
    process_widget_specs,
    schedule_on_demand_check,
)
from sentry.testutils.factories import Factories
from sentry.testutils.helpers import Feature, override_options
from sentry.testutils.helpers.on_demand import create_widget
from sentry.testutils.pytest.fixtures import django_db_all
from sentry.users.models.user import User
from sentry.utils.cache import cache

_WIDGET_EXTRACTION_FEATURES = {"organizations:on-demand-metrics-extraction-widgets": True}

_SNQL_DATA_LOW_CARDINALITY = {"data": [{"count_unique(custom-tag)": 10000}]}
_SNQL_DATA_HIGH_CARDINALITY = {"data": [{"count_unique(custom-tag)": 10001}]}

OnDemandExtractionState = DashboardWidgetQueryOnDemand.OnDemandExtractionState


@pytest.fixture
def owner() -> User:
    return Factories.create_user()


@pytest.fixture
def organization(owner: User) -> None:
    return Factories.create_organization(owner=owner)


@pytest.fixture
def project(organization: Organization) -> Project:
    return Factories.create_project(organization=organization)


@pytest.mark.parametrize(
    [
        "feature_flags",
        "option_enable",
        "option_rollout",
        "option_batch_size",
        "option_total_batches",
        "option_max_widget_cardinality",
        "columns",
        "previous_batch",
        "expected_number_of_child_tasks_run",
        "expected_discover_queries_run",
        "cached_columns",
    ],
    [
        # Testing options and task batching
        pytest.param(
            {},
            False,
            0.0,
            1,
            1,
            100,
            [
                ["foo"],
                ["bar"],
                ["baz"],
                ["ast"],
                ["bars"],
            ],
            0,
            0,
            0,
            [],
            id="nothing_enabled",
        ),
        pytest.param(
            {},
            True,
            0.0,
            1,
            1,
            100,
            [
                ["foo"],
                ["bar"],
                ["baz"],
                ["ast"],
                ["bars"],
            ],
            0,
            0,
            0,
            [],
            id="option_enabled_no_rollout",
        ),
        pytest.param(
            {},
            True,
            1.0,
            1,
            1,
            100,
            [
                ["foo"],
                ["bar"],
                ["baz"],
                ["ast"],
                ["bars"],
            ],
            0,
            5,
            0,
            [],
            id="option_enabled_rollout_max",
        ),
        pytest.param(
            {},
            True,
            0.0,
            1,
            1,
            100,
            [[], [], [], [], []],
            0,
            0,
            0,
            [],
            id="option_enabled_rollout_max_no_columns",
        ),
        pytest.param(
            {},
            True,
            0.001,
            1,
            1,
            100,
            [
                ["foo"],
                ["bar"],
                ["baz"],
                ["ast"],
                ["bars"],
            ],
            0,
            1,
            0,
            [],
            id="option_enabled_rollout_only_one",
        ),
        pytest.param(
            {},
            True,
            0.002,
            1,
            1,
            100,
            [
                ["foo"],
                ["bar"],
                ["baz"],
                ["ast"],
                ["bars"],
            ],
            0,
            2,
            0,
            [],
            id="option_enabled_rollout_two",
        ),
        pytest.param(
            {},
            True,
            1.0,
            2,
            1,
            100,
            [
                ["foo"],
                ["bar"],
                ["baz"],
                ["ast"],
                ["bars"],
            ],
            0,
            3,
            0,
            [],
            id="fully_enabled_batch_size_remainder",
        ),  # Should be 3 calls since 5 / 2 has remainder
        pytest.param(
            {},
            True,
            1.0,
            1,
            2,
            100,
            [
                ["foo"],
                ["bar"],
                ["baz"],
                ["ast"],
                ["bars"],
            ],
            1,
            2,
            0,
            [],
            id="test_offset_batch_0",
        ),  # first batch of two (previous batch 1 rolls over), with batch size 1. Widgets [2,4]
        pytest.param(
            {},
            True,
            1.0,
            1,
            2,
            100,
            [
                ["foo"],
                ["bar"],
                ["baz"],
                ["ast"],
                ["bars"],
            ],
            0,
            3,
            0,
            [],
            id="test_offset_batch_1",
        ),  # second batch of two, with batch size 1.  Widgets [1,3,5]
        pytest.param(
            {},
            True,
            1.0,
            5,
            1,
            100,
            [
                ["foo"],
                ["bar"],
                ["baz"],
                ["ast"],
                ["bars"],
            ],
            0,
            1,
            0,
            [],
            id="fully_enabled_batch_size_all",
        ),
        pytest.param(
            {},
            True,
            1.0,
            10,
            1,
            100,
            [
                ["foo"],
                ["bar"],
                ["baz"],
                ["ast"],
                ["bars"],
            ],
            0,
            1,
            0,
            [],
            id="fully_enabled_batch_size_larger_batch",
        ),
        # Testing cardinality checks
        pytest.param(
            _WIDGET_EXTRACTION_FEATURES,
            True,
            1.0,
            10,
            1,
            100,
            [
                ["foo"],
                ["bar"],
                ["baz"],
                ["ast"],
                ["bars"],
            ],
            0,
            1,
            5,
            [],
            id="fully_enabled_with_features",
        ),  # 1 task, 5 queries.
        pytest.param(
            _WIDGET_EXTRACTION_FEATURES,
            True,
            1.0,
            10,
            1,
            49,
            [
                ["foo"],
                ["bar"],
                ["baz"],
                ["ast"],
                ["bars"],
            ],
            0,
            1,
            5,
            [],
            id="fully_enabled_with_features_high_cardinality",
        ),  # Below cardinality limit.
        pytest.param(
            _WIDGET_EXTRACTION_FEATURES,
            True,
            1.0,
            2,
            4,
            100,
            [
                ["foo"],
                ["bar"],
                ["baz"],
                ["ast"],
                ["bars"],
            ],
            0,
            1,
            2,
            [],
            id="test_offset_batch_larger_size_with_features",
        ),  # Checking 2nd batch of 4. Widgets[1, 4], 1 child task, 2 queries made (batch size 2)
        pytest.param(
            _WIDGET_EXTRACTION_FEATURES,
            True,
            1.0,
            10,
            1,
            1000,
            [
                ["foo"],
                ["bar"],
                ["baz"],
                ["ast"],
                ["bars"],
            ],
            0,
            1,
            5,
            [
                "foo",
                "bar",
                "baz",
                "ast",
                "bars",
            ],
            id="test_snuba_cardinality_call_is_cached",
        ),  # Below cardinality limit.
    ],
)
@django_db_all
def test_schedule_on_demand_check(
    feature_flags: dict[str, bool],
    option_enable: bool,
    option_rollout: bool,
    option_batch_size: float,
    option_total_batches: int,
    option_max_widget_cardinality: int,
    previous_batch: int,
    columns: list[list[str]],
    expected_number_of_child_tasks_run: int,
    expected_discover_queries_run: int,
    cached_columns: list[str],
    project: Project,
) -> None:
    cache.clear()
    options = {
        "on_demand_metrics.check_widgets.enable": option_enable,
        "on_demand_metrics.check_widgets.rollout": option_rollout,
        "on_demand_metrics.check_widgets.query.batch_size": option_batch_size,
        "on_demand_metrics.check_widgets.query.total_batches": option_total_batches,
        "on_demand.max_widget_cardinality.count": option_max_widget_cardinality,
    }

    on_demand_metrics._set_currently_processing_batch(previous_batch)

    # Reuse the same dashboard to speed up fixture calls and avoid managing dashboard unique title constraint.
    _, __, dashboard = create_widget(
        ["count()"], "transaction.duration:>=1", project, columns=columns[0], id=1
    )
    for i in range(2, 6):
        create_widget(
            ["count()"],
            f"transaction.duration:>={i}",
            project,
            columns=columns[i - 1],
            id=i,
            dashboard=dashboard,
        )

    with (
        mock.patch(
            "sentry.tasks.on_demand_metrics._query_cardinality",
            return_value=(
                {"data": [{f"count_unique({col[0]})": 50 for col in columns if col}]},
                [col[0] for col in columns if col],
            ),
        ) as _query_cardinality,
        mock.patch.object(
            process_widget_specs, "delay", wraps=process_widget_specs
        ) as process_widget_specs_spy,
        override_options(options),
        Feature(feature_flags),
    ):
        assert not process_widget_specs_spy.called
        schedule_on_demand_check()
        assert process_widget_specs_spy.call_count == expected_number_of_child_tasks_run

        assert _query_cardinality.call_count == expected_discover_queries_run
        for column in cached_columns:
            assert cache.get(
                get_field_cardinality_cache_key(column, project.organization, "task-cache")
            )


@pytest.mark.parametrize(
    [
        "feature_flags",
        "option_enable",
        "widget_query_ids",
        "set_high_cardinality",
        "expected_discover_queries_run",
        "expected_low_cardinality",
    ],
    [
        pytest.param({}, False, [], False, 0, False, id="nothing_enabled"),
        pytest.param(_WIDGET_EXTRACTION_FEATURES, True, [1], False, 1, True, id="enabled_low_card"),
        pytest.param({}, True, [1], False, 0, True, id="enabled_low_card_no_features"),
        pytest.param(
            _WIDGET_EXTRACTION_FEATURES, True, [1], True, 1, False, id="enabled_high_card"
        ),
        pytest.param(
            _WIDGET_EXTRACTION_FEATURES,
            True,
            [1, 2, 3],
            False,
            1,
            True,
            id="enabled_low_card_all_widgets",
        ),  # Only 2 widgets are on-demand
    ],
)
@mock.patch("sentry.search.events.builder.base.raw_snql_query")
@pytest.mark.parametrize(
    "widget_type", [DashboardWidgetTypes.DISCOVER, DashboardWidgetTypes.TRANSACTION_LIKE]
)
@django_db_all
def test_process_widget_specs(
    raw_snql_query: Any,
    feature_flags: dict[str, bool],
    option_enable: bool,
    widget_query_ids: Sequence[int],
    set_high_cardinality: bool,
    expected_discover_queries_run: int,
    expected_low_cardinality: bool,
    project: Project,
    widget_type: int,
) -> None:
    cache.clear()
    raw_snql_query.return_value = (
        _SNQL_DATA_HIGH_CARDINALITY if set_high_cardinality else _SNQL_DATA_LOW_CARDINALITY
    )
    options = {
        "on_demand_metrics.check_widgets.enable": option_enable,
    }

    query_columns = ["custom-tag"]

    # Reuse the same dashboard to speed up fixture calls and avoid managing dashboard unique title constraint.
    _, __, dashboard = create_widget(
        ["count()"], "transaction.duration:>=1", project, columns=query_columns, id=1
    )
    create_widget(
        ["count()"],
        "transaction.duration:>=2",
        project,
        columns=query_columns,
        id=2,
        dashboard=dashboard,
        widget_type=widget_type,
    )
    create_widget(
        ["count()"],
        "",  # Not a on-demand widget
        project,
        columns=[],
        id=3,
        dashboard=dashboard,
        widget_type=widget_type,
    )

    with override_options(options), Feature(feature_flags):
        process_widget_specs(widget_query_ids)

    assert raw_snql_query.call_count == expected_discover_queries_run

    expected_state = ""
    if not feature_flags:
        expected_state = OnDemandExtractionState.DISABLED_PREROLLOUT
    else:
        expected_state = (
            OnDemandExtractionState.ENABLED_ENROLLED
            if expected_low_cardinality
            else OnDemandExtractionState.DISABLED_HIGH_CARDINALITY
        )

    if 1 in widget_query_ids:
        widget_models = DashboardWidgetQueryOnDemand.objects.filter(dashboard_widget_query_id=1)
        for widget_model in widget_models:
            assert_on_demand_model(
                widget_model,
                has_features=bool(feature_flags),
                expected_state=expected_state,
                expected_hashes={1: ["43adeb86"], 2: ["851922a4"]},
            )

    if 2 in widget_query_ids:
        widget_models = DashboardWidgetQueryOnDemand.objects.filter(dashboard_widget_query_id=2)
        for widget_model in widget_models:
            assert_on_demand_model(
                widget_model,
                has_features=bool(feature_flags),
                expected_state=expected_state,
                expected_hashes={1: ["8f74e5da"], 2: ["581c3968"]},
            )

    if 3 in widget_query_ids:
        widget_models = DashboardWidgetQueryOnDemand.objects.filter(dashboard_widget_query_id=3)
        for widget_model in widget_models:
            assert_on_demand_model(
                widget_model,
                has_features=bool(feature_flags),
                expected_state=OnDemandExtractionState.DISABLED_NOT_APPLICABLE,
                expected_hashes=None,
            )


def assert_on_demand_model(
    model: DashboardWidgetQueryOnDemand,
    has_features: bool,
    expected_state: str,
    expected_hashes: dict[int, list[str]] | None,
) -> None:
    assert model.spec_version
    assert model.extraction_state == expected_state

    if expected_state == OnDemandExtractionState.DISABLED_NOT_APPLICABLE:
        # This forces the caller to explicitly set the expectations
        assert expected_hashes is None
        assert model.spec_hashes == []
        return

    assert expected_hashes is not None
    if not has_features:
        assert model.spec_hashes == expected_hashes[model.spec_version]  # Still include hashes
        return

    assert model.spec_hashes == expected_hashes[model.spec_version]  # Still include hashes
