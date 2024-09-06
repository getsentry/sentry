from datetime import datetime, timedelta
from unittest.mock import patch

import pytest

from sentry.api.endpoints.release_thresholds.constants import CRASH_SESSIONS_DISPLAY
from sentry.api.endpoints.release_thresholds.health_checks.is_crash_free_rate_healthy import (
    get_groups_totals,
    get_interval_indexes,
    is_crash_free_rate_healthy_check,
)
from sentry.api.endpoints.release_thresholds.types import EnrichedThreshold
from sentry.api.serializers import serialize
from sentry.models.release import Release
from sentry.models.release_threshold.constants import ReleaseThresholdType, TriggerType
from sentry.testutils.cases import TestCase

from .test_fixtures import mock_sessions_data


class GetIntervalIndexesTest(TestCase):
    def setUp(self):
        # d.strftime('%Y-%m-%dT%H:%M:%SZ')
        # construct timestamps in iso utc format
        self.now = datetime.utcnow()
        offsets = [r for r in range(-5, 5)]
        self.intervals = [
            (self.now + timedelta(hours=x)).strftime("%Y-%m-%dT%H:%M:%SZ") for x in offsets
        ]

    def test_gets_indexes_range_in_intervals(self):
        start = self.now - timedelta(hours=1)
        end = self.now + timedelta(hours=1)
        start_idx, end_idx = get_interval_indexes(intervals=self.intervals, start=start, end=end)

        assert start_idx == 5
        assert end_idx == 6

    def test_gets_indexes_range_overlaps_intervals(self):
        start = self.now
        end = self.now + timedelta(hours=10)
        start_idx, end_idx = get_interval_indexes(intervals=self.intervals, start=start, end=end)

        assert start_idx == 6
        assert end_idx == 9

        start = self.now - timedelta(hours=10)
        end = self.now
        start_idx, end_idx = get_interval_indexes(intervals=self.intervals, start=start, end=end)

        assert start_idx == 0
        assert end_idx == 5

    def test_returns_bad_idxs_when_not_within_intervals(self):
        start = self.now - timedelta(15)
        end = self.now - timedelta(hours=11)
        start_idx, end_idx = get_interval_indexes(intervals=self.intervals, start=start, end=end)

        assert start_idx > end_idx


class GetGroupTotals(TestCase):
    def setUp(self):
        # Mock data has 10 intervals
        self.mock_sessions_data = mock_sessions_data

    def test_filters_groups_and_sums_total_success(self):
        total_v1 = get_groups_totals(
            sessions_data=self.mock_sessions_data,
            release_version="version1",
            project_id=1,
            field="sum(session)",
            start_idx=0,
            end_idx=9,
        )
        assert total_v1 == 11
        # filters via release version
        total_v2 = get_groups_totals(
            sessions_data=self.mock_sessions_data,
            release_version="version2",
            project_id=1,
            field="sum(session)",
            start_idx=0,
            end_idx=9,
        )
        assert total_v2 == 15

    def test_filters_group_by_project(self):
        total_p2_v1 = get_groups_totals(
            sessions_data=self.mock_sessions_data,
            release_version="version1",
            project_id=2,
            field="sum(session)",
            start_idx=0,
            end_idx=9,
        )
        assert total_p2_v1 == 0

        total_p2_v2 = get_groups_totals(
            sessions_data=self.mock_sessions_data,
            release_version="version2",
            project_id=2,
            field="sum(session)",
            start_idx=0,
            end_idx=9,
        )
        assert total_p2_v2 == 5

    def test_filters_group_by_environment(self):
        total_canary = get_groups_totals(
            sessions_data=self.mock_sessions_data,
            release_version="version1",
            project_id=1,
            field="sum(session)",
            start_idx=0,
            end_idx=9,
            environment="canary",
        )
        assert total_canary == 0
        total_production = get_groups_totals(
            sessions_data=self.mock_sessions_data,
            release_version="version1",
            project_id=1,
            field="sum(session)",
            start_idx=0,
            end_idx=9,
            environment="production",
        )
        assert total_production == 11

    def test_filters_group_by_status(self):
        crashed = get_groups_totals(
            sessions_data=self.mock_sessions_data,
            release_version="version1",
            project_id=1,
            field="sum(session)",
            start_idx=0,
            end_idx=9,
            status="crashed",
        )
        assert crashed == 1

    def test_sums_group_via_indexes(self):
        total_5_9 = get_groups_totals(
            sessions_data=self.mock_sessions_data,
            release_version="version1",
            project_id=1,
            field="sum(session)",
            start_idx=5,
            end_idx=9,
        )
        assert total_5_9 == 5

    def test_raises_errors_with_bad_indexes(self):
        with pytest.raises(IndexError):
            get_groups_totals(
                sessions_data=self.mock_sessions_data,
                release_version="version1",
                project_id=1,
                field="sum(session)",
                start_idx=11,
                end_idx=20,
            )

        with pytest.raises(IndexError):
            get_groups_totals(
                sessions_data=self.mock_sessions_data,
                release_version="version1",
                project_id=1,
                field="sum(session)",
                start_idx=1,
                end_idx=20,
            )


class CrashFreeRateThresholdCheckTest(TestCase):
    def setUp(self):
        self.project1 = self.create_project(name="foo", organization=self.organization)
        self.release1 = Release.objects.create(version="v1", organization=self.organization)
        self.sessions_data = mock_sessions_data

    @patch(
        "sentry.api.endpoints.release_thresholds.health_checks.is_crash_free_rate_healthy.get_interval_indexes"
    )
    @patch(
        "sentry.api.endpoints.release_thresholds.health_checks.is_crash_free_rate_healthy.get_groups_totals"
    )
    def test_is_crash_free_rate_success(self, mock_get_groups_totals, mock_get_interval_indexes):
        now = datetime.utcnow()

        mock_get_interval_indexes.return_value = 0, 10
        mock_get_groups_totals.side_effect = [0, 10]

        # current threshold within series
        mock_threshold: EnrichedThreshold = {
            "id": "1",
            "date": now,
            "start": now - timedelta(minutes=1),
            "end": now,
            "environment": None,
            "is_healthy": False,
            "key": "",
            "project": serialize(self.project1),
            "project_id": self.project1.id,
            "project_slug": self.project1.slug,
            "release": self.release1.version,
            "threshold_type": ReleaseThresholdType.CRASH_FREE_SESSION_RATE,
            "trigger_type": TriggerType.UNDER_STR,
            "value": 99,  # crash free rate
            "window_in_seconds": 60,  # NOTE: window_in_seconds only used to determine start/end. Not utilized in validation method
            "metric_value": None,
        }
        is_healthy, metric_value = is_crash_free_rate_healthy_check(
            ethreshold=mock_threshold,
            sessions_data=self.sessions_data,
            display=CRASH_SESSIONS_DISPLAY,
        )

        assert mock_get_interval_indexes.call_count == 1
        assert mock_get_groups_totals.call_count == 2
        assert is_healthy
        assert metric_value == 100

    @patch(
        "sentry.api.endpoints.release_thresholds.health_checks.is_crash_free_rate_healthy.get_interval_indexes"
    )
    @patch(
        "sentry.api.endpoints.release_thresholds.health_checks.is_crash_free_rate_healthy.get_groups_totals"
    )
    def test_is_crash_free_rate_failure(self, mock_get_groups_totals, mock_get_interval_indexes):
        now = datetime.utcnow()

        mock_get_interval_indexes.return_value = 0, 10
        mock_get_groups_totals.side_effect = [5, 10]  # 5 crashes, 10 total

        # current threshold within series
        mock_threshold: EnrichedThreshold = {
            "id": "1",
            "date": now,
            "start": now - timedelta(minutes=1),
            "end": now,
            "environment": None,
            "is_healthy": False,
            "key": "",
            "project": serialize(self.project1),
            "project_id": self.project1.id,
            "project_slug": self.project1.slug,
            "release": self.release1.version,
            "threshold_type": ReleaseThresholdType.CRASH_FREE_SESSION_RATE,
            "trigger_type": TriggerType.UNDER_STR,
            "value": 99,  # crash free rate
            "window_in_seconds": 60,  # NOTE: window_in_seconds only used to determine start/end. Not utilized in validation method
            "metric_value": None,
        }
        is_healthy, metric_value = is_crash_free_rate_healthy_check(
            ethreshold=mock_threshold,
            sessions_data=self.sessions_data,
            display=CRASH_SESSIONS_DISPLAY,
        )

        assert mock_get_interval_indexes.call_count == 1
        assert mock_get_groups_totals.call_count == 2
        assert not is_healthy
        assert metric_value == 50

    @patch(
        "sentry.api.endpoints.release_thresholds.health_checks.is_crash_free_rate_healthy.get_interval_indexes"
    )
    @patch(
        "sentry.api.endpoints.release_thresholds.health_checks.is_crash_free_rate_healthy.get_groups_totals"
    )
    def test_is_crash_free_rate_catches_interval_idx_error(
        self, mock_get_groups_totals, mock_get_interval_indexes
    ):
        now = datetime.utcnow()

        mock_get_interval_indexes.return_value = 0, 10

        def side_effect(**kwargs):
            raise IndexError

        mock_get_groups_totals.side_effect = side_effect

        # current threshold within series
        mock_threshold: EnrichedThreshold = {
            "id": "1",
            "date": now,
            "start": now - timedelta(minutes=1),
            "end": now,
            "environment": None,
            "is_healthy": False,
            "key": "",
            "project": serialize(self.project1),
            "project_id": self.project1.id,
            "project_slug": self.project1.slug,
            "release": self.release1.version,
            "threshold_type": ReleaseThresholdType.CRASH_FREE_SESSION_RATE,
            "trigger_type": TriggerType.UNDER_STR,
            "value": 99,  # crash free rate
            "window_in_seconds": 60,  # NOTE: window_in_seconds only used to determine start/end. Not utilized in validation method
            "metric_value": None,
        }
        is_healthy, metric_value = is_crash_free_rate_healthy_check(
            ethreshold=mock_threshold,
            sessions_data=self.sessions_data,
            display=CRASH_SESSIONS_DISPLAY,
        )

        assert mock_get_interval_indexes.call_count == 1
        assert mock_get_groups_totals.call_count == 1
        assert not is_healthy
        assert metric_value == -1

    @patch(
        "sentry.api.endpoints.release_thresholds.health_checks.is_crash_free_rate_healthy.get_interval_indexes"
    )
    @patch(
        "sentry.api.endpoints.release_thresholds.health_checks.is_crash_free_rate_healthy.get_groups_totals"
    )
    def test_get_group_catches_totals_errors(
        self, mock_get_groups_totals, mock_get_interval_indexes
    ):
        now = datetime.utcnow()

        mock_get_interval_indexes.return_value = 10, 0

        # current threshold within series
        mock_threshold: EnrichedThreshold = {
            "id": "1",
            "date": now,
            "start": now - timedelta(minutes=1),
            "end": now,
            "environment": None,
            "is_healthy": False,
            "key": "",
            "project": serialize(self.project1),
            "project_id": self.project1.id,
            "project_slug": self.project1.slug,
            "release": self.release1.version,
            "threshold_type": ReleaseThresholdType.CRASH_FREE_SESSION_RATE,
            "trigger_type": TriggerType.UNDER_STR,
            "value": 99,  # crash free rate
            "window_in_seconds": 60,  # NOTE: window_in_seconds only used to determine start/end. Not utilized in validation method
            "metric_value": None,
        }
        is_healthy, metric_value = is_crash_free_rate_healthy_check(
            ethreshold=mock_threshold,
            sessions_data=self.sessions_data,
            display=CRASH_SESSIONS_DISPLAY,
        )

        assert mock_get_interval_indexes.call_count == 1
        assert mock_get_groups_totals.call_count == 0
        assert not is_healthy
        assert metric_value == -1
