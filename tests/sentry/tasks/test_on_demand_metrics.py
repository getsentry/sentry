from typing import Optional, Sequence, Tuple
from unittest import mock

import pytest

from sentry.models.dashboard import Dashboard
from sentry.models.dashboard_widget import (
    DashboardWidget,
    DashboardWidgetDisplayTypes,
    DashboardWidgetQuery,
    DashboardWidgetQueryOnDemand,
    DashboardWidgetTypes,
)
from sentry.models.project import Project
from sentry.tasks import on_demand_metrics
from sentry.tasks.on_demand_metrics import process_widget_specs, schedule_on_demand_check
from sentry.testutils.factories import Factories
from sentry.testutils.helpers import Feature, override_options
from sentry.testutils.pytest.fixtures import django_db_all
from sentry.utils.cache import cache

_WIDGET_EXTRACTION_FEATURES = {"organizations:on-demand-metrics-extraction-widgets": True}

_CARDINALITY_DISCOVER_DATA = ({"data": [{"count_unique(custom-tag)": 50}]}, ["custom-tag"])
_SNQL_DATA_LOW_CARDINALITY = {"data": [{"count_unique(custom-tag)": 10000}]}
_SNQL_DATA_HIGH_CARDINALITY = {"data": [{"count_unique(custom-tag)": 10001}]}

OnDemandExtractionState = DashboardWidgetQueryOnDemand.OnDemandExtractionState


@pytest.fixture
def owner() -> None:
    return Factories.create_user()


@pytest.fixture
def organization(owner) -> None:
    return Factories.create_organization(owner=owner)


@pytest.fixture
def project(organization) -> None:
    return Factories.create_project(organization=organization)


# TODO: Move this into a method to be shared with test_metric_extraction
def create_widget(
    aggregates: Sequence[str],
    query: str,
    project: Project,
    title="Dashboard",
    id: Optional[int] = None,
    columns: Optional[Sequence[str]] = None,
    dashboard: Optional[Dashboard] = None,
    widget: Optional[DashboardWidget] = None,
) -> Tuple[DashboardWidgetQuery, DashboardWidget, Dashboard]:
    columns = columns or []
    dashboard = dashboard or Dashboard.objects.create(
        organization=project.organization,
        created_by_id=1,
        title=title,
    )
    id = id or 1
    widget = widget or DashboardWidget.objects.create(
        dashboard=dashboard,
        order=id - 1,
        widget_type=DashboardWidgetTypes.DISCOVER,
        display_type=DashboardWidgetDisplayTypes.LINE_CHART,
    )

    widget_query = DashboardWidgetQuery.objects.create(
        id=id, aggregates=aggregates, conditions=query, columns=columns, order=id - 1, widget=widget
    )

    return widget_query, widget, dashboard


@pytest.mark.parametrize(
    [
        "feature_flags",
        "option_enable",
        "option_rollout",
        "option_batch_size",
        "option_total_batches",
        "option_max_widget_cardinality",
        "has_columns",
        "previous_batch",
        "expected_number_of_child_tasks_run",
        "expected_discover_queries_run",
        "expected_cache_set",
    ],
    [
        # Testing options and task batching
        pytest.param({}, False, 0.0, 1, 1, 100, True, 0, 0, 0, None, id="nothing_enabled"),
        pytest.param({}, True, 0.0, 1, 1, 100, True, 0, 0, 0, None, id="option_enabled_no_rollout"),
        pytest.param(
            {}, True, 1.0, 1, 1, 100, True, 0, 5, 0, None, id="option_enabled_rollout_max"
        ),
        pytest.param(
            {},
            True,
            0.0,
            1,
            1,
            100,
            False,
            0,
            0,
            0,
            None,
            id="option_enabled_rollout_max_no_columns",
        ),
        pytest.param(
            {}, True, 0.001, 1, 1, 100, True, 0, 1, 0, None, id="option_enabled_rollout_only_one"
        ),
        pytest.param(
            {}, True, 0.002, 1, 1, 100, True, 0, 2, 0, None, id="option_enabled_rollout_two"
        ),
        pytest.param(
            {}, True, 1.0, 2, 1, 100, True, 0, 3, 0, None, id="fully_enabled_batch_size_remainder"
        ),  # Should be 3 calls since 5 / 2 has remainder
        pytest.param(
            {}, True, 1.0, 1, 2, 100, True, 1, 2, 0, None, id="test_offset_batch_0"
        ),  # first batch of two (previous batch 1 rolls over), with batch size 1. Widgets [2,4]
        pytest.param(
            {}, True, 1.0, 1, 2, 100, True, 0, 3, 0, None, id="test_offset_batch_1"
        ),  # second batch of two, with batch size 1.  Widgets [1,3,5]
        pytest.param(
            {}, True, 1.0, 5, 1, 100, True, 0, 1, 0, None, id="fully_enabled_batch_size_all"
        ),
        pytest.param(
            {},
            True,
            1.0,
            10,
            1,
            100,
            True,
            0,
            1,
            0,
            None,
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
            True,
            0,
            1,
            5,
            True,
            id="fully_enabled_with_features",
        ),  # 1 task, 5 queries.
        pytest.param(
            _WIDGET_EXTRACTION_FEATURES,
            True,
            1.0,
            10,
            1,
            49,
            True,
            0,
            1,
            5,
            False,
            id="fully_enabled_with_features_high_cardinality",
        ),  # Below cardinality limit.
        pytest.param(
            _WIDGET_EXTRACTION_FEATURES,
            True,
            1.0,
            2,
            4,
            100,
            True,
            0,
            1,
            2,
            True,
            id="test_offset_batch_larger_size_with_features",
        ),  # Checking 2nd batch of 4. Widgets[1, 4], 1 child task, 2 queries made (batch size 2)
    ],
)
@mock.patch(
    "sentry.tasks.on_demand_metrics._query_cardinality", return_value=_CARDINALITY_DISCOVER_DATA
)
@django_db_all
def test_schedule_on_demand_check(
    _query_cardinality,
    feature_flags,
    option_enable,
    option_rollout,
    option_batch_size,
    option_total_batches,
    option_max_widget_cardinality,
    previous_batch,
    has_columns,
    expected_number_of_child_tasks_run,
    expected_discover_queries_run,
    expected_cache_set,
    project,
) -> None:
    cache.clear()
    options = {
        "on_demand_metrics.check_widgets.enable": option_enable,
        "on_demand_metrics.check_widgets.rollout": option_rollout,
        "on_demand_metrics.check_widgets.query.batch_size": option_batch_size,
        "on_demand_metrics.check_widgets.query.total_batches": option_total_batches,
        "on_demand.max_widget_cardinality.count": option_max_widget_cardinality,
    }
    query_columns = ["custom-tag"] if has_columns else []

    on_demand_metrics._set_currently_processing_batch(previous_batch)

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
    )
    create_widget(
        ["count()"],
        "transaction.duration:>=3",
        project,
        columns=query_columns,
        id=3,
        dashboard=dashboard,
    )
    create_widget(
        ["count()"],
        "transaction.duration:>=4",
        project,
        columns=query_columns,
        id=4,
        dashboard=dashboard,
    )
    create_widget(
        ["count()"],
        "transaction.duration:>=5",
        project,
        columns=query_columns,
        id=5,
        dashboard=dashboard,
    )

    with mock.patch.object(
        on_demand_metrics, "_set_cardinality_cache", wraps=on_demand_metrics._set_cardinality_cache
    ) as _cardinality_cache, mock.patch.object(
        process_widget_specs, "delay", wraps=process_widget_specs
    ) as process_widget_specs_spy, override_options(
        options
    ), Feature(
        feature_flags
    ):
        assert not process_widget_specs_spy.called
        schedule_on_demand_check()
        assert process_widget_specs_spy.call_count == expected_number_of_child_tasks_run

        assert _query_cardinality.call_count == expected_discover_queries_run
        assert _cardinality_cache.call_count == expected_discover_queries_run
        if _cardinality_cache.call_count:
            # Can't assert order, tasks aren't guaranteed to fire in order.
            assert all(
                mock_call.args[1] == expected_cache_set
                for mock_call in _cardinality_cache.mock_calls
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
        pytest.param({}, False, [], False, 0, None, id="nothing_enabled"),
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
            2,
            True,
            id="enabled_low_card_all_widgets",
        ),  # Only 2 widgets are on-demand
    ],
)
@mock.patch("sentry.tasks.on_demand_metrics._set_cardinality_cache")
@mock.patch("sentry.search.events.builder.discover.raw_snql_query")
@django_db_all
def test_process_widget_specs(
    raw_snql_query,
    _set_cardinality_cache,
    feature_flags,
    widget_query_ids,
    set_high_cardinality,
    option_enable,
    expected_discover_queries_run,
    expected_low_cardinality,
    project,
) -> None:
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
    )
    create_widget(
        ["count()"],
        "",  # Not a on-demand widget
        project,
        columns=[],
        id=3,
        dashboard=dashboard,
    )

    with override_options(options), Feature(feature_flags):
        process_widget_specs(widget_query_ids)

    assert raw_snql_query.call_count == expected_discover_queries_run

    assert _set_cardinality_cache.call_count == expected_discover_queries_run
    if _set_cardinality_cache.call_count:
        # Can't assert order, tasks aren't guaranteed to fire in order.
        assert all(
            mock_call.args[1] == expected_low_cardinality
            for mock_call in _set_cardinality_cache.mock_calls
        )

    if 1 in widget_query_ids:
        widget_model = DashboardWidgetQueryOnDemand.objects.get(dashboard_widget_query_id=1)
        assert_on_demand_model(
            widget_model,
            is_low_cardinality=expected_low_cardinality,
            has_features=bool(feature_flags),
            expected_applicable=True,
            expected_hashes=["43adeb86"],
        )

    if 2 in widget_query_ids:
        widget_model = DashboardWidgetQueryOnDemand.objects.get(dashboard_widget_query_id=2)
        assert_on_demand_model(
            widget_model,
            is_low_cardinality=expected_low_cardinality,
            has_features=bool(feature_flags),
            expected_applicable=True,
            expected_hashes=["8f74e5da"],
        )

    if 3 in widget_query_ids:
        widget_model = DashboardWidgetQueryOnDemand.objects.get(dashboard_widget_query_id=3)
        assert_on_demand_model(
            widget_model,
            is_low_cardinality=expected_low_cardinality,
            has_features=bool(feature_flags),
            expected_applicable=False,
            expected_hashes=[],
        )


def assert_on_demand_model(
    model: DashboardWidgetQueryOnDemand,
    is_low_cardinality: bool,
    has_features: bool,
    expected_applicable: bool,
    expected_hashes: Sequence[str],
) -> None:
    if not expected_applicable:
        assert model.extraction_state == OnDemandExtractionState.DISABLED_NOT_APPLICABLE
        assert model.spec_hashes == []
        return

    if not has_features:
        assert model.extraction_state == OnDemandExtractionState.DISABLED_PREROLLOUT
        assert model.spec_hashes == expected_hashes  # Still include hashes
        return

    expected_state = (
        OnDemandExtractionState.ENABLED_ENROLLED
        if is_low_cardinality
        else OnDemandExtractionState.DISABLED_HIGH_CARDINALITY
    )
    assert model.extraction_state == expected_state
    assert model.spec_hashes == expected_hashes
