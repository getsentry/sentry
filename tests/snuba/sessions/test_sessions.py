from __future__ import annotations

import time
from datetime import datetime, timedelta
from datetime import timezone as dt_timezone
from unittest import mock

import pytest
from django.utils import timezone

from sentry.release_health.base import OverviewStat
from sentry.release_health.metrics import MetricsReleaseHealthBackend
from sentry.testutils.cases import BaseMetricsTestCase, TestCase

pytestmark = pytest.mark.sentry_metrics


def format_timestamp(dt):
    if not isinstance(dt, datetime):
        dt = datetime.fromtimestamp(dt)
    return dt.strftime("%Y-%m-%dT%H:%M:%S+00:00")


release_v1_0_0 = "foo@1.0.0"
release_v2_0_0 = "foo@2.0.0"


class ReleaseHealthBaseTestCase(BaseMetricsTestCase):
    session_1 = "5d52fd05-fcc9-4bf3-9dc9-267783670341"
    session_2 = "5e910c1a-6941-460e-9843-24103fb6a63c"
    session_3 = "a148c0c5-06a2-423b-8901-6b43b812cf82"
    user_1 = "39887d89-13b2-4c84-8c23-5d13d2102666"
    user_2 = "39887d89-13b2-4c84-8c23-5d13d2102667"
    user_3 = "39887d89-13b2-4c84-8c23-5d13d2102668"

    def create_sessions__v2_crashed(self) -> list[dict]:
        self.received = time.time()
        self.session_started = time.time() // 60 * 60

        return [
            self.build_session(
                distinct_id=self.user_1,
                session_id=self.session_1,
                status="exited",
                release=release_v1_0_0,
                environment="prod",
                started=self.session_started,
                received=self.received,
            ),
            self.build_session(
                distinct_id=self.user_1,
                session_id=self.session_2,
                release=release_v1_0_0,
                environment="prod",
                duration=None,
                started=self.session_started,
                received=self.received,
            ),
            self.build_session(
                distinct_id=self.user_1,
                session_id=self.session_2,
                seq=1,
                duration=30,
                status="exited",
                release=release_v1_0_0,
                environment="prod",
                started=self.session_started,
                received=self.received,
            ),
            self.build_session(
                distinct_id=self.user_1,
                session_id=self.session_3,
                status="crashed",
                release=release_v2_0_0,
                environment="prod",
                started=self.session_started,
                received=self.received,
            ),
        ]

    def create_sessions__v1(self) -> list[dict]:
        self.received = time.time()
        self.session_started = time.time() // 60 * 60

        return [
            self.build_session(
                distinct_id=self.user_1,
                session_id=self.session_1,
                status="exited",
                release=release_v1_0_0,
                environment="prod",
                started=self.session_started,
                received=self.received,
            ),
            self.build_session(
                distinct_id=self.user_2,
                session_id=self.session_2,
                status="crashed",
                release=release_v1_0_0,
                environment="prod",
                started=self.session_started,
                received=self.received,
            ),
            # session_3 initial update: no user ID
            self.build_session(
                distinct_id=None,
                session_id=self.session_3,
                status="ok",
                seq=0,
                release=release_v1_0_0,
                environment="prod",
                started=self.session_started,
                received=self.received,
            ),
            # session_3 subsequent update: user ID is here!
            self.build_session(
                distinct_id=self.user_3,
                session_id=self.session_3,
                status="ok",
                seq=123,
                release=release_v1_0_0,
                environment="prod",
                started=self.session_started,
                received=self.received,
            ),
        ]


class CheckHasHealthDataTestCase(TestCase, BaseMetricsTestCase):
    backend = MetricsReleaseHealthBackend()

    def test_check_has_health_data(self) -> None:
        self.store_session(
            self.build_session(
                project_id=self.project.id,
                org_id=self.project.organization_id,
                status="exited",
                release=release_v1_0_0,
            ),
        )

        data = self.backend.check_has_health_data(
            [(self.project.id, release_v1_0_0), (self.project.id, "dummy-release")]
        )
        assert data == {(self.project.id, release_v1_0_0)}

    def test_check_has_health_data_without_releases_should_include_sessions_lte_90_days(
        self,
    ) -> None:
        """
        Test that ensures that `check_has_health_data` returns a set of projects that has health
        data within the last 90d if only a list of project ids is provided and any project with
        session data earlier than 90 days should be included
        """
        project1 = self.project
        project2 = self.create_project(
            name="Bar2",
            slug="bar2",
            teams=[self.team],
            fire_project_created=True,
            organization=self.organization,
        )

        self.store_session(
            self.build_session(
                project_id=project1.id,
                org_id=project1.organization_id,
                status="exited",
            )
        )
        self.store_session(
            self.build_session(
                project_id=project2.id,
                org_id=project2.organization_id,
                status="exited",
            )
        )
        data = self.backend.check_has_health_data([project1.id, project2.id])
        assert data == {project1.id, project2.id}

    def test_check_has_health_data_does_not_crash_when_sending_projects_list_as_set(self) -> None:
        self.store_session(
            self.build_session(
                project_id=self.project.id,
                org_id=self.project.organization_id,
                status="exited",
            ),
        )

        data = self.backend.check_has_health_data({self.project.id})
        assert data == {self.project.id}


class GetProjectReleasesByStabilityTestCase(TestCase, ReleaseHealthBaseTestCase):
    backend = MetricsReleaseHealthBackend()

    def test_get_project_releases_by_stability(self) -> None:
        self.bulk_store_sessions(self.create_sessions__v2_crashed())

        # Add an extra session with a different `distinct_id` so that sorting by users
        # is stable
        self.store_session(
            self.build_session(
                release=release_v1_0_0,
                environment="prod",
                started=self.session_started,
                received=self.received,
            )
        )

        for scope in "sessions", "users":
            data = self.backend.get_project_releases_by_stability(
                [self.project.id], offset=0, limit=100, scope=scope, stats_period="24h"
            )

            assert data == [
                (self.project.id, release_v1_0_0),
                (self.project.id, release_v2_0_0),
            ]

    def test_get_project_releases_by_stability_for_crash_free_sort(self) -> None:
        """
        Test that ensures that using crash free rate sort options, returns a list of ASC releases
        according to the chosen crash_free sort option
        """

        self.bulk_store_sessions(self.create_sessions__v2_crashed())
        # add another user to session_release to make sure that they are sorted correctly
        self.store_session(
            self.build_session(
                status="exited",
                release=release_v1_0_0,
                environment="prod",
                started=self.session_started,
                received=self.received,
            )
        )

        for scope in "crash_free_sessions", "crash_free_users":
            data = self.backend.get_project_releases_by_stability(
                [self.project.id], offset=0, limit=100, scope=scope, stats_period="24h"
            )

            assert data == [
                (self.project.id, release_v2_0_0),
                (self.project.id, release_v1_0_0),
            ]

    def test_get_project_releases_by_stability_for_releases_with_users_data(self) -> None:
        """
        Test that ensures if releases contain no users data, then those releases should not be
        returned on `users` and `crash_free_users` sorts
        """
        self.bulk_store_sessions(self.create_sessions__v2_crashed())
        # add a session with no users data
        self.store_session(
            self.build_session(
                distinct_id=None,
                release="release-with-no-users",
                environment="prod",
                started=self.session_started,
                received=self.received,
            )
        )
        data = self.backend.get_project_releases_by_stability(
            [self.project.id], offset=0, limit=100, scope="users", stats_period="24h"
        )
        assert set(data) == {
            (self.project.id, release_v1_0_0),
            (self.project.id, release_v2_0_0),
        }

        data = self.backend.get_project_releases_by_stability(
            [self.project.id], offset=0, limit=100, scope="crash_free_users", stats_period="24h"
        )
        assert set(data) == {
            (self.project.id, release_v2_0_0),
            (self.project.id, release_v1_0_0),
        }


class GetCrashFreeBreakdownTestCase(TestCase, ReleaseHealthBaseTestCase):
    backend = MetricsReleaseHealthBackend()

    def setUp(self) -> None:
        super().setUp()

        self.four_days_ago = timezone.now() - timedelta(days=4)

    def test_with_and_without_environments(self) -> None:
        self.bulk_store_sessions(self.create_sessions__v2_crashed())

        for environments in [None, ["prod"]]:
            data = self.backend.get_crash_free_breakdown(
                project_id=self.project.id,
                release=release_v1_0_0,
                start=self.four_days_ago,
                environments=environments,
            )

            # Last returned date is generated within function, should be close to now:
            last_date = data[-1]["date"]
            assert timezone.now() - last_date < timedelta(seconds=1)

            assert data == [
                {
                    "crash_free_sessions": None,
                    "crash_free_users": None,
                    "date": self.four_days_ago + timedelta(days=1),
                    "total_sessions": 0,
                    "total_users": 0,
                },
                {
                    "crash_free_sessions": None,
                    "crash_free_users": None,
                    "date": self.four_days_ago + timedelta(days=2),
                    "total_sessions": 0,
                    "total_users": 0,
                },
                {
                    "crash_free_sessions": 100.0,
                    "crash_free_users": 100.0,
                    "total_sessions": 2,
                    "total_users": 1,
                    "date": mock.ANY,  # tested above
                },
            ]

    def test_all_sessions_crashed(self) -> None:
        self.bulk_store_sessions(self.create_sessions__v2_crashed())

        data = self.backend.get_crash_free_breakdown(
            project_id=self.project.id,
            release=release_v2_0_0,
            start=self.four_days_ago,
            environments=["prod"],
        )

        # Last returned date is generated within function, should be close to now:
        last_date = data[-1]["date"]
        assert timezone.now() - last_date < timedelta(seconds=1)

        assert data == [
            {
                "crash_free_sessions": None,
                "crash_free_users": None,
                "date": self.four_days_ago + timedelta(days=1),
                "total_sessions": 0,
                "total_users": 0,
            },
            {
                "crash_free_sessions": None,
                "crash_free_users": None,
                "date": self.four_days_ago + timedelta(days=2),
                "total_sessions": 0,
                "total_users": 0,
            },
            {
                "crash_free_sessions": 0.0,
                "crash_free_users": 0.0,
                "total_sessions": 1,
                "total_users": 1,
                "date": mock.ANY,
            },
        ]

    def test_with_non_existing_release(self) -> None:
        self.bulk_store_sessions(self.create_sessions__v2_crashed())

        data = self.backend.get_crash_free_breakdown(
            project_id=self.project.id,
            release="non-existing",
            start=self.four_days_ago,
            environments=["prod"],
        )

        # Last returned date is generated within function, should be close to now:
        last_date = data[-1]["date"]
        assert timezone.now() - last_date < timedelta(seconds=1)

        assert data == [
            {
                "crash_free_sessions": None,
                "crash_free_users": None,
                "date": self.four_days_ago + timedelta(days=1),
                "total_sessions": 0,
                "total_users": 0,
            },
            {
                "crash_free_sessions": None,
                "crash_free_users": None,
                "date": self.four_days_ago + timedelta(days=2),
                "total_sessions": 0,
                "total_users": 0,
            },
            {
                "crash_free_sessions": None,
                "crash_free_users": None,
                "total_sessions": 0,
                "total_users": 0,
                "date": mock.ANY,
            },
        ]


class SnubaSessionsTest(TestCase, ReleaseHealthBaseTestCase):
    backend = MetricsReleaseHealthBackend()

    def test_get_oldest_health_data_for_releases(self) -> None:
        self.bulk_store_sessions(self.create_sessions__v2_crashed())

        data = self.backend.get_oldest_health_data_for_releases([(self.project.id, release_v1_0_0)])
        expected_timestamp = datetime.fromtimestamp(
            self.session_started // 3600 * 3600, tz=dt_timezone.utc
        )
        assert data == {(self.project.id, release_v1_0_0): expected_timestamp}

    def test_get_release_adoption(self) -> None:
        self.bulk_store_sessions(self.create_sessions__v2_crashed())

        data = self.backend.get_release_adoption(
            [
                (self.project.id, release_v1_0_0),
                (self.project.id, release_v2_0_0),
                (self.project.id, "dummy-release"),
            ]
        )

        assert data == {
            (self.project.id, release_v1_0_0): {
                "sessions_24h": 2,
                "users_24h": 1,
                "adoption": 100.0,
                "sessions_adoption": 66.66666666666666,
                "project_sessions_24h": 3,
                "project_users_24h": 1,
            },
            (self.project.id, release_v2_0_0): {
                "sessions_24h": 1,
                "users_24h": 1,
                "adoption": 100.0,
                "sessions_adoption": 33.33333333333333,
                "project_sessions_24h": 3,
                "project_users_24h": 1,
            },
        }

    def test_get_release_adoption_lowered(self) -> None:
        self.bulk_store_sessions(self.create_sessions__v2_crashed())

        self.store_session(
            self.build_session(
                release=release_v2_0_0,
                environment="prod",
                status="crashed",
                started=self.session_started,
                received=self.received,
            )
        )

        data = self.backend.get_release_adoption(
            [
                (self.project.id, release_v1_0_0),
                (self.project.id, release_v2_0_0),
                (self.project.id, "dummy-release"),
            ]
        )

        assert data == {
            (self.project.id, release_v1_0_0): {
                "sessions_24h": 2,
                "users_24h": 1,
                "adoption": 50.0,
                "sessions_adoption": 50.0,
                "project_sessions_24h": 4,
                "project_users_24h": 2,
            },
            (self.project.id, release_v2_0_0): {
                "sessions_24h": 2,
                "users_24h": 2,
                "adoption": 100.0,
                "sessions_adoption": 50.0,
                "project_sessions_24h": 4,
                "project_users_24h": 2,
            },
        }

    def test_fetching_release_sessions_time_bounds_for_different_release(self) -> None:
        """
        Test that ensures only session bounds for releases are calculated according
        to their respective release
        """
        self.bulk_store_sessions(self.create_sessions__v2_crashed())

        # Same release session
        self.store_session(
            self.build_session(
                release=release_v1_0_0,
                environment="prod",
                status="exited",
                started=self.session_started - 3600 * 2,
                received=self.received - 3600 * 2,
            )
        )

        # Different release session
        self.store_session(
            self.build_session(
                release=release_v2_0_0,
                environment="prod",
                status="crashed",
                started=self.session_started - 3600 * 2,
                received=self.received - 3600 * 2,
            )
        )

        expected_formatted_lower_bound = (
            datetime.fromtimestamp(self.session_started - 3600 * 2)
            .replace(minute=0)
            .isoformat()[:19]
            + "Z"
        )

        expected_formatted_upper_bound = (
            datetime.fromtimestamp(self.session_started).replace(minute=0).isoformat()[:19] + "Z"
        )

        # Test for self.session_release
        data = self.backend.get_release_sessions_time_bounds(
            project_id=self.project.id,
            release=release_v1_0_0,
            org_id=self.organization.id,
            environments=["prod"],
        )
        assert data == {
            "sessions_lower_bound": expected_formatted_lower_bound,
            "sessions_upper_bound": expected_formatted_upper_bound,
        }

        # Test for self.session_crashed_release
        data = self.backend.get_release_sessions_time_bounds(
            project_id=self.project.id,
            release=release_v2_0_0,
            org_id=self.organization.id,
            environments=["prod"],
        )
        assert data == {
            "sessions_lower_bound": expected_formatted_lower_bound,
            "sessions_upper_bound": expected_formatted_upper_bound,
        }

    def test_fetching_release_sessions_time_bounds_for_different_release_with_no_sessions(
        self,
    ) -> None:
        """
        Test that ensures if no sessions are available for a specific release then the bounds
        should be returned as None
        """
        self.bulk_store_sessions(self.create_sessions__v2_crashed())

        data = self.backend.get_release_sessions_time_bounds(
            project_id=self.project.id,
            release="different_release",
            org_id=self.organization.id,
            environments=["prod"],
        )
        assert data == {
            "sessions_lower_bound": None,
            "sessions_upper_bound": None,
        }

    def test_basic_release_model_adoptions(self) -> None:
        """
        Test that the basic (project,release) data is returned
        """
        self.bulk_store_sessions(self.create_sessions__v2_crashed())

        proj_id = self.project.id
        data = self.backend.get_changed_project_release_model_adoptions([proj_id])
        assert set(data) == {(proj_id, "foo@1.0.0"), (proj_id, "foo@2.0.0")}

    def test_old_release_model_adoptions(self) -> None:
        """
        Test that old entries (older that 72 h) are not returned
        """
        self.bulk_store_sessions(self.create_sessions__v2_crashed())

        _100h = 100 * 60 * 60  # 100 hours in seconds
        proj_id = self.project.id
        self.store_session(
            self.build_session(
                release="foo@3.0.0",
                environment="prod",
                status="crashed",
                started=self.session_started - _100h,
                received=self.received - 3600 * 2,
            )
        )

        data = self.backend.get_changed_project_release_model_adoptions([proj_id])
        assert set(data) == {(proj_id, "foo@1.0.0"), (proj_id, "foo@2.0.0")}

    def test_multi_proj_release_model_adoptions(self) -> None:
        """Test that the api works with multiple projects"""
        self.bulk_store_sessions(self.create_sessions__v2_crashed())

        proj_id = self.project.id
        new_proj_id = proj_id + 1
        self.store_session(
            self.build_session(
                project_id=new_proj_id,
                release="foo@3.0.0",
                environment="prod",
                status="crashed",
                started=self.session_started,
                received=self.received - 3600 * 2,
            )
        )

        data = self.backend.get_changed_project_release_model_adoptions([proj_id, new_proj_id])
        assert set(data) == {
            (proj_id, "foo@1.0.0"),
            (proj_id, "foo@2.0.0"),
            (new_proj_id, "foo@3.0.0"),
        }


class GetProjectReleaseStatsTestCase(TestCase, ReleaseHealthBaseTestCase):
    backend = MetricsReleaseHealthBackend()

    @staticmethod
    def _add_timestamps_to_series(series, start: datetime):
        one_day = 24 * 60 * 60
        day0 = one_day * int(start.timestamp() / one_day)

        def ts(days: int) -> int:
            return day0 + days * one_day

        return [(ts(i + 1), data) for i, data in enumerate(series)]

    def _test_get_project_release_stats(
        self, stat: OverviewStat, release: str, expected_series, expected_totals
    ):
        end = timezone.now()
        start = end - timedelta(days=4)
        stats, totals = self.backend.get_project_release_stats(
            self.project.id,
            release=release,
            stat=stat,
            rollup=86400,
            start=start,
            end=end,
        )

        # one system returns lists instead of tuples
        normed = [(ts, data) for ts, data in stats]

        assert normed == self._add_timestamps_to_series(expected_series, start)
        assert totals == expected_totals

    def test_get_project_release_stats_users(self) -> None:
        self.bulk_store_sessions(self.create_sessions__v2_crashed())

        self._test_get_project_release_stats(
            "users",
            release_v1_0_0,
            [
                {
                    "duration_p50": None,
                    "duration_p90": None,
                    "users_abnormal": 0,
                    "users_crashed": 0,
                    "users_errored": 0,
                    "users_healthy": 0,
                    "users_unhandled": 0,
                    "users": 0,
                },
                {
                    "duration_p50": None,
                    "duration_p90": None,
                    "users_abnormal": 0,
                    "users_crashed": 0,
                    "users_errored": 0,
                    "users_healthy": 0,
                    "users_unhandled": 0,
                    "users": 0,
                },
                {
                    "duration_p50": None,
                    "duration_p90": None,
                    "users_abnormal": 0,
                    "users_crashed": 0,
                    "users_errored": 0,
                    "users_healthy": 0,
                    "users_unhandled": 0,
                    "users": 0,
                },
                {
                    "duration_p50": 45.0,
                    "duration_p90": 57.0,
                    "users_abnormal": 0,
                    "users_crashed": 0,
                    "users_errored": 0,
                    "users_healthy": 1,
                    "users_unhandled": 0,
                    "users": 1,
                },
            ],
            {
                "users_abnormal": 0,
                "users_crashed": 0,
                "users_errored": 0,
                "users_healthy": 1,
                "users_unhandled": 0,
                "users": 1,
            },
        )

    def test_get_project_release_stats_users_crashed(self) -> None:
        self.bulk_store_sessions(self.create_sessions__v2_crashed())

        self._test_get_project_release_stats(
            "users",
            release_v2_0_0,
            [
                {
                    "duration_p50": None,
                    "duration_p90": None,
                    "users_abnormal": 0,
                    "users_crashed": 0,
                    "users_errored": 0,
                    "users_healthy": 0,
                    "users_unhandled": 0,
                    "users": 0,
                },
                {
                    "duration_p50": None,
                    "duration_p90": None,
                    "users_abnormal": 0,
                    "users_crashed": 0,
                    "users_errored": 0,
                    "users_healthy": 0,
                    "users_unhandled": 0,
                    "users": 0,
                },
                {
                    "duration_p50": None,
                    "duration_p90": None,
                    "users_abnormal": 0,
                    "users_crashed": 0,
                    "users_errored": 0,
                    "users_healthy": 0,
                    "users_unhandled": 0,
                    "users": 0,
                },
                {
                    "duration_p50": None,
                    "duration_p90": None,
                    "users_abnormal": 0,
                    "users_crashed": 1,
                    "users_errored": 0,
                    "users_healthy": 0,
                    "users_unhandled": 0,
                    "users": 1,
                },
            ],
            {
                "users_abnormal": 0,
                "users_crashed": 1,
                "users_errored": 0,
                "users_healthy": 0,
                "users_unhandled": 0,
                "users": 1,
            },
        )

    def test_get_project_release_stats_sessions(self) -> None:
        self.bulk_store_sessions(self.create_sessions__v2_crashed())

        self._test_get_project_release_stats(
            "sessions",
            release_v1_0_0,
            [
                {
                    "duration_p50": None,
                    "duration_p90": None,
                    "sessions_abnormal": 0,
                    "sessions_crashed": 0,
                    "sessions_errored": 0,
                    "sessions_healthy": 0,
                    "sessions_unhandled": 0,
                    "sessions": 0,
                },
                {
                    "duration_p50": None,
                    "duration_p90": None,
                    "sessions_abnormal": 0,
                    "sessions_crashed": 0,
                    "sessions_errored": 0,
                    "sessions_healthy": 0,
                    "sessions_unhandled": 0,
                    "sessions": 0,
                },
                {
                    "duration_p50": None,
                    "duration_p90": None,
                    "sessions_abnormal": 0,
                    "sessions_crashed": 0,
                    "sessions_errored": 0,
                    "sessions_healthy": 0,
                    "sessions_unhandled": 0,
                    "sessions": 0,
                },
                {
                    "duration_p50": 45.0,
                    "duration_p90": 57.0,
                    "sessions_abnormal": 0,
                    "sessions_crashed": 0,
                    "sessions_errored": 0,
                    "sessions_healthy": 2,
                    "sessions_unhandled": 0,
                    "sessions": 2,
                },
            ],
            {
                "sessions_abnormal": 0,
                "sessions_crashed": 0,
                "sessions_errored": 0,
                "sessions_healthy": 2,
                "sessions_unhandled": 0,
                "sessions": 2,
            },
        )

    def test_get_project_release_stats_sessions_crashed(self) -> None:
        self.bulk_store_sessions(self.create_sessions__v2_crashed())

        self._test_get_project_release_stats(
            "sessions",
            release_v2_0_0,
            [
                {
                    "duration_p50": None,
                    "duration_p90": None,
                    "sessions_abnormal": 0,
                    "sessions_crashed": 0,
                    "sessions_errored": 0,
                    "sessions_healthy": 0,
                    "sessions_unhandled": 0,
                    "sessions": 0,
                },
                {
                    "sessions_unhandled": 0,
                    "duration_p50": None,
                    "duration_p90": None,
                    "sessions_abnormal": 0,
                    "sessions_crashed": 0,
                    "sessions_errored": 0,
                    "sessions_healthy": 0,
                    "sessions": 0,
                },
                {
                    "sessions_unhandled": 0,
                    "duration_p50": None,
                    "duration_p90": None,
                    "sessions_abnormal": 0,
                    "sessions_crashed": 0,
                    "sessions_errored": 0,
                    "sessions_healthy": 0,
                    "sessions": 0,
                },
                {
                    "sessions_unhandled": 0,
                    "duration_p50": None,
                    "duration_p90": None,
                    "sessions_abnormal": 0,
                    "sessions_crashed": 1,
                    "sessions_errored": 0,
                    "sessions_healthy": 0,
                    "sessions": 1,
                },
            ],
            {
                "sessions_unhandled": 0,
                "sessions_abnormal": 0,
                "sessions_crashed": 1,
                "sessions_errored": 0,
                "sessions_healthy": 0,
                "sessions": 1,
            },
        )

    def test_get_project_release_stats_no_sessions(self) -> None:
        """
        Test still returning correct data when no sessions are available
        :return:
        """
        self.bulk_store_sessions(self.create_sessions__v2_crashed())

        self._test_get_project_release_stats(
            "sessions",
            "INEXISTENT-RELEASE",
            [
                {
                    "duration_p50": None,
                    "duration_p90": None,
                    "sessions_abnormal": 0,
                    "sessions_crashed": 0,
                    "sessions_errored": 0,
                    "sessions_healthy": 0,
                    "sessions_unhandled": 0,
                    "sessions": 0,
                },
                {
                    "duration_p50": None,
                    "duration_p90": None,
                    "sessions_abnormal": 0,
                    "sessions_crashed": 0,
                    "sessions_errored": 0,
                    "sessions_healthy": 0,
                    "sessions_unhandled": 0,
                    "sessions": 0,
                },
                {
                    "duration_p50": None,
                    "duration_p90": None,
                    "sessions_abnormal": 0,
                    "sessions_crashed": 0,
                    "sessions_errored": 0,
                    "sessions_healthy": 0,
                    "sessions_unhandled": 0,
                    "sessions": 0,
                },
                {
                    "duration_p50": None,
                    "duration_p90": None,
                    "sessions_abnormal": 0,
                    "sessions_crashed": 0,
                    "sessions_errored": 0,
                    "sessions_healthy": 0,
                    "sessions_unhandled": 0,
                    "sessions": 0,
                },
            ],
            {
                "sessions_abnormal": 0,
                "sessions_crashed": 0,
                "sessions_errored": 0,
                "sessions_healthy": 0,
                "sessions_unhandled": 0,
                "sessions": 0,
            },
        )

    def test_get_project_release_stats_no_users(self) -> None:
        self.bulk_store_sessions(self.create_sessions__v2_crashed())

        self._test_get_project_release_stats(
            "users",
            "INEXISTENT-RELEASE",
            [
                {
                    "duration_p50": None,
                    "duration_p90": None,
                    "users_abnormal": 0,
                    "users_crashed": 0,
                    "users_errored": 0,
                    "users_healthy": 0,
                    "users_unhandled": 0,
                    "users": 0,
                },
                {
                    "duration_p50": None,
                    "duration_p90": None,
                    "users_abnormal": 0,
                    "users_crashed": 0,
                    "users_errored": 0,
                    "users_healthy": 0,
                    "users_unhandled": 0,
                    "users": 0,
                },
                {
                    "duration_p50": None,
                    "duration_p90": None,
                    "users_abnormal": 0,
                    "users_crashed": 0,
                    "users_errored": 0,
                    "users_healthy": 0,
                    "users_unhandled": 0,
                    "users": 0,
                },
                {
                    "duration_p50": None,
                    "duration_p90": None,
                    "users_abnormal": 0,
                    "users_crashed": 0,
                    "users_errored": 0,
                    "users_healthy": 0,
                    "users_unhandled": 0,
                    "users": 0,
                },
            ],
            {
                "users_abnormal": 0,
                "users_crashed": 0,
                "users_errored": 0,
                "users_healthy": 0,
                "users_unhandled": 0,
                "users": 0,
            },
        )


class GetCrashFreeRateTestCase(TestCase, BaseMetricsTestCase):
    """
    TestClass that tests that `get_current_and_previous_crash_free_rates` returns the correct
    `currentCrashFreeRate` and `previousCrashFreeRate` for each project

    TestData:
    Project 1:
        In the last 24h -> 2 Exited Sessions / 2 Total Sessions -> 100% Crash free rate
        In the previous 24h (>24h & <48h) -> 2 Exited + 1 Crashed Sessions / 3 Sessions -> 66.7%

    Project 2:
        In the last 24h -> 1 Exited + 1 Crashed / 2 Total Sessions -> 50% Crash free rate
        In the previous 24h (>24h & <48h) -> 0 Sessions -> None

    Project 3:
        In the last 24h -> 0 Sessions -> None
        In the previous 24h (>24h & <48h) -> 4 Exited + 1 Crashed / 5 Total Sessions -> 80%
    """

    backend = MetricsReleaseHealthBackend()

    def setUp(self) -> None:
        super().setUp()
        self.session_started = time.time() // 60 * 60
        self.session_started_gt_24_lt_48 = self.session_started - 30 * 60 * 60
        self.project2 = self.create_project(
            name="Bar2",
            slug="bar2",
            teams=[self.team],
            fire_project_created=True,
            organization=self.organization,
        )
        self.project3 = self.create_project(
            name="Bar3",
            slug="bar3",
            teams=[self.team],
            fire_project_created=True,
            organization=self.organization,
        )

        # Project 1
        for _ in range(0, 2):
            self.store_session(
                self.build_session(
                    **{
                        "project_id": self.project.id,
                        "org_id": self.project.organization_id,
                        "status": "exited",
                    }
                )
            )

        for idx in range(0, 3):
            status = "exited"
            if idx == 2:
                status = "crashed"
            self.store_session(
                self.build_session(
                    **{
                        "project_id": self.project.id,
                        "org_id": self.project.organization_id,
                        "status": status,
                        "started": self.session_started_gt_24_lt_48,
                    }
                )
            )

        # Project 2
        for i in range(0, 2):
            status = "exited"
            if i == 1:
                status = "crashed"
            self.store_session(
                self.build_session(
                    **{
                        "project_id": self.project2.id,
                        "org_id": self.project2.organization_id,
                        "status": status,
                    }
                )
            )

        # Project 3
        for i in range(0, 5):
            status = "exited"
            if i == 4:
                status = "crashed"
            self.store_session(
                self.build_session(
                    **{
                        "project_id": self.project3.id,
                        "org_id": self.project3.organization_id,
                        "status": status,
                        "started": self.session_started_gt_24_lt_48,
                    }
                )
            )

    def test_get_current_and_previous_crash_free_rates(self) -> None:
        now = timezone.now().replace(minute=15, second=23)
        last_24h_start = now - 24 * timedelta(hours=1)
        last_48h_start = now - 2 * 24 * timedelta(hours=1)

        data = self.backend.get_current_and_previous_crash_free_rates(
            org_id=self.organization.id,
            project_ids=[self.project.id, self.project2.id, self.project3.id],
            current_start=last_24h_start,
            current_end=now,
            previous_start=last_48h_start,
            previous_end=last_24h_start,
            rollup=3600,
        )

        assert data == {
            self.project.id: {
                "currentCrashFreeRate": 100,
                "previousCrashFreeRate": 66.66666666666667,
            },
            self.project2.id: {"currentCrashFreeRate": 50.0, "previousCrashFreeRate": None},
            self.project3.id: {"currentCrashFreeRate": None, "previousCrashFreeRate": 80.0},
        }

    def test_get_current_and_previous_crash_free_rates_with_zero_sessions(self) -> None:
        now = timezone.now().replace(minute=15, second=23)
        last_48h_start = now - 2 * 24 * timedelta(hours=1)
        last_72h_start = now - 3 * 24 * timedelta(hours=1)
        last_96h_start = now - 4 * 24 * timedelta(hours=1)

        data = self.backend.get_current_and_previous_crash_free_rates(
            org_id=self.organization.id,
            project_ids=[self.project.id],
            current_start=last_72h_start,
            current_end=last_48h_start,
            previous_start=last_96h_start,
            previous_end=last_72h_start,
            rollup=3600,
        )

        assert data == {
            self.project.id: {
                "currentCrashFreeRate": None,
                "previousCrashFreeRate": None,
            },
        }

    def test_extract_crash_free_rate_from_result_groups(self) -> None:
        result_groups = [
            {"by": {"project_id": 1}, "totals": {"rate": 0.66}},
            {"by": {"project_id": 2}, "totals": {"rate": 0.8}},
        ]
        crash_free_rates = self.backend._extract_crash_free_rates_from_result_groups(result_groups)
        assert crash_free_rates[1] == 0.66 * 100
        assert crash_free_rates[2] == 0.8 * 100

    def test_extract_crash_free_rate_from_result_groups_with_none(self) -> None:
        result_groups = [
            {"by": {"project_id": 1}, "totals": {"rate": 0.66}},
            {"by": {"project_id": 2}, "totals": {"rate": None}},
        ]
        crash_free_rates = self.backend._extract_crash_free_rates_from_result_groups(result_groups)
        assert crash_free_rates[1] == 0.66 * 100
        assert crash_free_rates[2] is None

    def test_extract_crash_free_rates_from_result_groups_only_none(self) -> None:
        result_groups = [
            {"by": {"project_id": 2}, "totals": {"rate": None}},
        ]
        crash_free_rates = self.backend._extract_crash_free_rates_from_result_groups(result_groups)
        assert crash_free_rates[2] is None


class GetProjectReleasesCountTest(TestCase, BaseMetricsTestCase):
    backend = MetricsReleaseHealthBackend()

    def test_empty(self) -> None:
        # Test no errors when no session data
        org = self.create_organization()
        proj = self.create_project(organization=org)
        assert (
            self.backend.get_project_releases_count(
                org.id, [proj.id], "crash_free_users", stats_period="14d"
            )
            == 0
        )

    def test_with_other_metrics(self) -> None:
        assert isinstance(self, BaseMetricsTestCase)

        # Test no errors when no session data
        org = self.create_organization()
        proj = self.create_project(organization=org)

        # Insert a different set metric:
        for value in 1, 2, 3:
            self.store_metric(
                org_id=org.id,
                project_id=proj.id,
                mri="s:sessions/foobarbaz@none",  # any other metric ID
                timestamp=int(time.time()),
                tags={},
                value=value,
            )

        assert (
            self.backend.get_project_releases_count(
                org.id, [proj.id], "crash_free_users", stats_period="14d"
            )
            == 0
        )

    def test(self) -> None:
        project_1 = self.project
        release_1 = self.create_release(project_1)
        project_2 = self.create_project()
        release_2 = self.create_release(project_2)
        self.bulk_store_sessions(
            [
                self.build_session(environment=self.environment.name, release=release_1.version),
                self.build_session(
                    environment="staging",
                    project_id=project_2.id,
                    release=release_2.version,
                ),
            ]
        )
        assert (
            self.backend.get_project_releases_count(
                self.organization.id, [project_1.id], "sessions"
            )
            == 1
        )
        assert (
            self.backend.get_project_releases_count(self.organization.id, [project_1.id], "users")
            == 1
        )
        assert (
            self.backend.get_project_releases_count(
                self.organization.id, [project_1.id, project_2.id], "sessions"
            )
            == 2
        )
        assert (
            self.backend.get_project_releases_count(
                self.organization.id,
                [project_1.id, project_2.id],
                "users",
            )
            == 2
        )
        assert (
            self.backend.get_project_releases_count(
                self.organization.id,
                [project_1.id, project_2.id],
                "sessions",
                environments=[self.environment.name],
            )
            == 1
        )


class CheckReleasesHaveHealthDataTest(TestCase, BaseMetricsTestCase):
    backend = MetricsReleaseHealthBackend()

    def run_test(self, expected, projects, releases, start=None, end=None):
        if not start:
            start = datetime.now() - timedelta(days=1)
        if not end:
            end = datetime.now()
        assert self.backend.check_releases_have_health_data(
            self.organization.id,
            [p.id for p in projects],
            [r.version for r in releases],
            start,
            end,
        ) == {v.version for v in expected}

    def test_empty(self) -> None:
        # Test no errors when no session data
        project_1_release = self.create_release(self.project)
        self.run_test([], [self.project], [project_1_release])

    def test(self) -> None:
        project_1 = self.project
        project_2 = self.create_project()
        release_1 = self.create_release(project_1, version="1", additional_projects=[project_2])
        release_2 = self.create_release(project_2, version="2")
        self.bulk_store_sessions(
            [
                self.build_session(release=release_1),
                self.build_session(project_id=project_2, release=release_1),
                self.build_session(project_id=project_2, release=release_2),
            ]
        )
        self.run_test([release_1], [project_1], [release_1])
        self.run_test([release_1], [project_1], [release_1, release_2])
        self.run_test([release_1], [project_2], [release_1])
        self.run_test([release_1, release_2], [project_2], [release_1, release_2])
        self.run_test([release_1, release_2], [project_1, project_2], [release_1, release_2])


class CheckNumberOfSessions(TestCase, BaseMetricsTestCase):
    backend = MetricsReleaseHealthBackend()

    def setUp(self) -> None:
        super().setUp()
        # now_dt should be set to 17:40 of some day not in the future and (system time - now_dt)
        # must be less than 90 days for the metrics DB TTL
        ONE_DAY_AGO = timezone.now() - timedelta(days=1)
        self.now_dt = ONE_DAY_AGO.replace(hour=17, minute=40, second=0)
        self._5_min_ago_dt = self.now_dt - timedelta(minutes=5)
        self._30_min_ago_dt = self.now_dt - timedelta(minutes=30)
        self._1_h_ago_dt = self.now_dt - timedelta(hours=1)
        self._2_h_ago_dt = self.now_dt - timedelta(hours=2)
        self._3_h_ago_dt = self.now_dt - timedelta(hours=3)

        self.now = self.now_dt.timestamp()
        self._5_min_ago = self._5_min_ago_dt.timestamp()
        self._30_min_ago = self._30_min_ago_dt.timestamp()
        self._1_h_ago = self._1_h_ago_dt.timestamp()
        self._2_h_ago = self._2_h_ago_dt.timestamp()
        self._3_h_ago = self._3_h_ago_dt.timestamp()

    def test_no_sessions(self) -> None:
        """
        Tests that when there are no sessions the function behaves and returns 0
        """
        actual = self.backend.get_project_sessions_count(
            project_id=self.project.id,
            environment_id=None,
            rollup=60,
            start=self._30_min_ago_dt,
            end=self.now_dt,
        )
        assert 0 == actual

    def test_sessions_in_environment(self) -> None:
        """
        Tests that it correctly picks up the sessions for the selected environment
        in the selected time, not counting other environments and other times
        """
        prod_env = self.create_environment(name="production", project=self.project)

        self.bulk_store_sessions(
            [
                self.build_session(
                    environment="development", received=self._5_min_ago, started=self._5_min_ago
                ),
                self.build_session(
                    environment="production", received=self._5_min_ago, started=self._5_min_ago
                ),
                self.build_session(
                    environment="production", received=self._5_min_ago, started=self._5_min_ago
                ),
                self.build_session(
                    environment="production", received=self._2_h_ago, started=self._2_h_ago
                ),
            ]
        )

        prod_session_count = self.backend.get_project_sessions_count(
            project_id=self.project.id,
            environment_id=prod_env.id,
            rollup=60,
            start=self._1_h_ago_dt,
            end=self.now_dt,
        )
        assert prod_session_count == 2

    def test_environment_without_sessions(self) -> None:
        """
        We should get zero sessions, even if the environment name has not been indexed
        by the metrics indexer.
        """

        env_without_sessions = self.create_environment(
            name="this_has_no_sessions", project=self.project
        )

        self.bulk_store_sessions(
            [
                self.build_session(
                    environment="production",
                    received=self._5_min_ago,
                    started=self._5_min_ago,
                ),
                self.build_session(
                    environment=None, received=self._5_min_ago, started=self._5_min_ago
                ),
            ]
        )

        count_env_all = self.backend.get_project_sessions_count(
            project_id=self.project.id,
            environment_id=None,
            rollup=60,
            start=self._1_h_ago_dt,
            end=self.now_dt,
        )
        assert count_env_all == 2

        count_env_new = self.backend.get_project_sessions_count(
            project_id=self.project.id,
            environment_id=env_without_sessions.id,
            rollup=60,
            start=self._1_h_ago_dt,
            end=self.now_dt,
        )
        assert count_env_new == 0

    def test_sessions_in_all_environments(self) -> None:
        """
        When the environment is not specified sessions from all environments are counted
        """

        self.bulk_store_sessions(
            [
                self.build_session(
                    environment="development", received=self._5_min_ago, started=self._5_min_ago
                ),
                self.build_session(
                    environment="production", received=self._5_min_ago, started=self._5_min_ago
                ),
                self.build_session(
                    environment="production", received=self._5_min_ago, started=self._5_min_ago
                ),
                self.build_session(
                    environment="production", received=self._2_h_ago, started=self._2_h_ago
                ),
                self.build_session(
                    environment="development", received=self._2_h_ago, started=self._2_h_ago
                ),
            ]
        )

        actual = self.backend.get_project_sessions_count(
            project_id=self.project.id,
            environment_id=None,
            rollup=60,
            start=self._1_h_ago_dt,
            end=self.now_dt,
        )

        assert actual == 3

    def test_sessions_from_multiple_projects(self) -> None:
        """
        Only sessions from the specified project are considered
        """
        self.project_2 = self.create_project()

        self.bulk_store_sessions(
            [
                self.build_session(
                    environment="development", received=self._5_min_ago, started=self._5_min_ago
                ),
                self.build_session(
                    environment="production", received=self._5_min_ago, started=self._5_min_ago
                ),
                self.build_session(
                    environment="production",
                    received=self._5_min_ago,
                    project_id=self.project_2.id,
                    started=self._5_min_ago,
                ),
            ]
        )

        actual = self.backend.get_project_sessions_count(
            project_id=self.project.id,
            environment_id=None,
            rollup=60,
            start=self._1_h_ago_dt,
            end=self.now_dt,
        )

        assert actual == 2

    def test_sessions_per_project_no_sessions(self) -> None:
        """
        Tests that no sessions are returned
        """
        self.project_2 = self.create_project()

        actual = self.backend.get_num_sessions_per_project(
            project_ids=[self.project.id, self.project_2.id],
            environment_ids=None,
            start=self._30_min_ago_dt,
            end=self.now_dt,
        )
        assert [] == actual

    def test_sesions_per_project_multiple_projects(self) -> None:
        dev_env = self.create_environment(name="development", project=self.project)
        prod_env = self.create_environment(name="production", project=self.project)

        dev = "development"
        prod = "production"
        test = "test"
        project_1 = self.project
        project_2 = self.create_project()
        project_3 = self.create_project()

        self.bulk_store_sessions(
            [
                # counted in p1
                self.build_session(
                    environment=dev, received=self._5_min_ago, started=self._5_min_ago
                ),
                self.build_session(
                    environment=prod, received=self._5_min_ago, started=self._5_min_ago
                ),
                self.build_session(
                    environment=dev, received=self._30_min_ago, started=self._30_min_ago
                ),
                # ignored in p1
                # ignored env
                self.build_session(
                    environment=test, received=self._30_min_ago, started=self._30_min_ago
                ),
                # too old
                self.build_session(environment=prod, received=self._3_h_ago, started=self._3_h_ago),
                # counted in p2
                self.build_session(
                    environment=dev,
                    received=self._5_min_ago,
                    project_id=project_2.id,
                    started=self._5_min_ago,
                ),
                # ignored in p2
                # ignored env
                self.build_session(
                    environment=test,
                    received=self._5_min_ago,
                    project_id=project_2.id,
                    started=self._5_min_ago,
                ),
                # too old
                self.build_session(
                    environment=prod,
                    received=self._3_h_ago,
                    project_id=project_2.id,
                    started=self._3_h_ago,
                ),
                # ignored p3
                self.build_session(
                    environment=dev,
                    received=self._5_min_ago,
                    project_id=project_3.id,
                    started=self._5_min_ago,
                ),
            ]
        )

        actual = self.backend.get_num_sessions_per_project(
            project_ids=[project_1.id, project_2.id],
            environment_ids=[dev_env.id, prod_env.id],
            start=self._2_h_ago_dt,
            end=self.now_dt,
        )

        assert set(actual) == {(project_1.id, 3), (project_2.id, 1)}

        eids_tests: tuple[list[int] | None, ...] = ([], None)
        for eids in eids_tests:
            actual = self.backend.get_num_sessions_per_project(
                project_ids=[project_1.id, project_2.id],
                environment_ids=eids,
                start=self._2_h_ago_dt,
                end=self.now_dt,
            )

            assert set(actual) == {(project_1.id, 4), (project_2.id, 2)}


class InitWithoutUserTestCase(TestCase, ReleaseHealthBaseTestCase):
    backend = MetricsReleaseHealthBackend()

    def test_get_release_adoption(self) -> None:
        self.bulk_store_sessions(self.create_sessions__v1())

        data = self.backend.get_release_adoption(
            [
                (self.project.id, release_v1_0_0),
            ]
        )
        inner = data[(self.project.id, release_v1_0_0)]
        assert inner["users_24h"] == 3

    def test_get_release_health_data_overview_users(self) -> None:
        self.bulk_store_sessions(self.create_sessions__v1())

        data = self.backend.get_release_health_data_overview(
            [
                (self.project.id, release_v1_0_0),
            ],
            summary_stats_period="24h",
            health_stats_period="24h",
            stat="users",
        )

        inner = data[(self.project.id, release_v1_0_0)]
        assert inner["total_users"] == 3
        assert inner["crash_free_users"] == 66.66666666666667

    def test_get_crash_free_breakdown(self) -> None:
        self.bulk_store_sessions(self.create_sessions__v1())

        start = timezone.now() - timedelta(days=4)
        data = self.backend.get_crash_free_breakdown(
            project_id=self.project.id,
            release=release_v1_0_0,
            start=start,
            environments=["prod"],
        )

        # Last returned date is generated within function, should be close to now:
        last_date = data[-1]["date"]

        assert timezone.now() - last_date < timedelta(seconds=1)

        assert data == [
            {
                "crash_free_sessions": None,
                "crash_free_users": None,
                "date": start + timedelta(days=1),
                "total_sessions": 0,
                "total_users": 0,
            },
            {
                "crash_free_sessions": None,
                "crash_free_users": None,
                "date": start + timedelta(days=2),
                "total_sessions": 0,
                "total_users": 0,
            },
            {
                "crash_free_sessions": 66.66666666666667,
                "crash_free_users": 66.66666666666667,
                "total_sessions": 3,
                "total_users": 3,
                "date": mock.ANY,  # tested above
            },
        ]

    def test_get_project_release_stats_users(self) -> None:
        self.bulk_store_sessions(self.create_sessions__v1())

        end = timezone.now()
        start = end - timedelta(days=4)
        stats, totals = self.backend.get_project_release_stats(
            self.project.id,
            release=release_v1_0_0,
            stat="users",
            rollup=86400,
            start=start,
            end=end,
        )

        assert stats[3][1] == {
            "duration_p50": 60.0,
            "duration_p90": 60.0,
            "users_abnormal": 0,
            "users_crashed": 1,
            "users_errored": 0,
            "users_healthy": 2,
            "users_unhandled": 0,
            "users": 3,
        }
