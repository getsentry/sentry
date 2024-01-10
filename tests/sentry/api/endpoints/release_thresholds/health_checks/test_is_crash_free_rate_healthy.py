import math
from datetime import datetime, timedelta

from sentry.api.endpoints.release_thresholds.constants import CRASH_SESSIONS_DISPLAY
from sentry.api.endpoints.release_thresholds.health_checks.is_crash_free_rate_healthy import (
    is_crash_free_rate_healthy,
)
from sentry.api.endpoints.release_thresholds.types import EnrichedThreshold
from sentry.api.serializers import serialize
from sentry.models.environment import Environment
from sentry.models.release import Release
from sentry.models.release_threshold.constants import ReleaseThresholdType, TriggerType
from sentry.testutils.cases import TestCase


class CrashFreeRateThresholdCheckTest(TestCase):
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

    def create_sessions_data(self, crash_count: int):
        """
        Creates a sessions data response with 1000 + crash_count events
        """
        return {
            "groups": [
                {
                    "by": {
                        "project": self.project1.id,
                        "release": self.release1.version,
                        "session.status": "abnormal",
                    },
                    "totals": {"sum(session)": 0},
                    "series": {
                        "sum(session)": [  # NOTE: real response will have as many results as intervals
                            0,
                        ]
                    },
                },
                {
                    "by": {
                        "project": self.project1.id,
                        "release": self.release1.version,
                        "session.status": "crashed",
                    },
                    "totals": {"sum(session)": crash_count},
                    "series": {
                        "sum(session)": [  # NOTE: real response will have as many results as intervals
                            math.floor(crash_count / 2),
                            math.ceil(crash_count / 2),
                        ]
                    },
                },
                {
                    "by": {
                        "project": self.project1.id,
                        "release": self.release1.version,
                        "session.status": "errored",
                    },
                    "totals": {"sum(session)": 50},
                    "series": {
                        "sum(session)": [  # NOTE: real response will have as many results as intervals
                            50
                        ]
                    },
                },
                {
                    "by": {
                        "project": self.project1.id,
                        "release": self.release1.version,
                        "session.status": "healthy",
                    },
                    "totals": {"sum(session)": 950},
                    "series": {
                        "sum(session)": [  # NOTE: real response will have as many results as intervals
                            200,
                            750,
                        ]
                    },
                },
            ],
            "start": "2024-01-08T22:00:00Z",
            "end": "2024-01-09T23:00:00Z",
            "intervals": [
                "2024-01-08T22:00:00Z",
                "2024-01-08T23:00:00Z",
                "2024-01-09T00:00:00Z",
                "2024-01-09T01:00:00Z",
                "2024-01-09T02:00:00Z",
                "2024-01-09T03:00:00Z",
                "2024-01-09T04:00:00Z",
                "2024-01-09T05:00:00Z",
                "2024-01-09T06:00:00Z",
                "2024-01-09T07:00:00Z",
                "2024-01-09T08:00:00Z",
                "2024-01-09T09:00:00Z",
                "2024-01-09T10:00:00Z",
                "2024-01-09T11:00:00Z",
                "2024-01-09T12:00:00Z",
                "2024-01-09T13:00:00Z",
                "2024-01-09T14:00:00Z",
                "2024-01-09T15:00:00Z",
                "2024-01-09T16:00:00Z",
                "2024-01-09T17:00:00Z",
                "2024-01-09T18:00:00Z",
                "2024-01-09T19:00:00Z",
                "2024-01-09T20:00:00Z",
                "2024-01-09T21:00:00Z",
                "2024-01-09T22:00:00Z",
            ],
            "query": "release:v1 OR release:v2",
        }

    def test_threshold_within_sessions_data(self):
        """
        construct a timeseries with:
        - a single release
        - a single project
        - no environment
        - multiple timestamps both before and after our threshold window
        """
        now = datetime.utcnow()
        sessions_data = self.create_sessions_data(0)

        # current threshold within data
        threshold_limit_99: EnrichedThreshold = {
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
            "value": 99,  # crash rate _not_ be under threshold value
            "window_in_seconds": 60,  # NOTE: window_in_seconds used to determine start/end of the data fetch. Not utilized in validation method
            "metric_value": None,
        }
        is_healthy, metric_value = is_crash_free_rate_healthy(
            ethreshold=threshold_limit_99,
            sessions_data=sessions_data,
            display=CRASH_SESSIONS_DISPLAY,
        )
        assert is_healthy

        # threshold equal to rate
        data_at_limit = self.create_sessions_data(10)  # 10/1010 = 99%
        is_healthy, metric_value = is_crash_free_rate_healthy(
            ethreshold=threshold_limit_99,
            sessions_data=data_at_limit,
            display=CRASH_SESSIONS_DISPLAY,
        )
        assert is_healthy

        # threshold has been triggered
        data_unhealthy = self.create_sessions_data(100)  # 100/1100 = 90%
        is_healthy, metrmetric_valueic_count = is_crash_free_rate_healthy(
            ethreshold=threshold_limit_99,
            sessions_data=data_unhealthy,
            display=CRASH_SESSIONS_DISPLAY,
        )
        assert not is_healthy

    # TODO:
    # test data with different projects/release versions
    # test thresholds with unfinished periods
    # test thresholds with older finished periods
    # test multiple threshold environments

    # NOTE: IF not timeseries - is the below relevant?
    # def test_multiple_releases_within_timeseries(self):
    #     now = datetime.utcnow()
    #     timeseries = [
    #         {
    #             "release": self.release1.version,
    #             "project_id": self.project1.id,
    #             "time": (now - timedelta(minutes=3)).isoformat(),
    #             "environment": None,
    #             "count()": 1,
    #         },
    #         {
    #             "release": self.release2.version,
    #             "project_id": self.project1.id,
    #             "time": (now - timedelta(minutes=3)).isoformat(),
    #             "environment": None,
    #             "count()": 2,
    #         },
    #         {
    #             "release": self.release1.version,
    #             "project_id": self.project1.id,
    #             "time": (now - timedelta(minutes=2)).isoformat(),
    #             "environment": None,
    #             "count()": 1,
    #         },
    #         {
    #             "release": self.release2.version,
    #             "project_id": self.project1.id,
    #             "time": (now - timedelta(minutes=2)).isoformat(),
    #             "environment": None,
    #             "count()": 2,
    #         },
    #         {
    #             "release": self.release1.version,
    #             "project_id": self.project1.id,
    #             "time": (now - timedelta(minutes=1)).isoformat(),
    #             "environment": None,
    #             "count()": 1,
    #         },
    #         {
    #             "release": self.release2.version,
    #             "project_id": self.project1.id,
    #             "time": (now - timedelta(minutes=1)).isoformat(),
    #             "environment": None,
    #             "count()": 2,
    #         },
    #         {
    #             "release": self.release1.version,
    #             "project_id": self.project1.id,
    #             "time": now.isoformat(),
    #             "environment": None,
    #             "count()": 1,
    #         },
    #         {
    #             "release": self.release2.version,
    #             "project_id": self.project1.id,
    #             "time": now.isoformat(),
    #             "environment": None,
    #             "count()": 2,
    #         },
    #     ]

    #     # base threshold within series
    #     threshold_healthy: EnrichedThreshold = {
    #         "date": now,
    #         "start": now - timedelta(minutes=1),
    #         "end": now,
    #         "environment": None,
    #         "is_healthy": False,
    #         "key": "",
    #         "project": serialize(self.project1),
    #         "project_id": self.project1.id,
    #         "project_slug": self.project1.slug,
    #         "release": self.release1.version,
    #         "threshold_type": ReleaseThresholdType.TOTAL_ERROR_COUNT,
    #         "trigger_type": TriggerType.OVER_STR,
    #         "value": 4,
    #         "window_in_seconds": 60,  # NOTE: window_in_seconds only used to determine start/end. Not utilized in validation method
    #         "metric_value": None,
    #     }
    #     is_healthy, metric_count = is_crash_free_rate_healthy(
    #         ethreshold=threshold_healthy, timeseries=timeseries
    #     )
    #     assert is_healthy

    #     # threshold within series but separate unhealthy release
    #     threshold_unhealthy: EnrichedThreshold = {
    #         "date": now,
    #         "start": now - timedelta(minutes=1),
    #         "end": now,
    #         "environment": None,
    #         "is_healthy": False,
    #         "key": "",
    #         "project": serialize(self.project1),
    #         "project_id": self.project1.id,
    #         "project_slug": self.project1.slug,
    #         "release": self.release2.version,
    #         "threshold_type": ReleaseThresholdType.TOTAL_ERROR_COUNT,
    #         "trigger_type": TriggerType.OVER_STR,
    #         "value": 1,
    #         "window_in_seconds": 60,  # NOTE: window_in_seconds only used to determine start/end. Not utilized in validation method
    #         "metric_value": None,
    #     }
    #     is_healthy, metric_count = is_crash_free_rate_healthy(
    #         ethreshold=threshold_unhealthy, timeseries=timeseries
    #     )
    #     assert not is_healthy

    # def test_multiple_projects_within_timeseries(self):
    #     now = datetime.utcnow()
    #     timeseries = [
    #         {
    #             "release": self.release1.version,
    #             "project_id": self.project1.id,
    #             "time": (now - timedelta(minutes=3)).isoformat(),
    #             "environment": None,
    #             "count()": 1,
    #         },
    #         {
    #             "release": self.release1.version,
    #             "project_id": self.project2.id,
    #             "time": (now - timedelta(minutes=3)).isoformat(),
    #             "environment": None,
    #             "count()": 2,
    #         },
    #         {
    #             "release": self.release1.version,
    #             "project_id": self.project1.id,
    #             "time": (now - timedelta(minutes=2)).isoformat(),
    #             "environment": None,
    #             "count()": 1,
    #         },
    #         {
    #             "release": self.release1.version,
    #             "project_id": self.project2.id,
    #             "time": (now - timedelta(minutes=2)).isoformat(),
    #             "environment": None,
    #             "count()": 2,
    #         },
    #         {
    #             "release": self.release1.version,
    #             "project_id": self.project1.id,
    #             "time": (now - timedelta(minutes=1)).isoformat(),
    #             "environment": None,
    #             "count()": 1,
    #         },
    #         {
    #             "release": self.release1.version,
    #             "project_id": self.project2.id,
    #             "time": (now - timedelta(minutes=1)).isoformat(),
    #             "environment": None,
    #             "count()": 2,
    #         },
    #         {
    #             "release": self.release1.version,
    #             "project_id": self.project1.id,
    #             "time": now.isoformat(),
    #             "environment": None,
    #             "count()": 1,
    #         },
    #         {
    #             "release": self.release1.version,
    #             "project_id": self.project2.id,
    #             "time": now.isoformat(),
    #             "environment": None,
    #             "count()": 2,
    #         },
    #     ]

    #     # base threshold within series
    #     # unhealthy means error count OVER 4 over 1m window
    #     threshold_healthy: EnrichedThreshold = {
    #         "date": now,
    #         "start": now - timedelta(minutes=1),
    #         "end": now,
    #         "environment": None,
    #         "is_healthy": False,
    #         "key": "",
    #         "project": serialize(self.project1),
    #         "project_id": self.project1.id,
    #         "project_slug": self.project1.slug,
    #         "release": self.release1.version,
    #         "threshold_type": ReleaseThresholdType.TOTAL_ERROR_COUNT,
    #         "trigger_type": TriggerType.OVER_STR,
    #         "value": 4,
    #         "window_in_seconds": 60,  # NOTE: window_in_seconds only used to determine start/end. Not utilized in validation method
    #         "metric_value": None,
    #     }
    #     is_healthy, metric_count = is_crash_free_rate_healthy(
    #         ethreshold=threshold_healthy, timeseries=timeseries
    #     )
    #     assert is_healthy

    #     # threshold within series but separate unhealthy project
    #     threshold_unhealthy: EnrichedThreshold = {
    #         "date": now,
    #         "start": now - timedelta(minutes=1),
    #         "end": now,
    #         "environment": None,
    #         "is_healthy": False,
    #         "key": "",
    #         "project": serialize(self.project2),
    #         "project_id": self.project2.id,
    #         "project_slug": self.project2.slug,
    #         "release": self.release1.version,
    #         "threshold_type": ReleaseThresholdType.TOTAL_ERROR_COUNT,
    #         "trigger_type": TriggerType.OVER_STR,
    #         "value": 1,
    #         "window_in_seconds": 60,  # NOTE: window_in_seconds only used to determine start/end. Not utilized in validation method
    #         "metric_value": None,
    #     }
    #     is_healthy, metric_count = is_crash_free_rate_healthy(
    #         ethreshold=threshold_unhealthy, timeseries=timeseries
    #     )
    #     assert not is_healthy

    # def test_multiple_environments_within_timeseries(self):
    #     now = datetime.utcnow()
    #     timeseries = [
    #         {
    #             "release": self.release1.version,
    #             "project_id": self.project1.id,
    #             "time": (now - timedelta(minutes=3)).isoformat(),
    #             "environment": None,
    #             "count()": 1,
    #         },
    #         {
    #             "release": self.release1.version,
    #             "project_id": self.project1.id,
    #             "time": (now - timedelta(minutes=3)).isoformat(),
    #             "environment": "canary",
    #             "count()": 2,
    #         },
    #         {
    #             "release": self.release1.version,
    #             "project_id": self.project1.id,
    #             "time": (now - timedelta(minutes=2)).isoformat(),
    #             "environment": None,
    #             "count()": 1,
    #         },
    #         {
    #             "release": self.release1.version,
    #             "project_id": self.project1.id,
    #             "time": (now - timedelta(minutes=2)).isoformat(),
    #             "environment": "canary",
    #             "count()": 2,
    #         },
    #         {
    #             "release": self.release1.version,
    #             "project_id": self.project1.id,
    #             "time": (now - timedelta(minutes=1)).isoformat(),
    #             "environment": None,
    #             "count()": 1,
    #         },
    #         {
    #             "release": self.release1.version,
    #             "project_id": self.project1.id,
    #             "time": (now - timedelta(minutes=1)).isoformat(),
    #             "environment": "canary",
    #             "count()": 2,
    #         },
    #         {
    #             "release": self.release1.version,
    #             "project_id": self.project1.id,
    #             "time": now.isoformat(),
    #             "environment": None,
    #             "count()": 1,
    #         },
    #         {
    #             "release": self.release1.version,
    #             "project_id": self.project1.id,
    #             "time": now.isoformat(),
    #             "environment": "canary",
    #             "count()": 2,
    #         },
    #     ]

    #     # base threshold within series
    #     threshold_healthy: EnrichedThreshold = {
    #         "date": now,
    #         "start": now - timedelta(minutes=1),
    #         "end": now,
    #         "environment": None,
    #         "is_healthy": False,
    #         "key": "",
    #         "project": serialize(self.project1),
    #         "project_id": self.project1.id,
    #         "project_slug": self.project1.slug,
    #         "release": self.release1.version,
    #         "threshold_type": ReleaseThresholdType.TOTAL_ERROR_COUNT,
    #         "trigger_type": TriggerType.OVER_STR,
    #         "value": 2,
    #         "window_in_seconds": 60,  # NOTE: window_in_seconds only used to determine start/end. Not utilized in validation method
    #         "metric_value": None,
    #     }
    #     is_healthy, metric_count = is_crash_free_rate_healthy(
    #         ethreshold=threshold_healthy, timeseries=timeseries
    #     )
    #     assert is_healthy

    #     # threshold within series but separate unhealthy environment
    #     threshold_unhealthy: EnrichedThreshold = {
    #         "date": now,
    #         "start": now - timedelta(minutes=1),
    #         "end": now,
    #         "environment": serialize(self.canary_environment),
    #         "is_healthy": False,
    #         "key": "",
    #         "project": serialize(self.project1),
    #         "project_id": self.project1.id,
    #         "project_slug": self.project1.slug,
    #         "release": self.release1.version,
    #         "threshold_type": ReleaseThresholdType.TOTAL_ERROR_COUNT,
    #         "trigger_type": TriggerType.OVER_STR,
    #         "value": 1,
    #         "window_in_seconds": 60,  # NOTE: window_in_seconds only used to determine start/end. Not utilized in validation method
    #         "metric_value": None,
    #     }
    #     is_healthy, metric_count = is_crash_free_rate_healthy(
    #         ethreshold=threshold_unhealthy, timeseries=timeseries
    #     )
    #     assert not is_healthy

    # def test_unordered_timeseries(self):
    #     """
    #     construct a timeseries with:
    #     - a single release
    #     - a single project
    #     - no environment
    #     - multiple timestamps both before and after our threshold window
    #     - all disorganized
    #     """
    #     now = datetime.utcnow()
    #     timeseries = [
    #         {
    #             "release": self.release1.version,
    #             "project_id": self.project1.id,
    #             "time": (now - timedelta(minutes=3)).isoformat(),
    #             "environment": None,
    #             "count()": 1,
    #         },
    #         {
    #             "release": self.release1.version,
    #             "project_id": self.project1.id,
    #             "time": now.isoformat(),
    #             "environment": None,
    #             "count()": 1,
    #         },
    #         {
    #             "release": self.release1.version,
    #             "project_id": self.project1.id,
    #             "time": (now - timedelta(minutes=1)).isoformat(),
    #             "environment": None,
    #             "count()": 1,
    #         },
    #         {
    #             "release": self.release1.version,
    #             "project_id": self.project1.id,
    #             "time": (now - timedelta(minutes=2)).isoformat(),
    #             "environment": None,
    #             "count()": 1,
    #         },
    #     ]

    #     # current threshold within series
    #     current_threshold_healthy: EnrichedThreshold = {
    #         "date": now,
    #         "start": now - timedelta(minutes=1),
    #         "end": now,
    #         "environment": None,
    #         "is_healthy": False,
    #         "key": "",
    #         "project": serialize(self.project1),
    #         "project_id": self.project1.id,
    #         "project_slug": self.project1.slug,
    #         "release": self.release1.version,
    #         "threshold_type": ReleaseThresholdType.TOTAL_ERROR_COUNT,
    #         "trigger_type": TriggerType.OVER_STR,
    #         "value": 4,  # error counts _not_ be over threshold value
    #         "window_in_seconds": 60,  # NOTE: window_in_seconds only used to determine start/end. Not utilized in validation method
    #         "metric_value": None,
    #     }
    #     is_healthy, metric_count = is_crash_free_rate_healthy(
    #         ethreshold=current_threshold_healthy, timeseries=timeseries
    #     )
    #     assert is_healthy

    #     # threshold equal to count
    #     threshold_at_limit_healthy: EnrichedThreshold = {
    #         "date": now,
    #         "start": now - timedelta(minutes=1),
    #         "end": now,
    #         "environment": None,
    #         "is_healthy": False,
    #         "key": "",
    #         "project": serialize(self.project1),
    #         "project_id": self.project1.id,
    #         "project_slug": self.project1.slug,
    #         "release": self.release1.version,
    #         "threshold_type": ReleaseThresholdType.TOTAL_ERROR_COUNT,
    #         "trigger_type": TriggerType.OVER_STR,
    #         "value": 1,  # error counts equal to threshold limit value
    #         "window_in_seconds": 60,  # NOTE: window_in_seconds only used to determine start/end. Not utilized in validation method
    #         "metric_value": None,
    #     }
    #     is_healthy, metric_count = is_crash_free_rate_healthy(
    #         ethreshold=threshold_at_limit_healthy, timeseries=timeseries
    #     )
    #     assert is_healthy

    #     # past healthy threshold within series
    #     past_threshold_healthy: EnrichedThreshold = {
    #         "date": now,
    #         "start": now - timedelta(minutes=2),
    #         "end": now - timedelta(minutes=1),
    #         "environment": None,
    #         "is_healthy": False,
    #         "key": "",
    #         "project": serialize(self.project1),
    #         "project_id": self.project1.id,
    #         "project_slug": self.project1.slug,
    #         "release": self.release1.version,
    #         "threshold_type": ReleaseThresholdType.TOTAL_ERROR_COUNT,
    #         "trigger_type": TriggerType.OVER_STR,
    #         "value": 2,
    #         "window_in_seconds": 60,  # NOTE: window_in_seconds only used to determine start/end. Not utilized in validation method
    #         "metric_value": None,
    #     }
    #     is_healthy, metric_count = is_crash_free_rate_healthy(
    #         ethreshold=past_threshold_healthy, timeseries=timeseries
    #     )
    #     assert is_healthy

    #     # threshold within series but trigger is under
    #     threshold_under_unhealthy: EnrichedThreshold = {
    #         "date": now,
    #         "start": now - timedelta(minutes=1),
    #         "end": now,
    #         "environment": None,
    #         "is_healthy": False,
    #         "key": "",
    #         "project": serialize(self.project1),
    #         "project_id": self.project1.id,
    #         "project_slug": self.project1.slug,
    #         "release": self.release1.version,
    #         "threshold_type": ReleaseThresholdType.TOTAL_ERROR_COUNT,
    #         "trigger_type": TriggerType.UNDER_STR,
    #         "value": 4,
    #         "window_in_seconds": 60,  # NOTE: window_in_seconds only used to determine start/end. Not utilized in validation method
    #         "metric_value": None,
    #     }
    #     is_healthy, metric_count = is_crash_free_rate_healthy(
    #         ethreshold=threshold_under_unhealthy, timeseries=timeseries
    #     )
    #     assert not is_healthy

    #     # threshold within series but end is in future
    #     threshold_unfinished: EnrichedThreshold = {
    #         "date": now,
    #         "start": now - timedelta(minutes=1),
    #         "end": now + timedelta(minutes=5),
    #         "environment": None,
    #         "is_healthy": False,
    #         "key": "",
    #         "project": serialize(self.project1),
    #         "project_id": self.project1.id,
    #         "project_slug": self.project1.slug,
    #         "release": self.release1.version,
    #         "threshold_type": ReleaseThresholdType.TOTAL_ERROR_COUNT,
    #         "trigger_type": TriggerType.OVER_STR,
    #         "value": 4,
    #         "window_in_seconds": 60,  # NOTE: window_in_seconds only used to determine start/end. Not utilized in validation method
    #         "metric_value": None,
    #     }
    #     is_healthy, metric_count = is_crash_free_rate_healthy(
    #         ethreshold=threshold_unfinished, timeseries=timeseries
    #     )
    #     assert is_healthy
