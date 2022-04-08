from datetime import datetime
from typing import TYPE_CHECKING, Any, Generator
from unittest import mock

import pytest
from freezegun import freeze_time

from sentry.processing import realtime_metrics
from sentry.processing.realtime_metrics.base import (
    BucketedCounts,
    BucketedDurationsHistograms,
    DurationsHistogram,
    RealtimeMetricsStore,
)
from sentry.processing.realtime_metrics.redis import RedisRealtimeMetricsStore
from sentry.tasks import low_priority_symbolication
from sentry.tasks.low_priority_symbolication import (
    _scan_for_suspect_projects,
    _update_lpq_eligibility,
    excessive_event_duration,
    excessive_event_rate,
)
from sentry.testutils.helpers.task_runner import TaskRunner
from sentry.utils.services import LazyServiceWrapper

if TYPE_CHECKING:
    from typing import Callable

    def _fixture(func: Callable[..., Any]) -> Callable[..., None]:
        ...

    pytest.fixture = _fixture


@pytest.fixture
def store() -> Generator[RealtimeMetricsStore, None, None]:
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


class TestScanForSuspectProjects:
    @pytest.fixture  # type: ignore
    def mock_update_lpq_eligibility(
        self, monkeypatch: "pytest.MonkeyPatch"
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

        with TaskRunner():
            _scan_for_suspect_projects()

        assert store.get_lpq_projects() == set()
        assert not mock_update_lpq_eligibility.delay.called

    @freeze_time(datetime.fromtimestamp(0))
    def test_has_metric(
        self, store: RealtimeMetricsStore, mock_update_lpq_eligibility: mock.Mock
    ) -> None:
        store.increment_project_event_counter(project_id=17, timestamp=0)

        with TaskRunner():
            _scan_for_suspect_projects()

        assert mock_update_lpq_eligibility.delay.called


class TestUpdateLpqEligibility:
    def test_no_counts_no_durations_in_lpq(self, store: RealtimeMetricsStore) -> None:
        store.add_project_to_lpq(17)
        assert store.get_lpq_projects() == {17}

        _update_lpq_eligibility(project_id=17, cutoff=10)
        assert store.get_lpq_projects() == set()

    def test_no_counts_no_durations_not_lpq(self, store: RealtimeMetricsStore) -> None:
        _update_lpq_eligibility(project_id=17, cutoff=10)
        assert store.get_lpq_projects() == set()

    @freeze_time(datetime.fromtimestamp(0))
    def test_is_eligible_not_lpq(
        self, store: RealtimeMetricsStore, monkeypatch: "pytest.MonkeyPatch"
    ) -> None:
        store.increment_project_event_counter(project_id=17, timestamp=0)
        assert store.get_lpq_projects() == set()

        monkeypatch.setattr(
            low_priority_symbolication, "excessive_event_rate", lambda proj, counts: True
        )

        _update_lpq_eligibility(project_id=17, cutoff=10)
        assert store.get_lpq_projects() == {17}

    @freeze_time(datetime.fromtimestamp(0))
    def test_is_eligible_in_lpq(
        self, store: RealtimeMetricsStore, monkeypatch: "pytest.MonkeyPatch"
    ) -> None:
        store.add_project_to_lpq(17)
        monkeypatch.setattr(
            low_priority_symbolication, "excessive_event_rate", lambda proj, counts: True
        )

        _update_lpq_eligibility(project_id=17, cutoff=10)
        assert store.get_lpq_projects() == {17}

    def test_not_eligible_in_lpq(self, store: RealtimeMetricsStore) -> None:
        store.add_project_to_lpq(17)

        _update_lpq_eligibility(project_id=17, cutoff=10)
        assert store.get_lpq_projects() == set()

    def test_not_eligible_not_lpq(self, store: RealtimeMetricsStore) -> None:
        _update_lpq_eligibility(project_id=17, cutoff=10)
        assert store.get_lpq_projects() == set()

    @freeze_time(datetime.fromtimestamp(0))
    def test_is_eligible_recently_moved(
        self, store: RedisRealtimeMetricsStore, monkeypatch: "pytest.MonkeyPatch"
    ) -> None:
        store._backoff_timer = 10
        # Abusing the fact that removing always updates the backoff timer even if it's a noop
        store.remove_projects_from_lpq({17})

        monkeypatch.setattr(
            low_priority_symbolication, "excessive_event_rate", lambda proj, counts: True
        )

        _update_lpq_eligibility(17, 10)
        assert store.get_lpq_projects() == set()

    def test_not_eligible_recently_moved(self, store: RedisRealtimeMetricsStore) -> None:
        store._backoff_timer = 10
        store.add_project_to_lpq(17)

        _update_lpq_eligibility(17, 10)
        assert store.get_lpq_projects() == {17}


class TestExcessiveEventRate:
    def test_high_rate_no_spike(self) -> None:
        # 600 events/10s for 2 minutes
        event_counts = BucketedCounts(timestamp=0, width=10, counts=[600] * 12)
        assert not excessive_event_rate(project_id=1, event_counts=event_counts)

    def test_low_rate_no_spike(self) -> None:
        # 1 event/s for 2 minutes
        event_counts = BucketedCounts(timestamp=0, width=10, counts=[10] * 12)
        assert not excessive_event_rate(project_id=1, event_counts=event_counts)

    def test_low_rate_spike(self) -> None:
        # 0 events for 5m, then 5 events/10s for 1m
        # total event rate = 30/360 = 1/12,
        # recent event rate = 30/60 = 1/2 > 5 * total event rate
        event_counts = BucketedCounts(timestamp=0, width=10, counts=[0] * 30 + [5] * 6)
        assert not excessive_event_rate(project_id=1, event_counts=event_counts)

    def test_high_rate_spike(self) -> None:
        # 0 events for 5m, then 500 events/10s for 1m
        # total event rate = 3600/360 = 10,
        # recent event rate = 3600/60 = 60 > 5 * total event rate
        event_counts = BucketedCounts(timestamp=0, width=10, counts=[0] * 30 + [600] * 6)
        assert excessive_event_rate(project_id=1, event_counts=event_counts)

    def test_flatline(self) -> None:
        event_counts = BucketedCounts(timestamp=0, width=10, counts=[0] * 12)
        assert not excessive_event_rate(project_id=1, event_counts=event_counts)


class TestExcessiveEventDuration:
    # Configured time window of these metrics is 3 minutes.

    def test_no_durations(self) -> None:
        durations = BucketedDurationsHistograms(
            timestamp=0, width=10, histograms=[DurationsHistogram()] * 5 * 6
        )
        assert not excessive_event_duration(project_id=1, durations=durations)

    def test_normal_rate_normal_duration(self) -> None:
        # 1 event/s for 3m, 1-5m durations
        histograms = []
        for _ in range(10 * 6 * 3):
            hist = DurationsHistogram(bucket_size=10)
            hist.incr(duration=60, count=5)
            hist.incr(duration=180, count=5)
            histograms.append(hist)
        durations = BucketedDurationsHistograms(timestamp=0, width=10, histograms=histograms)

        assert not excessive_event_duration(project_id=1, durations=durations)

    def test_normal_rate_long_duration(self) -> None:
        # 1 event/s for 3m, 9m durations
        histograms = []
        for _ in range(6 * 3):
            hist = DurationsHistogram(bucket_size=10)
            hist.incr(duration=9 * 60, count=10)
            histograms.append(hist)
        durations = BucketedDurationsHistograms(timestamp=0, width=10, histograms=histograms)

        assert excessive_event_duration(project_id=1, durations=durations)

    def test_low_rate_long_duration(self) -> None:
        # 1 event/m for 3m, 9m durations
        histograms = []
        durations = None
        for i in range(6 * 3):
            hist = DurationsHistogram(bucket_size=10)
            if i % 6 == 0:
                hist.incr(duration=9 * 60, count=1)
            histograms.append(hist)
            durations = BucketedDurationsHistograms(timestamp=0, width=10, histograms=histograms)

        assert durations is not None
        assert not excessive_event_duration(project_id=1, durations=durations)
