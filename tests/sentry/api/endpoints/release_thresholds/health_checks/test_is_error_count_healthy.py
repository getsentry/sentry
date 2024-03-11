from datetime import timedelta

from django.utils import timezone

from sentry.api.endpoints.release_thresholds.health_checks.is_error_count_healthy import (
    is_error_count_healthy,
)
from sentry.api.endpoints.release_thresholds.types import EnrichedThreshold
from sentry.api.serializers import serialize
from sentry.models.environment import Environment
from sentry.models.release import Release
from sentry.models.release_threshold.constants import ReleaseThresholdType, TriggerType
from sentry.testutils.cases import TestCase


class ErrorCountThresholdCheckTest(TestCase):
    def setUp(self):
        # 3 projects
        self.project1 = self.create_project(name="foo", organization=self.organization)
        self.project2 = self.create_project(name="bar", organization=self.organization)

        self.canary_environment = Environment.objects.create(
            organization_id=self.organization.id, name="canary"
        )

        # release created for proj1, and proj2
        self.release1 = Release.objects.create(version="v1", organization=self.organization)
        # add_project get_or_creates a ReleaseProject
        self.release1.add_project(self.project1)
        self.release1.add_project(self.project2)

        # release created for proj1
        self.release2 = Release.objects.create(version="v2", organization=self.organization)
        # add_project get_or_creates a ReleaseProject
        self.release2.add_project(self.project1)

    def test_threshold_within_timeseries(self):
        """
        construct a timeseries with:
        - a single release
        - a single project
        - no environment
        - multiple timestamps both before and after our threshold window
        """
        now = timezone.now()
        timeseries = [
            {
                "release": self.release1.version,
                "project_id": self.project1.id,
                "time": (now - timedelta(minutes=3)).isoformat(),
                "environment": None,
                "count()": 1,
            },
            {
                "release": self.release1.version,
                "project_id": self.project1.id,
                "time": (now - timedelta(minutes=2)).isoformat(),
                "environment": None,
                "count()": 1,
            },
            {
                "release": self.release1.version,
                "project_id": self.project1.id,
                "time": (now - timedelta(minutes=1)).isoformat(),
                "environment": None,
                "count()": 1,
            },
            {
                "release": self.release1.version,
                "project_id": self.project1.id,
                "time": now.isoformat(),
                "environment": None,
                "count()": 1,
            },
        ]

        # current threshold within series
        current_threshold_healthy: EnrichedThreshold = {
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
            "threshold_type": ReleaseThresholdType.TOTAL_ERROR_COUNT,
            "trigger_type": TriggerType.OVER_STR,
            "value": 4,  # error counts _not_ be over threshold value
            "window_in_seconds": 60,  # NOTE: window_in_seconds only used to determine start/end. Not utilized in validation method
            "metric_value": None,
        }
        is_healthy, metric_count = is_error_count_healthy(
            ethreshold=current_threshold_healthy, timeseries=timeseries
        )
        assert is_healthy

        # threshold equal to count
        threshold_at_limit_healthy: EnrichedThreshold = {
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
            "threshold_type": ReleaseThresholdType.TOTAL_ERROR_COUNT,
            "trigger_type": TriggerType.OVER_STR,
            "value": 1,  # error counts equal to threshold limit value
            "window_in_seconds": 60,  # NOTE: window_in_seconds only used to determine start/end. Not utilized in validation method
            "metric_value": None,
        }
        is_healthy, metric_count = is_error_count_healthy(
            ethreshold=threshold_at_limit_healthy, timeseries=timeseries
        )
        assert is_healthy

        # past healthy threshold within series
        past_threshold_healthy: EnrichedThreshold = {
            "id": "3",
            "date": now,
            "start": now - timedelta(minutes=2),
            "end": now - timedelta(minutes=1),
            "environment": None,
            "is_healthy": False,
            "key": "",
            "project": serialize(self.project1),
            "project_id": self.project1.id,
            "project_slug": self.project1.slug,
            "release": self.release1.version,
            "threshold_type": ReleaseThresholdType.TOTAL_ERROR_COUNT,
            "trigger_type": TriggerType.OVER_STR,
            "value": 2,
            "window_in_seconds": 60,  # NOTE: window_in_seconds only used to determine start/end. Not utilized in validation method
            "metric_value": None,
        }
        is_healthy, metric_count = is_error_count_healthy(
            ethreshold=past_threshold_healthy, timeseries=timeseries
        )
        assert is_healthy

        # threshold within series but trigger is under
        threshold_under_unhealthy: EnrichedThreshold = {
            "id": "4",
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
            "threshold_type": ReleaseThresholdType.TOTAL_ERROR_COUNT,
            "trigger_type": TriggerType.UNDER_STR,
            "value": 4,
            "window_in_seconds": 60,  # NOTE: window_in_seconds only used to determine start/end. Not utilized in validation method
            "metric_value": None,
        }
        is_healthy, metric_count = is_error_count_healthy(
            ethreshold=threshold_under_unhealthy, timeseries=timeseries
        )
        assert not is_healthy

        # threshold within series but end is in future
        threshold_unfinished: EnrichedThreshold = {
            "id": "5",
            "date": now,
            "start": now - timedelta(minutes=1),
            "end": now + timedelta(minutes=5),
            "environment": None,
            "is_healthy": False,
            "key": "",
            "project": serialize(self.project1),
            "project_id": self.project1.id,
            "project_slug": self.project1.slug,
            "release": self.release1.version,
            "threshold_type": ReleaseThresholdType.TOTAL_ERROR_COUNT,
            "trigger_type": TriggerType.OVER_STR,
            "value": 4,
            "window_in_seconds": 60,  # NOTE: window_in_seconds only used to determine start/end. Not utilized in validation method
            "metric_value": None,
        }
        is_healthy, metric_count = is_error_count_healthy(
            ethreshold=threshold_unfinished, timeseries=timeseries
        )
        assert is_healthy

    def test_multiple_releases_within_timeseries(self):
        now = timezone.now()
        timeseries = [
            {
                "release": self.release1.version,
                "project_id": self.project1.id,
                "time": (now - timedelta(minutes=3)).isoformat(),
                "environment": None,
                "count()": 1,
            },
            {
                "release": self.release2.version,
                "project_id": self.project1.id,
                "time": (now - timedelta(minutes=3)).isoformat(),
                "environment": None,
                "count()": 2,
            },
            {
                "release": self.release1.version,
                "project_id": self.project1.id,
                "time": (now - timedelta(minutes=2)).isoformat(),
                "environment": None,
                "count()": 1,
            },
            {
                "release": self.release2.version,
                "project_id": self.project1.id,
                "time": (now - timedelta(minutes=2)).isoformat(),
                "environment": None,
                "count()": 2,
            },
            {
                "release": self.release1.version,
                "project_id": self.project1.id,
                "time": (now - timedelta(minutes=1)).isoformat(),
                "environment": None,
                "count()": 1,
            },
            {
                "release": self.release2.version,
                "project_id": self.project1.id,
                "time": (now - timedelta(minutes=1)).isoformat(),
                "environment": None,
                "count()": 2,
            },
            {
                "release": self.release1.version,
                "project_id": self.project1.id,
                "time": now.isoformat(),
                "environment": None,
                "count()": 1,
            },
            {
                "release": self.release2.version,
                "project_id": self.project1.id,
                "time": now.isoformat(),
                "environment": None,
                "count()": 2,
            },
        ]

        # base threshold within series
        threshold_healthy: EnrichedThreshold = {
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
            "threshold_type": ReleaseThresholdType.TOTAL_ERROR_COUNT,
            "trigger_type": TriggerType.OVER_STR,
            "value": 4,
            "window_in_seconds": 60,  # NOTE: window_in_seconds only used to determine start/end. Not utilized in validation method
            "metric_value": None,
        }
        is_healthy, metric_count = is_error_count_healthy(
            ethreshold=threshold_healthy, timeseries=timeseries
        )
        assert is_healthy

        # threshold within series but separate unhealthy release
        threshold_unhealthy: EnrichedThreshold = {
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
            "release": self.release2.version,
            "threshold_type": ReleaseThresholdType.TOTAL_ERROR_COUNT,
            "trigger_type": TriggerType.OVER_STR,
            "value": 1,
            "window_in_seconds": 60,  # NOTE: window_in_seconds only used to determine start/end. Not utilized in validation method
            "metric_value": None,
        }
        is_healthy, metric_count = is_error_count_healthy(
            ethreshold=threshold_unhealthy, timeseries=timeseries
        )
        assert not is_healthy

    def test_multiple_projects_within_timeseries(self):
        now = timezone.now()
        timeseries = [
            {
                "release": self.release1.version,
                "project_id": self.project1.id,
                "time": (now - timedelta(minutes=3)).isoformat(),
                "environment": None,
                "count()": 1,
            },
            {
                "release": self.release1.version,
                "project_id": self.project2.id,
                "time": (now - timedelta(minutes=3)).isoformat(),
                "environment": None,
                "count()": 2,
            },
            {
                "release": self.release1.version,
                "project_id": self.project1.id,
                "time": (now - timedelta(minutes=2)).isoformat(),
                "environment": None,
                "count()": 1,
            },
            {
                "release": self.release1.version,
                "project_id": self.project2.id,
                "time": (now - timedelta(minutes=2)).isoformat(),
                "environment": None,
                "count()": 2,
            },
            {
                "release": self.release1.version,
                "project_id": self.project1.id,
                "time": (now - timedelta(minutes=1)).isoformat(),
                "environment": None,
                "count()": 1,
            },
            {
                "release": self.release1.version,
                "project_id": self.project2.id,
                "time": (now - timedelta(minutes=1)).isoformat(),
                "environment": None,
                "count()": 2,
            },
            {
                "release": self.release1.version,
                "project_id": self.project1.id,
                "time": now.isoformat(),
                "environment": None,
                "count()": 1,
            },
            {
                "release": self.release1.version,
                "project_id": self.project2.id,
                "time": now.isoformat(),
                "environment": None,
                "count()": 2,
            },
        ]

        # base threshold within series
        # unhealthy means error count OVER 4 over 1m window
        threshold_healthy: EnrichedThreshold = {
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
            "threshold_type": ReleaseThresholdType.TOTAL_ERROR_COUNT,
            "trigger_type": TriggerType.OVER_STR,
            "value": 4,
            "window_in_seconds": 60,  # NOTE: window_in_seconds only used to determine start/end. Not utilized in validation method
            "metric_value": None,
        }
        is_healthy, metric_count = is_error_count_healthy(
            ethreshold=threshold_healthy, timeseries=timeseries
        )
        assert is_healthy

        # threshold within series but separate unhealthy project
        threshold_unhealthy: EnrichedThreshold = {
            "id": "2",
            "date": now,
            "start": now - timedelta(minutes=1),
            "end": now,
            "environment": None,
            "is_healthy": False,
            "key": "",
            "project": serialize(self.project2),
            "project_id": self.project2.id,
            "project_slug": self.project2.slug,
            "release": self.release1.version,
            "threshold_type": ReleaseThresholdType.TOTAL_ERROR_COUNT,
            "trigger_type": TriggerType.OVER_STR,
            "value": 1,
            "window_in_seconds": 60,  # NOTE: window_in_seconds only used to determine start/end. Not utilized in validation method
            "metric_value": None,
        }
        is_healthy, metric_count = is_error_count_healthy(
            ethreshold=threshold_unhealthy, timeseries=timeseries
        )
        assert not is_healthy

    def test_multiple_environments_within_timeseries(self):
        now = timezone.now()
        timeseries = [
            {
                "release": self.release1.version,
                "project_id": self.project1.id,
                "time": (now - timedelta(minutes=3)).isoformat(),
                "environment": None,
                "count()": 1,
            },
            {
                "release": self.release1.version,
                "project_id": self.project1.id,
                "time": (now - timedelta(minutes=3)).isoformat(),
                "environment": "canary",
                "count()": 2,
            },
            {
                "release": self.release1.version,
                "project_id": self.project1.id,
                "time": (now - timedelta(minutes=2)).isoformat(),
                "environment": None,
                "count()": 1,
            },
            {
                "release": self.release1.version,
                "project_id": self.project1.id,
                "time": (now - timedelta(minutes=2)).isoformat(),
                "environment": "canary",
                "count()": 2,
            },
            {
                "release": self.release1.version,
                "project_id": self.project1.id,
                "time": (now - timedelta(minutes=1)).isoformat(),
                "environment": None,
                "count()": 1,
            },
            {
                "release": self.release1.version,
                "project_id": self.project1.id,
                "time": (now - timedelta(minutes=1)).isoformat(),
                "environment": "canary",
                "count()": 2,
            },
            {
                "release": self.release1.version,
                "project_id": self.project1.id,
                "time": now.isoformat(),
                "environment": None,
                "count()": 1,
            },
            {
                "release": self.release1.version,
                "project_id": self.project1.id,
                "time": now.isoformat(),
                "environment": "canary",
                "count()": 2,
            },
        ]

        # base threshold within series
        threshold_healthy: EnrichedThreshold = {
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
            "threshold_type": ReleaseThresholdType.TOTAL_ERROR_COUNT,
            "trigger_type": TriggerType.OVER_STR,
            "value": 2,
            "window_in_seconds": 60,  # NOTE: window_in_seconds only used to determine start/end. Not utilized in validation method
            "metric_value": None,
        }
        is_healthy, metric_count = is_error_count_healthy(
            ethreshold=threshold_healthy, timeseries=timeseries
        )
        assert is_healthy

        # threshold within series but separate unhealthy environment
        threshold_unhealthy: EnrichedThreshold = {
            "id": "2",
            "date": now,
            "start": now - timedelta(minutes=1),
            "end": now,
            "environment": serialize(self.canary_environment),
            "is_healthy": False,
            "key": "",
            "project": serialize(self.project1),
            "project_id": self.project1.id,
            "project_slug": self.project1.slug,
            "release": self.release1.version,
            "threshold_type": ReleaseThresholdType.TOTAL_ERROR_COUNT,
            "trigger_type": TriggerType.OVER_STR,
            "value": 1,
            "window_in_seconds": 60,  # NOTE: window_in_seconds only used to determine start/end. Not utilized in validation method
            "metric_value": None,
        }
        is_healthy, metric_count = is_error_count_healthy(
            ethreshold=threshold_unhealthy, timeseries=timeseries
        )
        assert not is_healthy

    def test_unordered_timeseries(self):
        """
        construct a timeseries with:
        - a single release
        - a single project
        - no environment
        - multiple timestamps both before and after our threshold window
        - all disorganized
        """
        now = timezone.now()
        timeseries = [
            {
                "release": self.release1.version,
                "project_id": self.project1.id,
                "time": (now - timedelta(minutes=3)).isoformat(),
                "environment": None,
                "count()": 1,
            },
            {
                "release": self.release1.version,
                "project_id": self.project1.id,
                "time": now.isoformat(),
                "environment": None,
                "count()": 1,
            },
            {
                "release": self.release1.version,
                "project_id": self.project1.id,
                "time": (now - timedelta(minutes=1)).isoformat(),
                "environment": None,
                "count()": 1,
            },
            {
                "release": self.release1.version,
                "project_id": self.project1.id,
                "time": (now - timedelta(minutes=2)).isoformat(),
                "environment": None,
                "count()": 1,
            },
        ]

        # current threshold within series
        current_threshold_healthy: EnrichedThreshold = {
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
            "threshold_type": ReleaseThresholdType.TOTAL_ERROR_COUNT,
            "trigger_type": TriggerType.OVER_STR,
            "value": 4,  # error counts _not_ be over threshold value
            "window_in_seconds": 60,  # NOTE: window_in_seconds only used to determine start/end. Not utilized in validation method
            "metric_value": None,
        }
        is_healthy, metric_count = is_error_count_healthy(
            ethreshold=current_threshold_healthy, timeseries=timeseries
        )
        assert is_healthy

        # threshold equal to count
        threshold_at_limit_healthy: EnrichedThreshold = {
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
            "threshold_type": ReleaseThresholdType.TOTAL_ERROR_COUNT,
            "trigger_type": TriggerType.OVER_STR,
            "value": 1,  # error counts equal to threshold limit value
            "window_in_seconds": 60,  # NOTE: window_in_seconds only used to determine start/end. Not utilized in validation method
            "metric_value": None,
        }
        is_healthy, metric_count = is_error_count_healthy(
            ethreshold=threshold_at_limit_healthy, timeseries=timeseries
        )
        assert is_healthy

        # past healthy threshold within series
        past_threshold_healthy: EnrichedThreshold = {
            "id": "3",
            "date": now,
            "start": now - timedelta(minutes=2),
            "end": now - timedelta(minutes=1),
            "environment": None,
            "is_healthy": False,
            "key": "",
            "project": serialize(self.project1),
            "project_id": self.project1.id,
            "project_slug": self.project1.slug,
            "release": self.release1.version,
            "threshold_type": ReleaseThresholdType.TOTAL_ERROR_COUNT,
            "trigger_type": TriggerType.OVER_STR,
            "value": 2,
            "window_in_seconds": 60,  # NOTE: window_in_seconds only used to determine start/end. Not utilized in validation method
            "metric_value": None,
        }
        is_healthy, metric_count = is_error_count_healthy(
            ethreshold=past_threshold_healthy, timeseries=timeseries
        )
        assert is_healthy

        # threshold within series but trigger is under
        threshold_under_unhealthy: EnrichedThreshold = {
            "id": "4",
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
            "threshold_type": ReleaseThresholdType.TOTAL_ERROR_COUNT,
            "trigger_type": TriggerType.UNDER_STR,
            "value": 4,
            "window_in_seconds": 60,  # NOTE: window_in_seconds only used to determine start/end. Not utilized in validation method
            "metric_value": None,
        }
        is_healthy, metric_count = is_error_count_healthy(
            ethreshold=threshold_under_unhealthy, timeseries=timeseries
        )
        assert not is_healthy

        # threshold within series but end is in future
        threshold_unfinished: EnrichedThreshold = {
            "id": "5",
            "date": now,
            "start": now - timedelta(minutes=1),
            "end": now + timedelta(minutes=5),
            "environment": None,
            "is_healthy": False,
            "key": "",
            "project": serialize(self.project1),
            "project_id": self.project1.id,
            "project_slug": self.project1.slug,
            "release": self.release1.version,
            "threshold_type": ReleaseThresholdType.TOTAL_ERROR_COUNT,
            "trigger_type": TriggerType.OVER_STR,
            "value": 4,
            "window_in_seconds": 60,  # NOTE: window_in_seconds only used to determine start/end. Not utilized in validation method
            "metric_value": None,
        }
        is_healthy, metric_count = is_error_count_healthy(
            ethreshold=threshold_unfinished, timeseries=timeseries
        )
        assert is_healthy
