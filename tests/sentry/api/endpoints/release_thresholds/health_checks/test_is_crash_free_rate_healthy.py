import math

# from sentry.api.endpoints.release_thresholds.constants import CRASH_SESSIONS_DISPLAY
# from sentry.api.endpoints.release_thresholds.health_checks.is_crash_free_rate_healthy import (
#     get_groups_totals,
#     get_interval_indexes,
#     is_crash_free_rate_healthy,
# )
# from sentry.api.endpoints.release_thresholds.types import EnrichedThreshold
# from sentry.api.serializers import serialize
from sentry.models.environment import Environment
from sentry.models.release import Release

# from sentry.models.release_threshold.constants import ReleaseThresholdType, TriggerType
from sentry.testutils.cases import TestCase


class GetIntervalIndexesTest(TestCase):
    def gets_indexes_range_in_intervals(self):
        pass

    def gets_indexes_range_overlaps_intervals(self):
        pass

    def raises_error_range_not_within_intervals(self):
        pass


class GetGroupTotals(TestCase):
    def filters_groups_and_sums_total_success(self):
        pass

    def filters_group_by_environment(self):
        pass

    def filters_group_by_status(self):
        pass

    def sums_group_via_indexes(self):
        pass


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

    def test_is_crash_free_rate_success(self):
        # test trigger under
        # test trigger over
        pass

    def test_is_crash_free_rate_interval_idx_error(self):
        pass

    def test_get_group_totals_errors(self):
        pass
