from datetime import datetime
from typing import TYPE_CHECKING, Any

import pytest
from freezegun import freeze_time

from sentry.processing import realtime_metrics
from sentry.processing.realtime_metrics.base import RealtimeMetricsStore
from sentry.tasks import low_priority_symbolication
from sentry.tasks.low_priority_symbolication import (  # _scan_for_suspect_projects,
    _update_lpq_eligibility,
)
from sentry.testutils import TestCase

# from sentry.testutils.helpers.task_runner import TaskRunner
from sentry.utils.compat import mock
from sentry.utils.services import LazyServiceWrapper

if TYPE_CHECKING:
    from typing import Callable

    def _fixture(func: Callable[..., Any]) -> Callable[..., None]:
        ...

    pytest.fixture = _fixture


# class TestScanForSuspectProjects:
#     @pytest.fixture
#     def store(self):
#         store = LazyServiceWrapper(
#             RealtimeMetricsStore,
#             "sentry.processing.realtime_metrics.redis.RedisRealtimeMetricsStore",
#             {
#                 "cluster": "default",
#                 "counter_bucket_size": 10,
#                 "counter_time_window": 120,
#                 "duration_bucket_size": 10,
#                 "duration_time_window": 120,
#                 "backoff_timer": 0,
#             },
#         )

#         old_properties = realtime_metrics.__dict__.copy()
#         store.expose(realtime_metrics.__dict__)
#         yield store

#         # cleanup
#         realtime_metrics.__dict__.update(old_properties)

#     def test_no_metrics_not_in_lpq(self, store) -> None:
#         assert store.get_lpq_projects() == set()

#         with TaskRunner():
#             _scan_for_suspect_projects()

#         assert store.get_lpq_projects() == set()

#     def test_no_metrics_in_lpq(self, store) -> None:
#         store.add_project_to_lpq(17)
#         assert store.get_lpq_projects() == {17}

#         with TaskRunner():
#             _scan_for_suspect_projects()

#         assert store.get_lpq_projects() == set()

#     @freeze_time(datetime.fromtimestamp(0))
#     # TODO: Remove patch and update test once calculation_magic is implemented
#     @mock.patch("sentry.tasks.low_priority_symbolication.calculation_magic", lambda x, y: True)
#     def test_has_metric_not_in_lpq(self, store) -> None:
#         store.increment_project_event_counter(17, 0)
#         assert store.get_lpq_projects() == set()

#         with TaskRunner():
#             _scan_for_suspect_projects()

#         assert store.get_lpq_projects() == {17}

#     @freeze_time(datetime.fromtimestamp(0))
#     # TODO: Remove patch and update test once calculation_magic is implemented
#     @mock.patch("sentry.tasks.low_priority_symbolication.calculation_magic", lambda x, y: True)
#     def test_has_metric_in_lpq(self, store) -> None:
#         store.increment_project_event_counter(17, 0)
#         store.add_project_to_lpq(17)
#         assert store.get_lpq_projects() == {17}

#         with TaskRunner():
#             _scan_for_suspect_projects()

#         assert store.get_lpq_projects() == {17}

#     @freeze_time(datetime.fromtimestamp(0))
#     # TODO: Remove patch and update test once calculation_magic is implemented
#     @mock.patch("sentry.tasks.low_priority_symbolication.calculation_magic", lambda x, y: True)
#     def test_add_one_project_remove_one_project(self, store) -> None:
#         store.increment_project_event_counter(17, 0)
#         store.remove_projects_from_lpq([17])
#         store.add_project_to_lpq(1)
#         assert store.get_lpq_projects() == {1}

#         with TaskRunner():
#             _scan_for_suspect_projects()

#         assert store.get_lpq_projects() == {17}

#     def test_add_recently_moved_project(self, store) -> None:
#         store._backoff_timer = 10
#         store.increment_project_event_counter(17, 0)
#         # Abusing the fact that removing always updates the backoff timer even if it's a noop
#         store.remove_projects_from_lpq([17])
#         assert store.get_lpq_projects() == set()

#         with TaskRunner():
#             _scan_for_suspect_projects()

#         assert store.get_lpq_projects() == set()

#     def test_remove_recently_moved_project(self, store) -> None:
#         store._backoff_timer = 10
#         store.add_project_to_lpq(17)
#         assert store.get_lpq_projects() == {17}

#         with TaskRunner():
#             _scan_for_suspect_projects()

#         assert store.get_lpq_projects() == {17}


class TestUpdateLpqEligibility:
    @pytest.fixture
    def store(self):
        store = LazyServiceWrapper(
            RealtimeMetricsStore,
            "sentry.processing.realtime_metrics.redis.RedisRealtimeMetricsStore",
            {
                "cluster": "default",
                "counter_bucket_size": 10,
                "counter_time_window": 120,
                "duration_bucket_size": 10,
                "duration_time_window": 120,
                "backoff_timer": 0,
            },
        )

        old_properties = realtime_metrics.__dict__.copy()
        store.expose(realtime_metrics.__dict__)
        yield store

        # cleanup
        realtime_metrics.__dict__.update(old_properties)

    def test_no_counts_no_durations_in_lpq(self, store) -> None:
        store.add_project_to_lpq(17)
        assert store.get_lpq_projects() == {17}

        _update_lpq_eligibility(project_id=17, cutoff=10)
        assert store.get_lpq_projects() == set()

    def test_no_counts_no_durations_not_lpq(self, store) -> None:
        _update_lpq_eligibility(project_id=17, cutoff=10)
        assert store.get_lpq_projects() == set()

    @freeze_time(datetime.fromtimestamp(0))
    def test_some_counts_no_durations(self, store, monkeypatch) -> None:
        store.increment_project_event_counter(project_id=17, timestamp=0)
        assert store.get_lpq_projects() == set()

        monkeypatch.setattr(low_priority_symbolication, "excessive_event_rate", lambda p, t: True)

        _update_lpq_eligibility(project_id=17, cutoff=10)
        assert store.get_lpq_projects() == {17}

    @freeze_time(datetime.fromtimestamp(0))
    # TODO: Remove patch and update test once calculation_magic is implemented
    @mock.patch("sentry.tasks.low_priority_symbolication.calculation_magic", lambda x, y: True)
    def test_no_counts_some_durations(self, store) -> None:
        store.increment_project_duration_counter(17, 0, 10)
        assert store.get_lpq_projects() == set()

        _update_lpq_eligibility(project_id=17, cutoff=10)
        assert store.get_lpq_projects() == {17}

    @freeze_time(datetime.fromtimestamp(0))
    # TODO: Remove patch and update test once calculation_magic is implemented
    @mock.patch("sentry.tasks.low_priority_symbolication.calculation_magic", lambda x, y: True)
    def test_is_eligible_in_lpq(self, store) -> None:
        store.add_project_to_lpq(17)

        _update_lpq_eligibility(project_id=17, cutoff=10)
        assert store.get_lpq_projects() == {17}

    # TODO: Remove patch and update test once calculation_magic is implemented
    @freeze_time(datetime.fromtimestamp(0))
    @mock.patch("sentry.tasks.low_priority_symbolication.calculation_magic", lambda x, y: True)
    def test_is_eligible_not_lpq(self, store) -> None:
        _update_lpq_eligibility(project_id=17, cutoff=10)

        assert store.get_lpq_projects() == {17}

    # TODO: Update once calculation_magic is implemented
    def test_not_eligible_in_lpq(self, store) -> None:
        store.add_project_to_lpq(17)

        _update_lpq_eligibility(project_id=17, cutoff=10)
        assert store.get_lpq_projects() == set()

    # TODO: Update once calculation_magic is implemented
    def test_not_eligible_not_lpq(self, store) -> None:
        _update_lpq_eligibility(project_id=17, cutoff=10)
        assert store.get_lpq_projects() == set()

    # TODO: Remove patch and update test once calculation_magic is implemented
    @freeze_time(datetime.fromtimestamp(0))
    @mock.patch("sentry.tasks.low_priority_symbolication.calculation_magic", lambda x, y: True)
    def test_is_eligible_recently_moved(self, store) -> None:
        store._backoff_timer = 10
        # Abusing the fact that removing always updates the backoff timer even if it's a noop
        store.remove_projects_from_lpq({17})

        _update_lpq_eligibility(17, 10)
        assert store.get_lpq_projects() == set()

    # TODO: Update once calculation_magic is implemented
    def test_not_eligible_recently_moved(self, store) -> None:
        store._backoff_timer = 10
        store.add_project_to_lpq(17)

        _update_lpq_eligibility(17, 10)
        assert store.get_lpq_projects() == {17}


class TestCalculationMagic(TestCase):
    pass
