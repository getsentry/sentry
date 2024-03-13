from datetime import timedelta
from typing import Any

from django.utils import timezone

from sentry.api.endpoints.release_thresholds.health_checks import is_new_issue_count_healthy
from sentry.api.endpoints.release_thresholds.types import EnrichedThreshold
from sentry.api.serializers import serialize
from sentry.models.release import Release
from sentry.models.release_threshold.constants import ReleaseThresholdType, TriggerType
from sentry.testutils.cases import TestCase


class NewIssueCountThresholdCheckTest(TestCase):
    def setUp(self):
        self.project1 = self.create_project(name="foo", organization=self.organization)
        self.release1 = Release.objects.create(version="v1", organization=self.organization)

    def test_success(self):
        now = timezone.now()
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
            "threshold_type": ReleaseThresholdType.NEW_ISSUE_COUNT,
            "trigger_type": TriggerType.OVER_STR,
            "value": 10,
            "window_in_seconds": 60,  # NOTE: window_in_seconds only used to determine start/end. Not utilized in validation method
            "metric_value": None,
            "id": "1",
        }
        mock_new_issue_counts = {
            "1": 0,
        }
        is_healthy, metric_value = is_new_issue_count_healthy(mock_threshold, mock_new_issue_counts)
        assert is_healthy
        assert metric_value == 0

    def test_multiple_thresholds(self):
        now = timezone.now()
        threshold: EnrichedThreshold = {
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
            "threshold_type": ReleaseThresholdType.NEW_ISSUE_COUNT,
            "trigger_type": TriggerType.OVER_STR,
            "value": 10,
            "window_in_seconds": 60,  # NOTE: window_in_seconds only used to determine start/end. Not utilized in validation method
            "metric_value": None,
            "id": "1",
        }
        threshold2: EnrichedThreshold = {
            "id": "2",
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
            "threshold_type": ReleaseThresholdType.NEW_ISSUE_COUNT,
            "trigger_type": TriggerType.OVER_STR,
            "value": 10,
            "window_in_seconds": 60,  # NOTE: window_in_seconds only used to determine start/end. Not utilized in validation method
            "metric_value": None,
            "id": "2",
        }
        threshold3: EnrichedThreshold = {
            "id": "3",
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
            "threshold_type": ReleaseThresholdType.NEW_ISSUE_COUNT,
            "trigger_type": TriggerType.OVER_STR,
            "value": 10,
            "window_in_seconds": 60,  # NOTE: window_in_seconds only used to determine start/end. Not utilized in validation method
            "metric_value": None,
            "id": "3",
        }
        mock_new_issue_counts = {
            "1": 0,
            "2": 10,
            "3": 100,
        }
        is_healthy, metric_value = is_new_issue_count_healthy(threshold, mock_new_issue_counts)
        assert is_healthy
        assert metric_value == 0

        is_healthy, metric_value = is_new_issue_count_healthy(threshold2, mock_new_issue_counts)
        assert is_healthy
        assert metric_value == 10

        is_healthy, metric_value = is_new_issue_count_healthy(threshold3, mock_new_issue_counts)
        assert not is_healthy
        assert metric_value == 100

    def test_success_under(self):
        now = timezone.now()
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
            "threshold_type": ReleaseThresholdType.NEW_ISSUE_COUNT,
            "trigger_type": TriggerType.UNDER_STR,
            "value": 10,
            "window_in_seconds": 60,  # NOTE: window_in_seconds only used to determine start/end. Not utilized in validation method
            "metric_value": None,
            "id": "1",
        }
        mock_new_issue_counts = {
            "1": 0,
        }
        is_healthy, metric_value = is_new_issue_count_healthy(mock_threshold, mock_new_issue_counts)
        assert not is_healthy
        assert metric_value == 0

    def test_no_new_issues(self):
        now = timezone.now()
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
            "threshold_type": ReleaseThresholdType.NEW_ISSUE_COUNT,
            "trigger_type": TriggerType.OVER_STR,
            "value": 10,
            "window_in_seconds": 60,  # NOTE: window_in_seconds only used to determine start/end. Not utilized in validation method
            "metric_value": None,
        }
        mock_new_issue_counts: dict[str, Any] = {}
        is_healthy, metric_value = is_new_issue_count_healthy(mock_threshold, mock_new_issue_counts)
        assert is_healthy
        assert metric_value == 0
