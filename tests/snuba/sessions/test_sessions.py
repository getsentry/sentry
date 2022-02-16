import time
from datetime import datetime, timedelta

import pytz
from django.utils import timezone

from sentry.release_health.base import OverviewStat
from sentry.release_health.duplex import DuplexReleaseHealthBackend
from sentry.release_health.metrics import MetricsReleaseHealthBackend
from sentry.release_health.sessions import SessionsReleaseHealthBackend
from sentry.snuba.sessions import _make_stats
from sentry.testutils import SnubaTestCase, TestCase
from sentry.testutils.cases import SessionMetricsTestCase
from sentry.utils.dates import to_timestamp


def parametrize_backend(cls):
    """
    hack to parametrize test-classes by backend. Ideally we'd move
    over to pytest-style tests so we can use `pytest.mark.parametrize`, but
    hopefully we won't have more than one backend in the future.
    """

    assert not hasattr(cls, "backend")
    cls.backend = SessionsReleaseHealthBackend()

    class MetricsTest(SessionMetricsTestCase, cls):
        __doc__ = f"Repeat tests from {cls} with metrics"
        backend = MetricsReleaseHealthBackend()

    MetricsTest.__name__ = f"{cls.__name__}Metrics"

    globals()[MetricsTest.__name__] = MetricsTest

    class DuplexTest(cls):
        __doc__ = f"Repeat tests from {cls} with duplex backend"
        backend = DuplexReleaseHealthBackend(
            metrics_start=datetime.now(pytz.utc) - timedelta(days=120)
        )

    DuplexTest.__name__ = f"{cls.__name__}Duplex"

    globals()[DuplexTest.__name__] = DuplexTest

    return cls


def format_timestamp(dt):
    if not isinstance(dt, datetime):
        dt = datetime.utcfromtimestamp(dt)
    return dt.strftime("%Y-%m-%dT%H:%M:%S+00:00")


def make_24h_stats(ts):
    return _make_stats(datetime.utcfromtimestamp(ts).replace(tzinfo=pytz.utc), 3600, 24)


@parametrize_backend
class SnubaSessionsTest(TestCase, SnubaTestCase):
    def setUp(self):
        super().setUp()
        self.received = time.time()
        self.session_started = time.time() // 60 * 60
        self.session_release = "foo@1.0.0"
        self.session_crashed_release = "foo@2.0.0"
        session_1 = "5d52fd05-fcc9-4bf3-9dc9-267783670341"
        session_2 = "5e910c1a-6941-460e-9843-24103fb6a63c"
        session_3 = "a148c0c5-06a2-423b-8901-6b43b812cf82"
        user_1 = "39887d89-13b2-4c84-8c23-5d13d2102666"

        self.store_session(
            self.build_session(
                distinct_id=user_1,
                session_id=session_1,
                status="exited",
                release=self.session_release,
                environment="prod",
                started=self.session_started,
                received=self.received,
            )
        )
        self.store_session(
            self.build_session(
                distinct_id=user_1,
                session_id=session_2,
                release=self.session_release,
                environment="prod",
                duration=None,
                started=self.session_started,
                received=self.received,
            )
        )
        self.store_session(
            self.build_session(
                distinct_id=user_1,
                session_id=session_2,
                seq=1,
                duration=30,
                status="exited",
                release=self.session_release,
                environment="prod",
                started=self.session_started,
                received=self.received,
            )
        )
        self.store_session(
            self.build_session(
                distinct_id=user_1,
                session_id=session_3,
                status="crashed",
                release=self.session_crashed_release,
                environment="prod",
                started=self.session_started,
                received=self.received,
            )
        )

    def test_get_oldest_health_data_for_releases(self):
        data = self.backend.get_oldest_health_data_for_releases(
            [(self.project.id, self.session_release)]
        )
        assert data == {
            (self.project.id, self.session_release): format_timestamp(
                self.session_started // 3600 * 3600
            )
        }

    def test_check_has_health_data(self):
        data = self.backend.check_has_health_data(
            [(self.project.id, self.session_release), (self.project.id, "dummy-release")]
        )
        assert data == {(self.project.id, self.session_release)}

    def test_check_has_health_data_without_releases_should_exclude_sessions_gt_90_days(self):
        """
        Test that ensures that `check_has_health_data` returns a set of projects that has health
        data within the last 90d if only a list of project ids is provided and that any project
        with session data older than 90 days should be exluded
        """
        project2 = self.create_project(
            name="Bar2",
            slug="bar2",
            teams=[self.team],
            fire_project_created=True,
            organization=self.organization,
        )

        date_100_days_ago = to_timestamp(
            (datetime.utcnow() - timedelta(days=100)).replace(tzinfo=pytz.utc)
        )
        self.store_session(
            self.build_session(
                **{
                    "started": date_100_days_ago // 60 * 60,
                    "received": date_100_days_ago,
                    "project_id": project2.id,
                    "org_id": project2.organization_id,
                    "status": "exited",
                }
            )
        )
        data = self.backend.check_has_health_data([self.project.id, project2.id])
        assert data == {self.project.id}

    def test_check_has_health_data_without_releases_should_include_sessions_lte_90_days(self):
        """
        Test that ensures that `check_has_health_data` returns a set of projects that has health
        data within the last 90d if only a list of project ids is provided and any project with
        session data earlier than 90 days should be included
        """
        project2 = self.create_project(
            name="Bar2",
            slug="bar2",
            teams=[self.team],
            fire_project_created=True,
            organization=self.organization,
        )
        self.store_session(
            self.build_session(
                **{
                    "project_id": project2.id,
                    "org_id": project2.organization_id,
                    "status": "exited",
                }
            )
        )
        data = self.backend.check_has_health_data([self.project.id, project2.id])
        assert data == {self.project.id, project2.id}

    def test_check_has_health_data_does_not_crash_when_sending_projects_list_as_set(self):
        data = self.backend.check_has_health_data({self.project.id})
        assert data == {self.project.id}

    def test_get_project_releases_by_stability(self):
        # Add an extra session with a different `distinct_id` so that sorting by users
        # is stable
        self.store_session(
            self.build_session(
                release=self.session_release,
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
                (self.project.id, self.session_release),
                (self.project.id, self.session_crashed_release),
            ]

    def test_get_project_releases_by_stability_for_crash_free_sort(self):
        """
        Test that ensures that using crash free rate sort options, returns a list of ASC releases
        according to the chosen crash_free sort option
        """

        # add another user to session_release to make sure that they are sorted correctly
        self.store_session(
            self.build_session(
                status="exited",
                release=self.session_release,
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
                (self.project.id, self.session_crashed_release),
                (self.project.id, self.session_release),
            ]

    def test_get_project_releases_by_stability_for_releases_with_users_data(self):
        """
        Test that ensures if releases contain no users data, then those releases should not be
        returned on `users` and `crash_free_users` sorts
        """
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
            (self.project.id, self.session_release),
            (self.project.id, self.session_crashed_release),
        }

        data = self.backend.get_project_releases_by_stability(
            [self.project.id], offset=0, limit=100, scope="crash_free_users", stats_period="24h"
        )
        assert set(data) == {
            (self.project.id, self.session_crashed_release),
            (self.project.id, self.session_release),
        }

    def test_get_release_adoption(self):
        data = self.backend.get_release_adoption(
            [
                (self.project.id, self.session_release),
                (self.project.id, self.session_crashed_release),
                (self.project.id, "dummy-release"),
            ]
        )

        assert data == {
            (self.project.id, self.session_release): {
                "sessions_24h": 2,
                "users_24h": 1,
                "adoption": 100.0,
                "sessions_adoption": 66.66666666666666,
                "project_sessions_24h": 3,
                "project_users_24h": 1,
            },
            (self.project.id, self.session_crashed_release): {
                "sessions_24h": 1,
                "users_24h": 1,
                "adoption": 100.0,
                "sessions_adoption": 33.33333333333333,
                "project_sessions_24h": 3,
                "project_users_24h": 1,
            },
        }

    def test_get_release_adoption_lowered(self):
        self.store_session(
            self.build_session(
                release=self.session_crashed_release,
                environment="prod",
                status="crashed",
                started=self.session_started,
                received=self.received,
            )
        )

        data = self.backend.get_release_adoption(
            [
                (self.project.id, self.session_release),
                (self.project.id, self.session_crashed_release),
                (self.project.id, "dummy-release"),
            ]
        )

        assert data == {
            (self.project.id, self.session_release): {
                "sessions_24h": 2,
                "users_24h": 1,
                "adoption": 50.0,
                "sessions_adoption": 50.0,
                "project_sessions_24h": 4,
                "project_users_24h": 2,
            },
            (self.project.id, self.session_crashed_release): {
                "sessions_24h": 2,
                "users_24h": 2,
                "adoption": 100.0,
                "sessions_adoption": 50.0,
                "project_sessions_24h": 4,
                "project_users_24h": 2,
            },
        }

    def test_get_release_health_data_overview_users(self):
        data = self.backend.get_release_health_data_overview(
            [
                (self.project.id, self.session_release),
                (self.project.id, self.session_crashed_release),
            ],
            summary_stats_period="24h",
            health_stats_period="24h",
            stat="users",
        )

        stats = make_24h_stats(self.received - (24 * 3600))
        stats[-1] = [stats[-1][0], 1]
        stats_ok = stats_crash = stats

        assert data == {
            (self.project.id, self.session_crashed_release): {
                "total_sessions": 1,
                "sessions_errored": 0,
                "total_sessions_24h": 1,
                "total_users": 1,
                "duration_p90": None,
                "sessions_crashed": 1,
                "total_users_24h": 1,
                "stats": {"24h": stats_crash},
                "crash_free_users": 0.0,
                "adoption": 100.0,
                "sessions_adoption": 33.33333333333333,
                "has_health_data": True,
                "crash_free_sessions": 0.0,
                "duration_p50": None,
                "total_project_sessions_24h": 3,
                "total_project_users_24h": 1,
            },
            (self.project.id, self.session_release): {
                "total_sessions": 2,
                "sessions_errored": 0,
                "total_sessions_24h": 2,
                "total_users": 1,
                "duration_p90": 57.0,
                "sessions_crashed": 0,
                "total_users_24h": 1,
                "stats": {"24h": stats_ok},
                "crash_free_users": 100.0,
                "adoption": 100.0,
                "sessions_adoption": 66.66666666666666,
                "has_health_data": True,
                "crash_free_sessions": 100.0,
                "duration_p50": 45.0,
                "total_project_sessions_24h": 3,
                "total_project_users_24h": 1,
            },
        }

    def test_get_release_health_data_overview_sessions(self):
        data = self.backend.get_release_health_data_overview(
            [
                (self.project.id, self.session_release),
                (self.project.id, self.session_crashed_release),
            ],
            summary_stats_period="24h",
            health_stats_period="24h",
            stat="sessions",
        )

        stats = make_24h_stats(self.received - (24 * 3600))

        stats_ok = stats[:-1] + [[stats[-1][0], 2]]
        stats_crash = stats[:-1] + [[stats[-1][0], 1]]

        assert data == {
            (self.project.id, self.session_crashed_release): {
                "total_sessions": 1,
                "sessions_errored": 0,
                "total_sessions_24h": 1,
                "total_users": 1,
                "duration_p90": None,
                "sessions_crashed": 1,
                "total_users_24h": 1,
                "stats": {"24h": stats_crash},
                "crash_free_users": 0.0,
                "adoption": 100.0,
                "sessions_adoption": 33.33333333333333,
                "has_health_data": True,
                "crash_free_sessions": 0.0,
                "duration_p50": None,
                "total_project_sessions_24h": 3,
                "total_project_users_24h": 1,
            },
            (self.project.id, self.session_release): {
                "total_sessions": 2,
                "sessions_errored": 0,
                "total_sessions_24h": 2,
                "total_users": 1,
                "duration_p90": 57.0,
                "sessions_crashed": 0,
                "total_users_24h": 1,
                "stats": {"24h": stats_ok},
                "crash_free_users": 100.0,
                "sessions_adoption": 66.66666666666666,
                "adoption": 100.0,
                "has_health_data": True,
                "crash_free_sessions": 100.0,
                "duration_p50": 45.0,
                "total_project_sessions_24h": 3,
                "total_project_users_24h": 1,
            },
        }

    def test_fetching_release_sessions_time_bounds_for_different_release(self):
        """
        Test that ensures only session bounds for releases are calculated according
        to their respective release
        """
        # Same release session
        self.store_session(
            self.build_session(
                release=self.session_release,
                environment="prod",
                status="exited",
                started=self.session_started - 3600 * 2,
                received=self.received - 3600 * 2,
            )
        )

        # Different release session
        self.store_session(
            self.build_session(
                release=self.session_crashed_release,
                environment="prod",
                status="crashed",
                started=self.session_started - 3600 * 2,
                received=self.received - 3600 * 2,
            )
        )

        expected_formatted_lower_bound = (
            datetime.utcfromtimestamp(self.session_started - 3600 * 2)
            .replace(minute=0)
            .isoformat()[:19]
            + "Z"
        )

        expected_formatted_upper_bound = (
            datetime.utcfromtimestamp(self.session_started).replace(minute=0).isoformat()[:19] + "Z"
        )

        # Test for self.session_release
        data = self.backend.get_release_sessions_time_bounds(
            project_id=self.project.id,
            release=self.session_release,
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
            release=self.session_crashed_release,
            org_id=self.organization.id,
            environments=["prod"],
        )
        assert data == {
            "sessions_lower_bound": expected_formatted_lower_bound,
            "sessions_upper_bound": expected_formatted_upper_bound,
        }

    def test_fetching_release_sessions_time_bounds_for_different_release_with_no_sessions(self):
        """
        Test that ensures if no sessions are available for a specific release then the bounds
        should be returned as None
        """
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

    def test_get_crash_free_breakdown(self):
        start = timezone.now() - timedelta(days=4)
        data = self.backend.get_crash_free_breakdown(
            project_id=self.project.id,
            release=self.session_release,
            start=start,
            environments=["prod"],
        )

        # Last returned date is generated within function, should be close to now:
        last_date = data[-1].pop("date")
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
                "crash_free_sessions": 100.0,
                "crash_free_users": 100.0,
                "total_sessions": 2,
                "total_users": 1,
            },
        ]

        data = self.backend.get_crash_free_breakdown(
            project_id=self.project.id,
            release=self.session_crashed_release,
            start=start,
            environments=["prod"],
        )
        data[-1].pop("date")
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
                "crash_free_sessions": 0.0,
                "crash_free_users": 0.0,
                "total_sessions": 1,
                "total_users": 1,
            },
        ]
        data = self.backend.get_crash_free_breakdown(
            project_id=self.project.id,
            release="non-existing",
            start=start,
            environments=["prod"],
        )
        data[-1].pop("date")
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
                "crash_free_sessions": None,
                "crash_free_users": None,
                "total_sessions": 0,
                "total_users": 0,
            },
        ]

    def test_basic_release_model_adoptions(self):
        """
        Test that the basic (project,release) data is returned
        """
        proj_id = self.project.id
        data = self.backend.get_changed_project_release_model_adoptions([proj_id])
        assert set(data) == {(proj_id, "foo@1.0.0"), (proj_id, "foo@2.0.0")}

    def test_old_release_model_adoptions(self):
        """
        Test that old entries (older that 72 h) are not returned
        """
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

    def test_multi_proj_release_model_adoptions(self):
        """Test that the api works with multiple projects"""
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

    @staticmethod
    def _add_timestamps_to_series(series, start: datetime):
        one_day = 24 * 60 * 60
        day0 = one_day * int(start.timestamp() / one_day)

        def ts(days: int) -> int:
            return day0 + days * one_day

        return [[ts(i + 1), data] for i, data in enumerate(series)]

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

        # Let's not care about lists vs. tuples:
        stats = [[ts, data] for ts, data in stats]

        assert stats == self._add_timestamps_to_series(expected_series, start)
        assert totals == expected_totals

    def test_get_project_release_stats_users(self):
        self._test_get_project_release_stats(
            "users",
            self.session_release,
            [
                {
                    "duration_p50": None,
                    "duration_p90": None,
                    "users": 0,
                    "users_abnormal": 0,
                    "users_crashed": 0,
                    "users_errored": 0,
                    "users_healthy": 0,
                },
                {
                    "duration_p50": None,
                    "duration_p90": None,
                    "users": 0,
                    "users_abnormal": 0,
                    "users_crashed": 0,
                    "users_errored": 0,
                    "users_healthy": 0,
                },
                {
                    "duration_p50": None,
                    "duration_p90": None,
                    "users": 0,
                    "users_abnormal": 0,
                    "users_crashed": 0,
                    "users_errored": 0,
                    "users_healthy": 0,
                },
                {
                    "duration_p50": 45.0,
                    "duration_p90": 57.0,
                    "users": 1,
                    "users_abnormal": 0,
                    "users_crashed": 0,
                    "users_errored": 0,
                    "users_healthy": 1,
                },
            ],
            {
                "users": 1,
                "users_abnormal": 0,
                "users_crashed": 0,
                "users_errored": 0,
                "users_healthy": 1,
            },
        )

    def test_get_project_release_stats_users_crashed(self):
        self._test_get_project_release_stats(
            "users",
            self.session_crashed_release,
            [
                {
                    "duration_p50": None,
                    "duration_p90": None,
                    "users": 0,
                    "users_abnormal": 0,
                    "users_crashed": 0,
                    "users_errored": 0,
                    "users_healthy": 0,
                },
                {
                    "duration_p50": None,
                    "duration_p90": None,
                    "users": 0,
                    "users_abnormal": 0,
                    "users_crashed": 0,
                    "users_errored": 0,
                    "users_healthy": 0,
                },
                {
                    "duration_p50": None,
                    "duration_p90": None,
                    "users": 0,
                    "users_abnormal": 0,
                    "users_crashed": 0,
                    "users_errored": 0,
                    "users_healthy": 0,
                },
                {
                    "duration_p50": None,
                    "duration_p90": None,
                    "users": 1,
                    "users_abnormal": 0,
                    "users_crashed": 1,
                    "users_errored": 0,
                    "users_healthy": 0,
                },
            ],
            {
                "users": 1,
                "users_abnormal": 0,
                "users_crashed": 1,
                "users_errored": 0,
                "users_healthy": 0,
            },
        )

    def test_get_project_release_stats_sessions(self):
        self._test_get_project_release_stats(
            "sessions",
            self.session_release,
            [
                {
                    "duration_p50": None,
                    "duration_p90": None,
                    "sessions": 0,
                    "sessions_abnormal": 0,
                    "sessions_crashed": 0,
                    "sessions_errored": 0,
                    "sessions_healthy": 0,
                },
                {
                    "duration_p50": None,
                    "duration_p90": None,
                    "sessions": 0,
                    "sessions_abnormal": 0,
                    "sessions_crashed": 0,
                    "sessions_errored": 0,
                    "sessions_healthy": 0,
                },
                {
                    "duration_p50": None,
                    "duration_p90": None,
                    "sessions": 0,
                    "sessions_abnormal": 0,
                    "sessions_crashed": 0,
                    "sessions_errored": 0,
                    "sessions_healthy": 0,
                },
                {
                    "duration_p50": 45.0,
                    "duration_p90": 57.0,
                    "sessions": 2,
                    "sessions_abnormal": 0,
                    "sessions_crashed": 0,
                    "sessions_errored": 0,
                    "sessions_healthy": 2,
                },
            ],
            {
                "sessions": 2,
                "sessions_abnormal": 0,
                "sessions_crashed": 0,
                "sessions_errored": 0,
                "sessions_healthy": 2,
            },
        )

    def test_get_project_release_stats_sessions_crashed(self):
        self._test_get_project_release_stats(
            "sessions",
            self.session_crashed_release,
            [
                {
                    "duration_p50": None,
                    "duration_p90": None,
                    "sessions": 0,
                    "sessions_abnormal": 0,
                    "sessions_crashed": 0,
                    "sessions_errored": 0,
                    "sessions_healthy": 0,
                },
                {
                    "duration_p50": None,
                    "duration_p90": None,
                    "sessions": 0,
                    "sessions_abnormal": 0,
                    "sessions_crashed": 0,
                    "sessions_errored": 0,
                    "sessions_healthy": 0,
                },
                {
                    "duration_p50": None,
                    "duration_p90": None,
                    "sessions": 0,
                    "sessions_abnormal": 0,
                    "sessions_crashed": 0,
                    "sessions_errored": 0,
                    "sessions_healthy": 0,
                },
                {
                    "duration_p50": None,
                    "duration_p90": None,
                    "sessions": 1,
                    "sessions_abnormal": 0,
                    "sessions_crashed": 1,
                    "sessions_errored": 0,
                    "sessions_healthy": 0,
                },
            ],
            {
                "sessions": 1,
                "sessions_abnormal": 0,
                "sessions_crashed": 1,
                "sessions_errored": 0,
                "sessions_healthy": 0,
            },
        )


@parametrize_backend
class GetCrashFreeRateTestCase(TestCase, SnubaTestCase):
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

    def setUp(self):
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

    def test_get_current_and_previous_crash_free_rates(self):
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

    def test_get_current_and_previous_crash_free_rates_with_zero_sessions(self):
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


@parametrize_backend
class GetProjectReleasesCountTest(TestCase, SnubaTestCase):
    def test_empty(self):
        # Test no errors when no session data
        org = self.create_organization()
        proj = self.create_project(organization=org)
        assert (
            self.backend.get_project_releases_count(
                org.id, [proj.id], "crash_free_users", stats_period="14d"
            )
            == 0
        )

    def test(self):
        project_release_1 = self.create_release(self.project)
        other_project = self.create_project()
        other_project_release_1 = self.create_release(other_project)
        self.bulk_store_sessions(
            [
                self.build_session(
                    environment=self.environment.name, release=project_release_1.version
                ),
                self.build_session(
                    environment="staging",
                    project_id=other_project.id,
                    release=other_project_release_1.version,
                ),
            ]
        )
        assert (
            self.backend.get_project_releases_count(
                self.organization.id, [self.project.id], "sessions"
            )
            == 1
        )
        assert (
            self.backend.get_project_releases_count(
                self.organization.id, [self.project.id], "users"
            )
            == 1
        )
        assert (
            self.backend.get_project_releases_count(
                self.organization.id, [self.project.id, other_project.id], "sessions"
            )
            == 2
        )
        assert (
            self.backend.get_project_releases_count(
                self.organization.id,
                [self.project.id, other_project.id],
                "users",
            )
            == 2
        )
        assert (
            self.backend.get_project_releases_count(
                self.organization.id,
                [self.project.id, other_project.id],
                "sessions",
                environments=[self.environment.name],
            )
            == 1
        )


@parametrize_backend
class CheckReleasesHaveHealthDataTest(TestCase, SnubaTestCase):
    def run_test(self, expected, projects, releases, start=None, end=None):
        if not start:
            start = datetime.now() - timedelta(days=1)
        if not end:
            end = datetime.now()
        assert (
            self.backend.check_releases_have_health_data(
                self.organization.id,
                [p.id for p in projects],
                [r.version for r in releases],
                start,
                end,
            )
            == {v.version for v in expected}
        )

    def test_empty(self):
        # Test no errors when no session data
        project_release_1 = self.create_release(self.project)
        self.run_test([], [self.project], [project_release_1])

    def test(self):
        other_project = self.create_project()
        release_1 = self.create_release(
            self.project, version="1", additional_projects=[other_project]
        )
        release_2 = self.create_release(other_project, version="2")
        self.bulk_store_sessions(
            [
                self.build_session(release=release_1),
                self.build_session(project_id=other_project, release=release_1),
                self.build_session(project_id=other_project, release=release_2),
            ]
        )
        self.run_test([release_1], [self.project], [release_1])
        self.run_test([release_1], [self.project], [release_1, release_2])
        self.run_test([release_1], [other_project], [release_1])
        self.run_test([release_1, release_2], [other_project], [release_1, release_2])
        self.run_test([release_1, release_2], [self.project, other_project], [release_1, release_2])


@parametrize_backend
class CheckNumberOfSessions(TestCase, SnubaTestCase):
    def setUp(self):
        super().setUp()
        self.dev_env = self.create_environment(name="development", project=self.project)
        self.prod_env = self.create_environment(name="production", project=self.project)
        self.test_env = self.create_environment(name="test", project=self.project)
        self.another_project = self.create_project()
        self.third_project = self.create_project()

        self.now_dt = datetime(2000, 3, 20, 17, 40, 0)
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

    def test_no_sessions(self):
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

    def test_sessions_in_environment(self):
        """
        Tests that it correctly picks up the sessions for the selected environment
        in the selected time, not counting other environments and other times

        """

        dev = self.dev_env.name
        prod = self.prod_env.name

        self.bulk_store_sessions(
            [
                self.build_session(
                    environment=dev, received=self._5_min_ago, started=self._5_min_ago
                ),
                self.build_session(
                    environment=prod, received=self._5_min_ago, started=self._5_min_ago
                ),
                self.build_session(
                    environment=prod, received=self._5_min_ago, started=self._5_min_ago
                ),
                self.build_session(environment=prod, received=self._2_h_ago, started=self._2_h_ago),
            ]
        )

        actual = self.backend.get_project_sessions_count(
            project_id=self.project.id,
            environment_id=self.prod_env.id,
            rollup=60,
            start=self._1_h_ago_dt,
            end=self.now_dt,
        )

        assert actual == 2

    def test_sessions_in_all_environments(self):
        """
        When the environment is not specified sessions from all environments are counted
        """
        dev = self.dev_env.name
        prod = self.prod_env.name

        self.bulk_store_sessions(
            [
                self.build_session(
                    environment=dev, received=self._5_min_ago, started=self._5_min_ago
                ),
                self.build_session(
                    environment=prod, received=self._5_min_ago, started=self._5_min_ago
                ),
                self.build_session(
                    environment=prod, received=self._5_min_ago, started=self._5_min_ago
                ),
                self.build_session(environment=prod, received=self._2_h_ago, started=self._2_h_ago),
                self.build_session(environment=dev, received=self._2_h_ago, started=self._2_h_ago),
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

    def test_sessions_from_multiple_projects(self):
        """
        Only sessions from the specified project are considered
        """
        dev = self.dev_env.name
        prod = self.prod_env.name

        self.bulk_store_sessions(
            [
                self.build_session(
                    environment=dev, received=self._5_min_ago, started=self._5_min_ago
                ),
                self.build_session(
                    environment=prod, received=self._5_min_ago, started=self._5_min_ago
                ),
                self.build_session(
                    environment=prod,
                    received=self._5_min_ago,
                    project_id=self.another_project.id,
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

    def test_sessions_per_project_no_sessions(self):
        """
        Tests that no sessions are returned
        """
        actual = self.backend.get_num_sessions_per_project(
            project_ids=[self.project.id, self.another_project.id],
            environment_ids=None,
            rollup=60,
            start=self._30_min_ago_dt,
            end=self.now_dt,
        )
        assert [] == actual

    def test_sesions_per_project_multiple_projects(self):
        dev = self.dev_env.name
        prod = self.prod_env.name
        test = self.test_env.name
        p1 = self.project
        p2 = self.another_project
        p3 = self.third_project

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
                    project_id=p2.id,
                    started=self._5_min_ago,
                ),
                # ignored in p2
                # ignored env
                self.build_session(
                    environment=test,
                    received=self._5_min_ago,
                    project_id=p2.id,
                    started=self._5_min_ago,
                ),
                # too old
                self.build_session(
                    environment=prod,
                    received=self._3_h_ago,
                    project_id=p2.id,
                    started=self._3_h_ago,
                ),
                # ignored p3
                self.build_session(
                    environment=dev,
                    received=self._5_min_ago,
                    project_id=p3.id,
                    started=self._5_min_ago,
                ),
            ]
        )

        actual = self.backend.get_num_sessions_per_project(
            project_ids=[self.project.id, self.another_project.id],
            environment_ids=[self.dev_env.id, self.prod_env.id],
            rollup=60,
            start=self._2_h_ago_dt,
            end=self.now_dt,
        )

        assert set(actual) == {(p1.id, 3), (p2.id, 1)}

        for eids in ([], None):
            actual = self.backend.get_num_sessions_per_project(
                project_ids=[self.project.id, self.another_project.id],
                environment_ids=eids,
                rollup=60,
                start=self._2_h_ago_dt,
                end=self.now_dt,
            )

            assert set(actual) == {(p1.id, 4), (p2.id, 2)}
