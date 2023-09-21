from __future__ import annotations

from datetime import datetime
from typing import TYPE_CHECKING, Generator
from unittest import mock

import pytest

from sentry.processing import realtime_metrics
from sentry.processing.realtime_metrics.base import RealtimeMetricsStore
from sentry.processing.realtime_metrics.redis import RedisRealtimeMetricsStore
from sentry.tasks import low_priority_symbolication
from sentry.tasks.low_priority_symbolication import (
    _scan_for_suspect_projects,
    _update_lpq_eligibility,
)
from sentry.testutils.helpers.datetime import freeze_time
from sentry.testutils.helpers.task_runner import TaskRunner
from sentry.utils.services import LazyServiceWrapper

if TYPE_CHECKING:  # TODO: pytest 7.x
    from _pytest.monkeypatch import MonkeyPatch


@pytest.fixture
def store() -> Generator[RealtimeMetricsStore, None, None]:
    store = LazyServiceWrapper(
        RealtimeMetricsStore,
        "sentry.processing.realtime_metrics.redis.RedisRealtimeMetricsStore",
        {
            "cluster": "default",
            "budget_bucket_size": 10,
            "budget_time_window": 120,
            "backoff_timer": 0,
        },
    )

    old_properties = realtime_metrics.__dict__.copy()
    store.expose(realtime_metrics.__dict__)
    yield store

    # cleanup
    realtime_metrics.__dict__.update(old_properties)


class TestScanForSuspectProjects:
    @pytest.fixture
    def mock_update_lpq_eligibility(
        self, monkeypatch: MonkeyPatch
    ) -> Generator[mock.Mock, None, None]:
        mock_fn = mock.Mock()
        monkeypatch.setattr(low_priority_symbolication, "update_lpq_eligibility", mock_fn)
        yield mock_fn

    def test_no_metrics_not_in_lpq(
        self, store: RealtimeMetricsStore, mock_update_lpq_eligibility: mock.Mock
    ) -> None:
        assert store.get_lpq_projects() == set()

        with TaskRunner():
            _scan_for_suspect_projects()

        assert store.get_lpq_projects() == set()
        assert not mock_update_lpq_eligibility.delay.called

    def test_no_metrics_in_lpq(
        self, store: RealtimeMetricsStore, mock_update_lpq_eligibility: mock.Mock
    ) -> None:
        store.add_project_to_lpq(17)
        assert store.get_lpq_projects() == {17}
        assert store.is_lpq_project(17)

        with TaskRunner():
            _scan_for_suspect_projects()

        assert store.get_lpq_projects() == set()
        assert not mock_update_lpq_eligibility.delay.called

    @freeze_time(datetime.fromtimestamp(1147))
    def test_has_metric(
        self, store: RealtimeMetricsStore, mock_update_lpq_eligibility: mock.Mock
    ) -> None:
        store.record_project_duration(17, 1.0)

        with TaskRunner():
            _scan_for_suspect_projects()

        assert mock_update_lpq_eligibility.delay.called


class TestUpdateLpqEligibility:
    def test_no_metrics_in_lpq(self, store: RealtimeMetricsStore) -> None:
        store.add_project_to_lpq(17)
        assert store.get_lpq_projects() == {17}

        _update_lpq_eligibility(project_id=17)
        assert store.get_lpq_projects() == set()

    def test_no_metrics_not_in_lpq(self, store: RealtimeMetricsStore) -> None:
        _update_lpq_eligibility(project_id=17)
        assert store.get_lpq_projects() == set()

    @freeze_time(datetime.fromtimestamp(1147))
    def test_is_eligible_not_lpq(self, store: RealtimeMetricsStore) -> None:
        assert store.get_lpq_projects() == set()

        store.record_project_duration(17, 1000000.0)

        _update_lpq_eligibility(project_id=17)
        assert store.get_lpq_projects() == {17}
        assert store.is_lpq_project(17)

    @freeze_time(datetime.fromtimestamp(0))
    def test_is_eligible_in_lpq(self, store: RealtimeMetricsStore) -> None:
        store.add_project_to_lpq(17)

        store.record_project_duration(17, 1000000.0)

        _update_lpq_eligibility(project_id=17)
        assert store.get_lpq_projects() == {17}
        assert store.is_lpq_project(17)

    def test_not_eligible_in_lpq(self, store: RealtimeMetricsStore) -> None:
        store.add_project_to_lpq(17)

        _update_lpq_eligibility(project_id=17)
        assert store.get_lpq_projects() == set()

    def test_not_eligible_not_lpq(self, store: RealtimeMetricsStore) -> None:
        _update_lpq_eligibility(project_id=17)
        assert store.get_lpq_projects() == set()

    @freeze_time(datetime.fromtimestamp(0))
    def test_is_eligible_recently_moved(self, store: RedisRealtimeMetricsStore) -> None:
        store._backoff_timer = 10
        # Abusing the fact that removing always updates the backoff timer even if it's a noop
        store.remove_projects_from_lpq({17})

        store.record_project_duration(17, 1000000.0)

        _update_lpq_eligibility(17)
        assert store.get_lpq_projects() == set()

    def test_not_eligible_recently_moved(self, store: RedisRealtimeMetricsStore) -> None:
        store._backoff_timer = 10
        store.add_project_to_lpq(17)

        _update_lpq_eligibility(17)
        assert store.get_lpq_projects() == {17}
        assert not store.is_lpq_project(16)
        assert store.is_lpq_project(17)
