from datetime import datetime, timedelta
from typing import TYPE_CHECKING, Any, Dict

import pytest
from freezegun import freeze_time

from sentry.processing import realtime_metrics
from sentry.processing.realtime_metrics.base import BucketedCount, DurationHistogram
from sentry.processing.realtime_metrics.redis import RedisRealtimeMetricsStore
from sentry.tasks.low_priority_symbolication import (
    _scan_for_suspect_projects,
    _update_lpq_eligibility,
    calculation_magic,
)
from sentry.testutils import TestCase
from sentry.testutils.helpers.task_runner import TaskRunner
from sentry.utils.compat import mock

if TYPE_CHECKING:
    from typing import Callable

    def _fixture(func: Callable[..., Any]) -> Callable[..., None]:
        ...

    pytest.fixture = _fixture


def create_store() -> RedisRealtimeMetricsStore:
    return RedisRealtimeMetricsStore(
        cluster="default",
        counter_bucket_size=10,
        counter_ttl=timedelta(milliseconds=400),
        histogram_bucket_size=10,
        histogram_ttl=timedelta(milliseconds=400),
    )


STORE = create_store()


def reset_store() -> None:
    STORE = create_store()
    # TODO: i am bad at python
    STORE


class TestScanForSuspectProjects(TestCase):
    def tearDown(self):
        reset_store()

    @mock.patch("sentry.processing.realtime_metrics", STORE)
    def test_no_metrics_not_in_lpq(self) -> None:
        assert realtime_metrics.get_lpq_projects() == set()

        with TaskRunner():
            _scan_for_suspect_projects()

        assert realtime_metrics.get_lpq_projects() == set()

    @mock.patch("sentry.processing.realtime_metrics", STORE)
    def test_no_metrics_in_lpq(self) -> None:
        realtime_metrics.add_project_to_lpq(17)
        assert realtime_metrics.get_lpq_projects() == {17}

        with TaskRunner():
            _scan_for_suspect_projects()

        assert realtime_metrics.get_lpq_projects() == set()

    @freeze_time(datetime.fromtimestamp(0))
    @mock.patch("sentry.tasks.low_priority_symbolication.calculation_magic", lambda x, y: True)
    @mock.patch("sentry.processing.realtime_metrics", STORE)
    def test_has_metric_not_in_lpq(self) -> None:
        realtime_metrics.increment_project_event_counter(17, 0)
        assert realtime_metrics.get_lpq_projects() == set()

        with TaskRunner():
            _scan_for_suspect_projects()

        assert realtime_metrics.get_lpq_projects() == {17}

    @freeze_time(datetime.fromtimestamp(0))
    @mock.patch("sentry.tasks.low_priority_symbolication.calculation_magic", lambda x, y: True)
    @mock.patch("sentry.processing.realtime_metrics", STORE)
    def test_has_metric_in_lpq(self) -> None:
        realtime_metrics.increment_project_event_counter(17, 0)
        realtime_metrics.add_project_to_lpq(17)
        assert realtime_metrics.get_lpq_projects() == {17}

        with TaskRunner():
            _scan_for_suspect_projects()

        assert realtime_metrics.get_lpq_projects() == {17}

    @freeze_time(datetime.fromtimestamp(0))
    @mock.patch("sentry.tasks.low_priority_symbolication.calculation_magic", lambda x, y: True)
    @mock.patch("sentry.processing.realtime_metrics", STORE)
    def test_add_one_project_remove_one_project(self) -> None:
        realtime_metrics.increment_project_event_counter(17, 0)
        realtime_metrics.remove_projects_from_lpq([17])
        realtime_metrics.add_project_to_lpq(1)
        assert realtime_metrics.get_lpq_projects() == {1}

        with TaskRunner():
            _scan_for_suspect_projects()

        assert realtime_metrics.get_lpq_projects() == {17}


class UpdateLpqEligibility(TestCase):
    def test_no_counts_no_durations_not_lpq(self) -> None:
        _update_lpq_eligibility(17, 10)
        assert realtime_metrics.get_lpq_projects() == set()

    def test_no_counts_no_durations_in_lpq(self) -> None:
        realtime_metrics.add_project_to_lpq(17)
        assert realtime_metrics.get_lpq_projects() == {17}

        _update_lpq_eligibility(17, 10)
        assert realtime_metrics.get_lpq_projects() == set()

    # TODO: Remove patch and update test once calculation_magic is implemented
    @freeze_time(datetime.fromtimestamp(0))
    @mock.patch("sentry.tasks.low_priority_symbolication.calculation_magic", lambda x, y: True)
    def test_some_counts_no_durations(self) -> None:
        realtime_metrics.increment_project_event_counter(17, 0)
        assert realtime_metrics.get_lpq_projects() == set()

        _update_lpq_eligibility(17, 10)
        assert realtime_metrics.get_lpq_projects() == {17}

    # TODO: Remove patch and update test once calculation_magic is implemented
    @freeze_time(datetime.fromtimestamp(0))
    @mock.patch("sentry.tasks.low_priority_symbolication.calculation_magic", lambda x, y: True)
    def test_no_counts_some_durations(self) -> None:
        realtime_metrics.increment_project_duration_counter(17, 0, 10)
        assert realtime_metrics.get_lpq_projects() == set()

        _update_lpq_eligibility(17, 10)
        assert realtime_metrics.get_lpq_projects() == {17}

    # TODO: Remove patch and update test once calculation_magic is implemented
    @freeze_time(datetime.fromtimestamp(0))
    @mock.patch("sentry.tasks.low_priority_symbolication.calculation_magic", lambda x, y: True)
    def test_is_eligible_in_lpq(self) -> None:
        realtime_metrics.add_project_to_lpq(17)

        _update_lpq_eligibility(17, 10)
        assert realtime_metrics.get_lpq_projects() == {17}

    # TODO: Remove patch and update test once calculation_magic is implemented
    @freeze_time(datetime.fromtimestamp(0))
    def test_is_eligible_not_lpq(self) -> None:
        _update_lpq_eligibility(17, 10)

        assert realtime_metrics.get_lpq_projects() == {17}


    # TODO: Update once calculation_magic is implemented
    def test_not_eligible_in_lpq(self) -> None:
        realtime_metrics.add_project_to_lpq(17)

        _update_lpq_eligibility(17, 10)
        assert realtime_metrics.get_lpq_projects() == set()


class TestCalculationMagic(TestCase):
    def empty_histogram(self) -> Dict[int, int]:
        return {duration: 0 for duration in range(0, 600, 10)}

    def test_no_counts_no_durations(self) -> None:
        assert not calculation_magic([], [])

    def test_some_counts_no_durations(self) -> None:
        counts = [BucketedCount(timestamp=42, count=17)]
        durations = []
        assert not calculation_magic(counts, durations)

    def test_no_counts_some_durations(self) -> None:
        counts = []
        histogram = self.empty_histogram()
        histogram.update({0: 17})
        durations = [DurationHistogram(timestamp=42, histogram=histogram)]
        assert not calculation_magic(counts, durations)

    def test_some_counts_some_durations(self) -> None:
        counts = [BucketedCount(timestamp=42, count=17)]
        histogram = self.empty_histogram()
        histogram.update({0: 17})
        durations = [DurationHistogram(timestamp=42, histogram=histogram)]
        assert not calculation_magic(counts, durations)
