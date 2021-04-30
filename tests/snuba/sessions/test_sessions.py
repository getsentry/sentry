import time
from datetime import datetime

import pytz

from sentry.snuba.sessions import (
    _make_stats,
    check_has_health_data,
    get_adjacent_releases_based_on_adoption,
    get_oldest_health_data_for_releases,
    get_project_releases_by_stability,
    get_release_adoption,
    get_release_health_data_overview,
    get_release_sessions_time_bounds,
)
from sentry.testutils import SnubaTestCase, TestCase


def format_timestamp(dt):
    if not isinstance(dt, datetime):
        dt = datetime.utcfromtimestamp(dt)
    return dt.strftime("%Y-%m-%dT%H:%M:%S+00:00")


def make_24h_stats(ts):
    return _make_stats(datetime.utcfromtimestamp(ts).replace(tzinfo=pytz.utc), 3600, 24)


class SnubaSessionsTest(TestCase, SnubaTestCase):
    def setUp(self):
        super().setUp()
        self.received = time.time()
        self.session_started = time.time() // 60 * 60
        self.session_release = "foo@1.0.0"
        self.session_crashed_release = "foo@2.0.0"
        self.store_session(
            {
                "session_id": "5d52fd05-fcc9-4bf3-9dc9-267783670341",
                "distinct_id": "39887d89-13b2-4c84-8c23-5d13d2102666",
                "status": "exited",
                "seq": 0,
                "release": self.session_release,
                "environment": "prod",
                "retention_days": 90,
                "org_id": self.project.organization_id,
                "project_id": self.project.id,
                "duration": 60.0,
                "errors": 0,
                "started": self.session_started,
                "received": self.received,
            }
        )

        self.store_session(
            {
                "session_id": "5e910c1a-6941-460e-9843-24103fb6a63c",
                "distinct_id": "39887d89-13b2-4c84-8c23-5d13d2102666",
                "status": "ok",
                "seq": 0,
                "release": self.session_release,
                "environment": "prod",
                "retention_days": 90,
                "org_id": self.project.organization_id,
                "project_id": self.project.id,
                "duration": None,
                "errors": 0,
                "started": self.session_started,
                "received": self.received,
            }
        )

        self.store_session(
            {
                "session_id": "5e910c1a-6941-460e-9843-24103fb6a63c",
                "distinct_id": "39887d89-13b2-4c84-8c23-5d13d2102666",
                "status": "exited",
                "seq": 1,
                "release": self.session_release,
                "environment": "prod",
                "retention_days": 90,
                "org_id": self.project.organization_id,
                "project_id": self.project.id,
                "duration": 30.0,
                "errors": 0,
                "started": self.session_started,
                "received": self.received,
            }
        )

        self.store_session(
            {
                "session_id": "a148c0c5-06a2-423b-8901-6b43b812cf82",
                "distinct_id": "39887d89-13b2-4c84-8c23-5d13d2102666",
                "status": "crashed",
                "seq": 0,
                "release": self.session_crashed_release,
                "environment": "prod",
                "retention_days": 90,
                "org_id": self.project.organization_id,
                "project_id": self.project.id,
                "duration": 60.0,
                "errors": 0,
                "started": self.session_started,
                "received": self.received,
            }
        )

    def test_get_oldest_health_data_for_releases(self):
        data = get_oldest_health_data_for_releases([(self.project.id, self.session_release)])
        assert data == {
            (self.project.id, self.session_release): format_timestamp(
                self.session_started // 3600 * 3600
            )
        }

    def test_check_has_health_data(self):
        data = check_has_health_data(
            [(self.project.id, self.session_release), (self.project.id, "dummy-release")]
        )
        assert data == {(self.project.id, self.session_release)}

    def test_get_project_releases_by_stability(self):
        # Add an extra session with a different `distinct_id` so that sorting by users
        # is stable
        self.store_session(
            {
                "session_id": "5e910c1a-6941-460e-9843-24103fb6a63c",
                "distinct_id": "39887d89-13b2-4c84-8c23-5d13d2102665",
                "status": "ok",
                "seq": 0,
                "release": self.session_release,
                "environment": "prod",
                "retention_days": 90,
                "org_id": self.project.organization_id,
                "project_id": self.project.id,
                "duration": None,
                "errors": 0,
                "started": self.session_started,
                "received": self.received,
            }
        )

        for scope in "sessions", "users":
            data = get_project_releases_by_stability(
                [self.project.id], offset=0, limit=100, scope=scope, stats_period="24h"
            )

            assert data == [
                (self.project.id, self.session_release),
                (self.project.id, self.session_crashed_release),
            ]

    def test_get_release_adoption(self):
        data = get_release_adoption(
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
            {
                "session_id": "4574c381-acc5-4e05-b10b-f16cdc2f385a",
                "distinct_id": "da50f094-10b4-40fb-89fb-cb3aa9014148",
                "status": "crashed",
                "seq": 0,
                "release": self.session_crashed_release,
                "environment": "prod",
                "retention_days": 90,
                "org_id": self.project.organization_id,
                "project_id": self.project.id,
                "duration": 60.0,
                "errors": 0,
                "started": self.session_started,
                "received": self.received,
            }
        )

        data = get_release_adoption(
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
        data = get_release_health_data_overview(
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
        data = get_release_health_data_overview(
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
            {
                "session_id": "5e910c1a-6941-460e-9843-24103fb6a63c",
                "distinct_id": "39887d89-13b2-4c84-8c23-5d13d2102666",
                "status": "exited",
                "seq": 1,
                "release": self.session_release,
                "environment": "prod",
                "retention_days": 90,
                "org_id": self.project.organization_id,
                "project_id": self.project.id,
                "duration": 30.0,
                "errors": 0,
                "started": self.session_started - 3600 * 2,
                "received": self.received - 3600 * 2,
            }
        )
        # Different release session
        self.store_session(
            {
                "session_id": "a148c0c5-06a2-423b-8901-6b43b812cf82",
                "distinct_id": "39887d89-13b2-4c84-8c23-5d13d2102666",
                "status": "crashed",
                "seq": 0,
                "release": self.session_crashed_release,
                "environment": "prod",
                "retention_days": 90,
                "org_id": self.project.organization_id,
                "project_id": self.project.id,
                "duration": 60.0,
                "errors": 0,
                "started": self.session_started - 3600 * 2,
                "received": self.received - 3600 * 2,
            }
        )

        expected_formatted_lower_bound = format_timestamp(
            datetime.utcfromtimestamp(self.session_started - 3600 * 2).replace(minute=0)
        )
        expected_formatted_upper_bound = format_timestamp(
            datetime.utcfromtimestamp(self.session_started).replace(minute=0)
        )

        # Test for self.session_release
        data = get_release_sessions_time_bounds(
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
        data = get_release_sessions_time_bounds(
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
        data = get_release_sessions_time_bounds(
            project_id=self.project.id,
            release="different_release",
            org_id=self.organization.id,
            environments=["prod"],
        )
        assert data == {
            "sessions_lower_bound": None,
            "sessions_upper_bound": None,
        }


class SnubaReleaseDetailPaginationOnSessionsTest(TestCase, SnubaTestCase):
    """
    TestClass that tests getting the previous and next release to a specific release
    based on the `sessions` sort ordering

    Summary of what the releases list order should look like:-
    In Env -> prod & start_stats -> 24h
        foobar@3.0.0 (3 sessions)
        foobar@4.0.0 (3 sessions)
        foobar@2.0.0 (2 sessions)
        foobar@1.0.0 (1 sessions)

    In Env -> prod & stats_start -> 7d
        foobar@1.0.0 (3 sessions)
        foobar@3.0.0 (3 sessions)
        foobar@4.0.0 (3 sessions)
        foobar@2.0.0 (2 sessions)

    In Env -> test & stats_start -> 24h
        foobar@1.0.0 (1 session)
    """

    def setUp(self):
        super().setUp()
        self.received = time.time()
        self.session_started = time.time() // 60 * 60
        self.session_started_gt_24h = self.session_started - 25 * 60 * 60
        self.session_release_1 = "foobar@1.0.0"
        self.session_release_2 = "foobar@2.0.0"
        self.session_release_3 = "foobar@3.0.0"
        self.session_release_4 = "foobar@4.0.0"

        # Release: foobar@1.0.0

        # Env: prod
        # Time: < 24h
        # Total: 1 Session
        self.store_session(
            {
                "session_id": "5d52fd05-fcc9-4bf3-9dc9-267783670341",
                "distinct_id": "39887d89-13b2-4c84-8c23-5d13d2102666",
                "status": "exited",
                "seq": 0,
                "release": self.session_release_1,
                "environment": "prod",
                "retention_days": 90,
                "org_id": self.project.organization_id,
                "project_id": self.project.id,
                "duration": 60.0,
                "errors": 0,
                "started": self.session_started,
                "received": self.received,
            }
        )

        # Env: prod
        # Time: > 24h but < 14 days
        # Total: 2 sessions
        self.store_session(
            {
                "session_id": "d3fc506a-b87e-11eb-8529-0242ac130003",
                "distinct_id": "39887d89-13b2-4c84-8c23-5d13d2102666",
                "status": "exited",
                "seq": 0,
                "release": self.session_release_1,
                "environment": "prod",
                "retention_days": 90,
                "org_id": self.project.organization_id,
                "project_id": self.project.id,
                "duration": 60.0,
                "errors": 0,
                "started": self.session_started_gt_24h,
                "received": self.received,
            }
        )
        self.store_session(
            {
                "session_id": "e1ea448e-b87e-11eb-8529-0242ac130003",
                "distinct_id": "39887d89-13b2-4c84-8c23-5d13d2102666",
                "status": "exited",
                "seq": 0,
                "release": self.session_release_1,
                "environment": "prod",
                "retention_days": 90,
                "org_id": self.project.organization_id,
                "project_id": self.project.id,
                "duration": 60.0,
                "errors": 0,
                "started": self.session_started_gt_24h,
                "received": self.received,
            }
        )
        # Env: test
        # Time: < 24h
        # Total: 1 Session
        self.store_session(
            {
                "session_id": "138fe748-b8aa-11eb-8529-0242ac130003",
                "distinct_id": "39887d89-13b2-4c84-8c23-5d13d2102666",
                "status": "exited",
                "seq": 0,
                "release": self.session_release_1,
                "environment": "test",
                "retention_days": 90,
                "org_id": self.project.organization_id,
                "project_id": self.project.id,
                "duration": 60.0,
                "errors": 0,
                "started": self.session_started,
                "received": self.received,
            }
        )

        # Release: foobar@2.0.0
        # Env: prod
        # Time: < 24h
        # Total: 2 Sessions
        self.store_session(
            {
                "session_id": "5e910c1a-6941-460e-9843-24103fb6a63c",
                "distinct_id": "39887d89-13b2-4c84-8c23-5d13d2102666",
                "status": "ok",
                "seq": 0,
                "release": self.session_release_2,
                "environment": "prod",
                "retention_days": 90,
                "org_id": self.project.organization_id,
                "project_id": self.project.id,
                "duration": None,
                "errors": 0,
                "started": self.session_started,
                "received": self.received,
            }
        )
        self.store_session(
            {
                "session_id": "5e910c1a-6941-460e-9843-24103fb6a63c",
                "distinct_id": "39887d89-13b2-4c84-8c23-5d13d2102666",
                "status": "exited",
                "seq": 1,
                "release": self.session_release_2,
                "environment": "prod",
                "retention_days": 90,
                "org_id": self.project.organization_id,
                "project_id": self.project.id,
                "duration": 30.0,
                "errors": 0,
                "started": self.session_started,
                "received": self.received,
            }
        )
        self.store_session(
            {
                "session_id": "c9574ab4-b7c7-11eb-8529-0242ac130003",
                "distinct_id": "39887d89-13b2-4c84-8c23-5d13d2102666",
                "status": "exited",
                "seq": 0,
                "release": self.session_release_2,
                "environment": "prod",
                "retention_days": 90,
                "org_id": self.project.organization_id,
                "project_id": self.project.id,
                "duration": 30.0,
                "errors": 0,
                "started": self.session_started,
                "received": self.received,
            }
        )

        # Release: foobar@3.0.0
        # Env: prod
        # Time: <24h
        # Total: 3 Session
        self.store_session(
            {
                "session_id": "a148c0c5-06a2-423b-8901-6b43b812cf82",
                "distinct_id": "39887d89-13b2-4c84-8c23-5d13d2102666",
                "status": "exited",
                "seq": 0,
                "release": self.session_release_3,
                "environment": "prod",
                "retention_days": 90,
                "org_id": self.project.organization_id,
                "project_id": self.project.id,
                "duration": 60.0,
                "errors": 0,
                "started": self.session_started,
                "received": self.received,
            }
        )
        self.store_session(
            {
                "session_id": "a11d2540-b7c3-11eb-8529-0242ac130003",
                "distinct_id": "39887d89-13b2-4c84-8c23-5d13d2102666",
                "status": "exited",
                "seq": 0,
                "release": self.session_release_3,
                "environment": "prod",
                "retention_days": 90,
                "org_id": self.project.organization_id,
                "project_id": self.project.id,
                "duration": 60.0,
                "errors": 0,
                "started": self.session_started,
                "received": self.received,
            }
        )
        self.store_session(
            {
                "session_id": "c14be4d2-b7c3-11eb-8529-0242ac130003",
                "distinct_id": "39887d89-13b2-4c84-8c23-5d13d2102666",
                "status": "exited",
                "seq": 0,
                "release": self.session_release_3,
                "environment": "prod",
                "retention_days": 90,
                "org_id": self.project.organization_id,
                "project_id": self.project.id,
                "duration": 60.0,
                "errors": 0,
                "started": self.session_started,
                "received": self.received,
            }
        )

        # Release: foobar@4.0.0
        # Env: prod
        # Time: <24h
        # Total: 3 Sessions
        self.store_session(
            {
                "session_id": "9fceb1b2-b7c9-11eb-8529-0242ac130003",
                "distinct_id": "39887d89-13b2-4c84-8c23-5d13d2102666",
                "status": "exited",
                "seq": 0,
                "release": self.session_release_4,
                "environment": "prod",
                "retention_days": 90,
                "org_id": self.project.organization_id,
                "project_id": self.project.id,
                "duration": 60.0,
                "errors": 0,
                "started": self.session_started,
                "received": self.received,
            }
        )
        self.store_session(
            {
                "session_id": "afed2b00-b7c9-11eb-8529-0242ac130003",
                "distinct_id": "39887d89-13b2-4c84-8c23-5d13d2102666",
                "status": "exited",
                "seq": 0,
                "release": self.session_release_4,
                "environment": "prod",
                "retention_days": 90,
                "org_id": self.project.organization_id,
                "project_id": self.project.id,
                "duration": 60.0,
                "errors": 0,
                "started": self.session_started,
                "received": self.received,
            }
        )
        self.store_session(
            {
                "session_id": "bc146952-b7c9-11eb-8529-0242ac130003",
                "distinct_id": "39887d89-13b2-4c84-8c23-5d13d2102666",
                "status": "exited",
                "seq": 0,
                "release": self.session_release_4,
                "environment": "prod",
                "retention_days": 90,
                "org_id": self.project.organization_id,
                "project_id": self.project.id,
                "duration": 60.0,
                "errors": 0,
                "started": self.session_started,
                "received": self.received,
            }
        )

    def test_get_adjacent_releases_to_last_release_on_sessions_ordering(self):
        adjacent_releases = get_adjacent_releases_based_on_adoption(
            project_id=self.project.id,
            org_id=self.project.organization_id,
            release="foobar@1.0.0",
            environments=["prod"],
            scope="sessions",
        )
        assert adjacent_releases == {
            "next_releases_list": [],
            "prev_releases_list": ["foobar@2.0.0", "foobar@4.0.0", "foobar@3.0.0"],
        }

    def test_get_adjacent_releases_to_first_release_on_sessions_ordering(self):
        adjacent_releases = get_adjacent_releases_based_on_adoption(
            project_id=self.project.id,
            org_id=self.project.organization_id,
            release="foobar@3.0.0",
            environments=["prod"],
            scope="sessions",
        )
        assert adjacent_releases == {
            "next_releases_list": ["foobar@4.0.0", "foobar@2.0.0", "foobar@1.0.0"],
            "prev_releases_list": [],
        }

    def test_get_adjacent_releases_to_middle_release_on_sessions_ordering(self):
        adjacent_releases = get_adjacent_releases_based_on_adoption(
            project_id=self.project.id,
            org_id=self.project.organization_id,
            release="foobar@2.0.0",
            environments=["prod"],
            scope="sessions",
        )
        assert adjacent_releases == {
            "next_releases_list": ["foobar@1.0.0"],
            "prev_releases_list": ["foobar@4.0.0", "foobar@3.0.0"],
        }

    def test_get_adjacent_releases_to_middle_release_with_same_sessions_count_on_sessions_ordering(
        self,
    ):
        """
        Test that ensures that releases with the same session count are disambiguated according to asc ordering
        of release version
        example -> Same session count releases
        foobar@
        """
        adjacent_releases = get_adjacent_releases_based_on_adoption(
            project_id=self.project.id,
            org_id=self.project.organization_id,
            release="foobar@4.0.0",
            environments=["prod"],
            scope="sessions",
        )
        assert adjacent_releases == {
            "next_releases_list": ["foobar@2.0.0", "foobar@1.0.0"],
            "prev_releases_list": ["foobar@3.0.0"],
        }

    def test_get_adjacent_releases_to_middle_release_for_stats_period_7d_on_sessions_ordering(self):
        adjacent_releases = get_adjacent_releases_based_on_adoption(
            project_id=self.project.id,
            org_id=self.project.organization_id,
            release="foobar@3.0.0",
            stats_period="7d",
            environments=["prod"],
            scope="sessions",
        )
        assert adjacent_releases == {
            "next_releases_list": ["foobar@4.0.0", "foobar@2.0.0"],
            "prev_releases_list": ["foobar@1.0.0"],
        }
        adjacent_releases = get_adjacent_releases_based_on_adoption(
            project_id=self.project.id,
            org_id=self.project.organization_id,
            release="foobar@1.0.0",
            stats_period="7d",
            environments=["prod"],
            scope="sessions",
        )
        assert adjacent_releases == {
            "next_releases_list": ["foobar@3.0.0", "foobar@4.0.0", "foobar@2.0.0"],
            "prev_releases_list": [],
        }

    def test_get_adjacent_releases_when_current_release_is_not_found_on_sessions_ordering(self):
        adjacent_releases = get_adjacent_releases_based_on_adoption(
            project_id=self.project.id,
            org_id=self.project.organization_id,
            release="foobar@1.0.0",
            environments=["test-whatever"],
            scope="sessions",
        )
        assert adjacent_releases == {"next_releases_list": [], "prev_releases_list": []}

    def test_get_adjacent_releases_to_last_release_in_different_env_on_sessions_ordering(self):
        adjacent_releases = get_adjacent_releases_based_on_adoption(
            project_id=self.project.id,
            org_id=self.project.organization_id,
            release="foobar@1.0.0",
            environments=["test"],
            scope="sessions",
        )
        assert adjacent_releases == {"next_releases_list": [], "prev_releases_list": []}


class SnubaReleaseDetailPaginationOnCrashFreeSessionsTest(TestCase, SnubaTestCase):
    """
    TestClass that tests getting the previous and next releases to a specific release
    based on the `crash_free_sessions` sort ordering

    Summary of what the releases list order should look like:-
    In Env -> prod & start_stats -> 24h
        foobar@1.0.0 (1 session: 1 healthy - 100% Crash free)
        foobar@3.0.0 (3 sessions: 2 healthy + 1 crashed - 66.666% Crash free)
        foobar@4.0.0 (2 sessions: 2 healthy + 1 crashed - 66.666% Crash free)
        foobar@2.0.0 (1 session: 1 crashed - 0% Crash free)

    In Env -> prod & stats_start -> 7d
        foobar@3.0.0 (3 sessions: 2 healthy + 1 crashed - 66.666% Crash free)
        foobar@4.0.0 (3 sessions: 2 healthy + 1 crashed - 66.666% Crash free)
        foobar@1.0.0 (3 sessions: 1 healthy + 2 crashed - 33.333% Crash free)
        foobar@2.0.0 (1 sessions: 1 crashed - 0% Crash free)

    In Env -> test & stats_start -> 24h
        foobar@1.0.0 (1 session: 1 crashed - 0% Crash Free)
    """

    def setUp(self):
        super().setUp()
        self.received = time.time()
        self.session_started = time.time() // 60 * 60
        self.session_started_gt_24h = self.session_started - 25 * 60 * 60
        self.session_release_1 = "foobar@1.0.0"
        self.session_release_2 = "foobar@2.0.0"
        self.session_release_3 = "foobar@3.0.0"
        self.session_release_4 = "foobar@4.0.0"
        self.session_crashed_release = "foobar@2.0.0"

        # Release: foobar@1.0.0

        # Env: prod
        # Time: < 24h
        # Total: 1 Session -> 100% Crash Free
        self.store_session(
            {
                "session_id": "5d52fd05-fcc9-4bf3-9dc9-267783670341",
                "distinct_id": "39887d89-13b2-4c84-8c23-5d13d2102666",
                "status": "exited",
                "seq": 0,
                "release": self.session_release_1,
                "environment": "prod",
                "retention_days": 90,
                "org_id": self.project.organization_id,
                "project_id": self.project.id,
                "duration": 60.0,
                "errors": 0,
                "started": self.session_started,
                "received": self.received,
            }
        )

        # Env: prod
        # Time: > 24h but < 14 days
        # Total: 3 sessions -> 1 Healthy + 2 Crashed -> 33.3333% Crash Free
        self.store_session(
            {
                "session_id": "d3fc506a-b87e-11eb-8529-0242ac130003",
                "distinct_id": "39887d89-13b2-4c84-8c23-5d13d2102666",
                "status": "crashed",
                "seq": 0,
                "release": self.session_release_1,
                "environment": "prod",
                "retention_days": 90,
                "org_id": self.project.organization_id,
                "project_id": self.project.id,
                "duration": 60.0,
                "errors": 0,
                "started": self.session_started_gt_24h,
                "received": self.received,
            }
        )
        self.store_session(
            {
                "session_id": "e1ea448e-b87e-11eb-8529-0242ac130003",
                "distinct_id": "39887d89-13b2-4c84-8c23-5d13d2102666",
                "status": "crashed",
                "seq": 0,
                "release": self.session_release_1,
                "environment": "prod",
                "retention_days": 90,
                "org_id": self.project.organization_id,
                "project_id": self.project.id,
                "duration": 60.0,
                "errors": 0,
                "started": self.session_started_gt_24h,
                "received": self.received,
            }
        )
        # Env: test
        # Time: < 24h
        # Total: 1 Session -> 0% Crash Free
        self.store_session(
            {
                "session_id": "138fe748-b8aa-11eb-8529-0242ac130003",
                "distinct_id": "39887d89-13b2-4c84-8c23-5d13d2102666",
                "status": "crashed",
                "seq": 0,
                "release": self.session_release_1,
                "environment": "test",
                "retention_days": 90,
                "org_id": self.project.organization_id,
                "project_id": self.project.id,
                "duration": 60.0,
                "errors": 0,
                "started": self.session_started,
                "received": self.received,
            }
        )

        # Release: foobar@2.0.0
        # Env: prod
        # Time: < 24h
        # Total: 2 Sessions -> 2 Crashed -> 0% Crash free
        self.store_session(
            {
                "session_id": "5e910c1a-6941-460e-9843-24103fb6a63c",
                "distinct_id": "39887d89-13b2-4c84-8c23-5d13d2102666",
                "status": "ok",
                "seq": 0,
                "release": self.session_release_2,
                "environment": "prod",
                "retention_days": 90,
                "org_id": self.project.organization_id,
                "project_id": self.project.id,
                "duration": None,
                "errors": 0,
                "started": self.session_started,
                "received": self.received,
            }
        )
        self.store_session(
            {
                "session_id": "5e910c1a-6941-460e-9843-24103fb6a63c",
                "distinct_id": "39887d89-13b2-4c84-8c23-5d13d2102666",
                "status": "crashed",
                "seq": 1,
                "release": self.session_release_2,
                "environment": "prod",
                "retention_days": 90,
                "org_id": self.project.organization_id,
                "project_id": self.project.id,
                "duration": 30.0,
                "errors": 0,
                "started": self.session_started,
                "received": self.received,
            }
        )
        self.store_session(
            {
                "session_id": "c9574ab4-b7c7-11eb-8529-0242ac130003",
                "distinct_id": "39887d89-13b2-4c84-8c23-5d13d2102666",
                "status": "crashed",
                "seq": 0,
                "release": self.session_release_2,
                "environment": "prod",
                "retention_days": 90,
                "org_id": self.project.organization_id,
                "project_id": self.project.id,
                "duration": 30.0,
                "errors": 0,
                "started": self.session_started,
                "received": self.received,
            }
        )

        # Release: foobar@3.0.0
        # Env: prod
        # Time: <24h
        # Total: 3 Session -> 2 Healthy + 1 Crashed -> 66.666% Crash free
        self.store_session(
            {
                "session_id": "a148c0c5-06a2-423b-8901-6b43b812cf82",
                "distinct_id": "39887d89-13b2-4c84-8c23-5d13d2102666",
                "status": "crashed",
                "seq": 0,
                "release": self.session_release_3,
                "environment": "prod",
                "retention_days": 90,
                "org_id": self.project.organization_id,
                "project_id": self.project.id,
                "duration": 60.0,
                "errors": 0,
                "started": self.session_started,
                "received": self.received,
            }
        )
        self.store_session(
            {
                "session_id": "a11d2540-b7c3-11eb-8529-0242ac130003",
                "distinct_id": "39887d89-13b2-4c84-8c23-5d13d2102666",
                "status": "exited",
                "seq": 0,
                "release": self.session_release_3,
                "environment": "prod",
                "retention_days": 90,
                "org_id": self.project.organization_id,
                "project_id": self.project.id,
                "duration": 60.0,
                "errors": 0,
                "started": self.session_started,
                "received": self.received,
            }
        )
        self.store_session(
            {
                "session_id": "c14be4d2-b7c3-11eb-8529-0242ac130003",
                "distinct_id": "39887d89-13b2-4c84-8c23-5d13d2102666",
                "status": "exited",
                "seq": 0,
                "release": self.session_release_3,
                "environment": "prod",
                "retention_days": 90,
                "org_id": self.project.organization_id,
                "project_id": self.project.id,
                "duration": 60.0,
                "errors": 0,
                "started": self.session_started,
                "received": self.received,
            }
        )

        # Release: foobar@4.0.0
        # Env: prod
        # Time: <24h
        # Total: 3 Sessions -> 2 Healthy + 1 Crashed -> 66.666% Crash free
        self.store_session(
            {
                "session_id": "9fceb1b2-b7c9-11eb-8529-0242ac130003",
                "distinct_id": "39887d89-13b2-4c84-8c23-5d13d2102666",
                "status": "crashed",
                "seq": 0,
                "release": self.session_release_4,
                "environment": "prod",
                "retention_days": 90,
                "org_id": self.project.organization_id,
                "project_id": self.project.id,
                "duration": 60.0,
                "errors": 0,
                "started": self.session_started,
                "received": self.received,
            }
        )
        self.store_session(
            {
                "session_id": "afed2b00-b7c9-11eb-8529-0242ac130003",
                "distinct_id": "39887d89-13b2-4c84-8c23-5d13d2102666",
                "status": "exited",
                "seq": 0,
                "release": self.session_release_4,
                "environment": "prod",
                "retention_days": 90,
                "org_id": self.project.organization_id,
                "project_id": self.project.id,
                "duration": 60.0,
                "errors": 0,
                "started": self.session_started,
                "received": self.received,
            }
        )
        self.store_session(
            {
                "session_id": "bc146952-b7c9-11eb-8529-0242ac130003",
                "distinct_id": "39887d89-13b2-4c84-8c23-5d13d2102666",
                "status": "exited",
                "seq": 0,
                "release": self.session_release_4,
                "environment": "prod",
                "retention_days": 90,
                "org_id": self.project.organization_id,
                "project_id": self.project.id,
                "duration": 60.0,
                "errors": 0,
                "started": self.session_started,
                "received": self.received,
            }
        )

    def test_get_adjacent_releases_to_last_release_on_crash_free_sessions_ordering(self):
        adjacent_releases = get_adjacent_releases_based_on_adoption(
            project_id=self.project.id,
            org_id=self.project.organization_id,
            release="foobar@2.0.0",
            environments=["prod"],
            scope="crash_free_sessions",
        )
        assert adjacent_releases == {
            "next_releases_list": [],
            "prev_releases_list": ["foobar@4.0.0", "foobar@3.0.0", "foobar@1.0.0"],
        }

    def test_get_adjacent_releases_to_first_release_on_crash_free_sessions_ordering(self):
        adjacent_releases = get_adjacent_releases_based_on_adoption(
            project_id=self.project.id,
            org_id=self.project.organization_id,
            release="foobar@1.0.0",
            environments=["prod"],
            scope="crash_free_sessions",
        )
        assert adjacent_releases == {
            "next_releases_list": ["foobar@3.0.0", "foobar@4.0.0", "foobar@2.0.0"],
            "prev_releases_list": [],
        }

    def test_get_adjacent_releases_to_middle_release_on_crash_free_sessions_ordering(self):
        adjacent_releases = get_adjacent_releases_based_on_adoption(
            project_id=self.project.id,
            org_id=self.project.organization_id,
            release="foobar@3.0.0",
            environments=["prod"],
            scope="crash_free_sessions",
        )
        assert adjacent_releases == {
            "next_releases_list": ["foobar@4.0.0", "foobar@2.0.0"],
            "prev_releases_list": ["foobar@1.0.0"],
        }

    def test_get_adjacent_releases_to_middle_release_with_same_crash_free_sessions_percentage(self):
        adjacent_releases = get_adjacent_releases_based_on_adoption(
            project_id=self.project.id,
            org_id=self.project.organization_id,
            release="foobar@4.0.0",
            environments=["prod"],
            scope="crash_free_sessions",
        )
        assert adjacent_releases == {
            "next_releases_list": ["foobar@2.0.0"],
            "prev_releases_list": ["foobar@3.0.0", "foobar@1.0.0"],
        }

    def test_get_adjacent_releases_to_middle_release_for_stats_period_7d_on_crash_free_sessions(
        self,
    ):
        adjacent_releases = get_adjacent_releases_based_on_adoption(
            project_id=self.project.id,
            org_id=self.project.organization_id,
            release="foobar@3.0.0",
            stats_period="7d",
            environments=["prod"],
            scope="crash_free_sessions",
        )
        assert adjacent_releases == {
            "next_releases_list": ["foobar@4.0.0", "foobar@1.0.0", "foobar@2.0.0"],
            "prev_releases_list": [],
        }
        adjacent_releases = get_adjacent_releases_based_on_adoption(
            project_id=self.project.id,
            org_id=self.project.organization_id,
            release="foobar@4.0.0",
            stats_period="7d",
            environments=["prod"],
            scope="crash_free_sessions",
        )
        assert adjacent_releases == {
            "next_releases_list": ["foobar@1.0.0", "foobar@2.0.0"],
            "prev_releases_list": ["foobar@3.0.0"],
        }

    def test_get_adjacent_releases_when_current_release_is_not_found_on_crash_free_sessions(self):
        adjacent_releases = get_adjacent_releases_based_on_adoption(
            project_id=self.project.id,
            org_id=self.project.organization_id,
            release="foobar@1.0.0",
            environments=["test-whatever"],
            scope="crash_free_sessions",
        )
        assert adjacent_releases == {"next_releases_list": [], "prev_releases_list": []}

    def test_get_adjacent_releases_to_last_release_on_crash_free_sessions_ordering_in_different_env(
        self,
    ):
        adjacent_releases = get_adjacent_releases_based_on_adoption(
            project_id=self.project.id,
            org_id=self.project.organization_id,
            release="foobar@1.0.0",
            environments=["test"],
            scope="crash_free_sessions",
        )
        assert adjacent_releases == {"next_releases_list": [], "prev_releases_list": []}


class SnubaReleaseDetailPaginationOnUsersTest(TestCase, SnubaTestCase):
    """
    TestClass that tests getting the previous and next releases to a specific release
    based on the `users` sort ordering

    Summary of what the releases list order should look like:-
    In Env -> prod & start_stats -> 24h
        foobar@3.0.0 (3 sessions: 3 distinct ids)
        foobar@4.0.0 (3 sessions: 3 distinct ids)
        foobar@2.0.0 (2 sessions: 2 distinct ids)
        foobar@1.0.0 (1 sessions: 1 distinct id)

    In Env -> prod & stats_start -> 7d
        foobar@1.0.0 (3 sessions: 3 distinct ids)
        foobar@3.0.0 (3 sessions: 3 distinct ids)
        foobar@4.0.0 (3 sessions: 3 distinct ids)
        foobar@2.0.0 (2 sessions: 2 distinct ids)

    In Env -> test & stats_start -> 24h
        foobar@1.0.0 (1 session: 1 distinct id)
    """

    def setUp(self):
        super().setUp()
        self.received = time.time()
        self.session_started = time.time() // 60 * 60
        self.session_started_gt_24h = self.session_started - 25 * 60 * 60
        self.session_release_1 = "foobar@1.0.0"
        self.session_release_2 = "foobar@2.0.0"
        self.session_release_3 = "foobar@3.0.0"
        self.session_release_4 = "foobar@4.0.0"

        # Release: foobar@1.0.0

        # Env: prod
        # Time: < 24h
        # Total: 1 Session
        self.store_session(
            {
                "session_id": "5d52fd05-fcc9-4bf3-9dc9-267783670341",
                "distinct_id": "39887d89-13b2-4c84-8c23-5d13d2102666",
                "status": "exited",
                "seq": 0,
                "release": self.session_release_1,
                "environment": "prod",
                "retention_days": 90,
                "org_id": self.project.organization_id,
                "project_id": self.project.id,
                "duration": 60.0,
                "errors": 0,
                "started": self.session_started,
                "received": self.received,
            }
        )

        # Env: prod
        # Time: > 24h but < 14 days
        # Total: 2 sessions
        self.store_session(
            {
                "session_id": "d3fc506a-b87e-11eb-8529-0242ac130003",
                "distinct_id": "00021a1e-b97e-11eb-8529-0242ac130003",
                "status": "exited",
                "seq": 0,
                "release": self.session_release_1,
                "environment": "prod",
                "retention_days": 90,
                "org_id": self.project.organization_id,
                "project_id": self.project.id,
                "duration": 60.0,
                "errors": 0,
                "started": self.session_started_gt_24h,
                "received": self.received,
            }
        )
        self.store_session(
            {
                "session_id": "e1ea448e-b87e-11eb-8529-0242ac130003",
                "distinct_id": "00021c4e-b97e-11eb-8529-0242ac130003",
                "status": "exited",
                "seq": 0,
                "release": self.session_release_1,
                "environment": "prod",
                "retention_days": 90,
                "org_id": self.project.organization_id,
                "project_id": self.project.id,
                "duration": 60.0,
                "errors": 0,
                "started": self.session_started_gt_24h,
                "received": self.received,
            }
        )
        # Env: test
        # Time: < 24h
        # Total: 1 Session
        self.store_session(
            {
                "session_id": "138fe748-b8aa-11eb-8529-0242ac130003",
                "distinct_id": "00021d3e-b97e-11eb-8529-0242ac130003",
                "status": "exited",
                "seq": 0,
                "release": self.session_release_1,
                "environment": "test",
                "retention_days": 90,
                "org_id": self.project.organization_id,
                "project_id": self.project.id,
                "duration": 60.0,
                "errors": 0,
                "started": self.session_started,
                "received": self.received,
            }
        )

        # Release: foobar@2.0.0
        # Env: prod
        # Time: < 24h
        # Total: 2 Sessions
        self.store_session(
            {
                "session_id": "5e910c1a-6941-460e-9843-24103fb6a63c",
                "distinct_id": "00021e06-b97e-11eb-8529-0242ac130003",
                "status": "ok",
                "seq": 0,
                "release": self.session_release_2,
                "environment": "prod",
                "retention_days": 90,
                "org_id": self.project.organization_id,
                "project_id": self.project.id,
                "duration": None,
                "errors": 0,
                "started": self.session_started,
                "received": self.received,
            }
        )
        self.store_session(
            {
                "session_id": "5e910c1a-6941-460e-9843-24103fb6a63c",
                "distinct_id": "00021e06-b97e-11eb-8529-0242ac130003",
                "status": "exited",
                "seq": 1,
                "release": self.session_release_2,
                "environment": "prod",
                "retention_days": 90,
                "org_id": self.project.organization_id,
                "project_id": self.project.id,
                "duration": 30.0,
                "errors": 0,
                "started": self.session_started,
                "received": self.received,
            }
        )
        self.store_session(
            {
                "session_id": "c9574ab4-b7c7-11eb-8529-0242ac130003",
                "distinct_id": "00021eba-b97e-11eb-8529-0242ac130003",
                "status": "exited",
                "seq": 0,
                "release": self.session_release_2,
                "environment": "prod",
                "retention_days": 90,
                "org_id": self.project.organization_id,
                "project_id": self.project.id,
                "duration": 30.0,
                "errors": 0,
                "started": self.session_started,
                "received": self.received,
            }
        )

        # Release: foobar@3.0.0
        # Env: prod
        # Time: <24h
        # Total: 3 Session
        self.store_session(
            {
                "session_id": "a148c0c5-06a2-423b-8901-6b43b812cf82",
                "distinct_id": "674f1a0a-b97e-11eb-8529-0242ac130003",
                "status": "exited",
                "seq": 0,
                "release": self.session_release_3,
                "environment": "prod",
                "retention_days": 90,
                "org_id": self.project.organization_id,
                "project_id": self.project.id,
                "duration": 60.0,
                "errors": 0,
                "started": self.session_started,
                "received": self.received,
            }
        )
        self.store_session(
            {
                "session_id": "a11d2540-b7c3-11eb-8529-0242ac130003",
                "distinct_id": "674f1eec-b97e-11eb-8529-0242ac130003",
                "status": "exited",
                "seq": 0,
                "release": self.session_release_3,
                "environment": "prod",
                "retention_days": 90,
                "org_id": self.project.organization_id,
                "project_id": self.project.id,
                "duration": 60.0,
                "errors": 0,
                "started": self.session_started,
                "received": self.received,
            }
        )
        self.store_session(
            {
                "session_id": "c14be4d2-b7c3-11eb-8529-0242ac130003",
                "distinct_id": "674f1fe6-b97e-11eb-8529-0242ac130003",
                "status": "exited",
                "seq": 0,
                "release": self.session_release_3,
                "environment": "prod",
                "retention_days": 90,
                "org_id": self.project.organization_id,
                "project_id": self.project.id,
                "duration": 60.0,
                "errors": 0,
                "started": self.session_started,
                "received": self.received,
            }
        )

        # Release: foobar@4.0.0
        # Env: prod
        # Time: <24h
        # Total: 3 Sessions
        self.store_session(
            {
                "session_id": "9fceb1b2-b7c9-11eb-8529-0242ac130003",
                "distinct_id": "674f20ae-b97e-11eb-8529-0242ac130003",
                "status": "exited",
                "seq": 0,
                "release": self.session_release_4,
                "environment": "prod",
                "retention_days": 90,
                "org_id": self.project.organization_id,
                "project_id": self.project.id,
                "duration": 60.0,
                "errors": 0,
                "started": self.session_started,
                "received": self.received,
            }
        )
        self.store_session(
            {
                "session_id": "afed2b00-b7c9-11eb-8529-0242ac130003",
                "distinct_id": "674f2162-b97e-11eb-8529-0242ac130003",
                "status": "exited",
                "seq": 0,
                "release": self.session_release_4,
                "environment": "prod",
                "retention_days": 90,
                "org_id": self.project.organization_id,
                "project_id": self.project.id,
                "duration": 60.0,
                "errors": 0,
                "started": self.session_started,
                "received": self.received,
            }
        )
        self.store_session(
            {
                "session_id": "bc146952-b7c9-11eb-8529-0242ac130003",
                "distinct_id": "923403fc-b97e-11eb-8529-0242ac130003",
                "status": "exited",
                "seq": 0,
                "release": self.session_release_4,
                "environment": "prod",
                "retention_days": 90,
                "org_id": self.project.organization_id,
                "project_id": self.project.id,
                "duration": 60.0,
                "errors": 0,
                "started": self.session_started,
                "received": self.received,
            }
        )

    def test_get_adjacent_releases_to_last_release_on_users_ordering(self):
        adjacent_releases = get_adjacent_releases_based_on_adoption(
            project_id=self.project.id,
            org_id=self.project.organization_id,
            release="foobar@1.0.0",
            environments=["prod"],
            scope="users",
        )
        assert adjacent_releases == {
            "next_releases_list": [],
            "prev_releases_list": ["foobar@2.0.0", "foobar@4.0.0", "foobar@3.0.0"],
        }

    def test_get_adjacent_releases_to_first_release_on_users_ordering(self):
        adjacent_releases = get_adjacent_releases_based_on_adoption(
            project_id=self.project.id,
            org_id=self.project.organization_id,
            release="foobar@3.0.0",
            environments=["prod"],
            scope="users",
        )
        assert adjacent_releases == {
            "next_releases_list": ["foobar@4.0.0", "foobar@2.0.0", "foobar@1.0.0"],
            "prev_releases_list": [],
        }

    def test_get_adjacent_releases_to_middle_release_on_users_ordering(self):
        adjacent_releases = get_adjacent_releases_based_on_adoption(
            project_id=self.project.id,
            org_id=self.project.organization_id,
            release="foobar@2.0.0",
            environments=["prod"],
            scope="users",
        )
        assert adjacent_releases == {
            "next_releases_list": ["foobar@1.0.0"],
            "prev_releases_list": ["foobar@4.0.0", "foobar@3.0.0"],
        }

    def test_get_adjacent_releases_to_middle_release_with_same_users_count_on_users_ordering(self):
        adjacent_releases = get_adjacent_releases_based_on_adoption(
            project_id=self.project.id,
            org_id=self.project.organization_id,
            release="foobar@4.0.0",
            environments=["prod"],
            scope="users",
        )
        assert adjacent_releases == {
            "next_releases_list": ["foobar@2.0.0", "foobar@1.0.0"],
            "prev_releases_list": ["foobar@3.0.0"],
        }

    def test_get_adjacent_releases_to_middle_release_for_stats_period_7d_on_users_ordering(self):
        adjacent_releases = get_adjacent_releases_based_on_adoption(
            project_id=self.project.id,
            org_id=self.project.organization_id,
            release="foobar@3.0.0",
            stats_period="7d",
            environments=["prod"],
            scope="users",
        )
        assert adjacent_releases == {
            "next_releases_list": ["foobar@4.0.0", "foobar@2.0.0"],
            "prev_releases_list": ["foobar@1.0.0"],
        }
        adjacent_releases = get_adjacent_releases_based_on_adoption(
            project_id=self.project.id,
            org_id=self.project.organization_id,
            release="foobar@1.0.0",
            stats_period="7d",
            environments=["prod"],
            scope="users",
        )
        assert adjacent_releases == {
            "next_releases_list": ["foobar@3.0.0", "foobar@4.0.0", "foobar@2.0.0"],
            "prev_releases_list": [],
        }

    def test_get_adjacent_releases_when_current_release_is_not_found_on_users_ordering(self):
        adjacent_releases = get_adjacent_releases_based_on_adoption(
            project_id=self.project.id,
            org_id=self.project.organization_id,
            release="foobar@1.0.0",
            environments=["test-whatever"],
            scope="users",
        )
        assert adjacent_releases == {"next_releases_list": [], "prev_releases_list": []}

    def test_get_adjacent_releases_to_last_release_in_different_env_on_users_ordering(self):
        adjacent_releases = get_adjacent_releases_based_on_adoption(
            project_id=self.project.id,
            org_id=self.project.organization_id,
            release="foobar@1.0.0",
            environments=["test"],
            scope="users",
        )
        assert adjacent_releases == {"next_releases_list": [], "prev_releases_list": []}


class SnubaReleaseDetailPaginationOnCrashFreeUsersTest(TestCase, SnubaTestCase):
    """
    TestClass that tests getting the previous and next releases to a specific release
    based on the `crash_free_users` sort ordering

    Summary of what the releases list order should look like:-
    In Env -> prod & start_stats -> 24h
        foobar@1.0.0 (1 session: 1 healthy - 100% Crash free)
        foobar@3.0.0 (3 sessions: 2 healthy + 1 crashed - 66.666% Crash free)
        foobar@4.0.0 (2 sessions: 2 healthy + 1 crashed - 66.666% Crash free)
        foobar@2.0.0 (1 session: 1 crashed - 0% Crash free)

    In Env -> prod & stats_start -> 7d
        foobar@3.0.0 (3 sessions: 2 healthy + 1 crashed - 66.666% Crash free)
        foobar@4.0.0 (3 sessions: 2 healthy + 1 crashed - 66.666% Crash free)
        foobar@1.0.0 (3 sessions: 1 healthy + 2 crashed - 33.333% Crash free)
        foobar@2.0.0 (1 sessions: 1 crashed - 0% Crash free)

    In Env -> test & stats_start -> 24h
        foobar@1.0.0 (1 session: 1 crashed - 0% Crash Free)
    """

    def setUp(self):
        super().setUp()
        self.received = time.time()
        self.session_started = time.time() // 60 * 60
        self.session_started_gt_24h = self.session_started - 25 * 60 * 60
        self.session_release_1 = "foobar@1.0.0"
        self.session_release_2 = "foobar@2.0.0"
        self.session_release_3 = "foobar@3.0.0"
        self.session_release_4 = "foobar@4.0.0"
        self.session_crashed_release = "foobar@2.0.0"

        # Release: foobar@1.0.0

        # Env: prod
        # Time: < 24h
        # Total: 1 Session -> 100% Crash Free
        self.store_session(
            {
                "session_id": "5d52fd05-fcc9-4bf3-9dc9-267783670341",
                "distinct_id": "39887d89-13b2-4c84-8c23-5d13d2102666",
                "status": "exited",
                "seq": 0,
                "release": self.session_release_1,
                "environment": "prod",
                "retention_days": 90,
                "org_id": self.project.organization_id,
                "project_id": self.project.id,
                "duration": 60.0,
                "errors": 0,
                "started": self.session_started,
                "received": self.received,
            }
        )

        # Env: prod
        # Time: > 24h but < 14 days
        # Total: 3 sessions -> 1 Healthy + 2 Crashed -> 33.3333% Crash Free
        self.store_session(
            {
                "session_id": "d3fc506a-b87e-11eb-8529-0242ac130003",
                "distinct_id": "42c96db0-b97f-11eb-8529-0242ac130003",
                "status": "crashed",
                "seq": 0,
                "release": self.session_release_1,
                "environment": "prod",
                "retention_days": 90,
                "org_id": self.project.organization_id,
                "project_id": self.project.id,
                "duration": 60.0,
                "errors": 0,
                "started": self.session_started_gt_24h,
                "received": self.received,
            }
        )
        self.store_session(
            {
                "session_id": "e1ea448e-b87e-11eb-8529-0242ac130003",
                "distinct_id": "42c96fe0-b97f-11eb-8529-0242ac130003",
                "status": "crashed",
                "seq": 0,
                "release": self.session_release_1,
                "environment": "prod",
                "retention_days": 90,
                "org_id": self.project.organization_id,
                "project_id": self.project.id,
                "duration": 60.0,
                "errors": 0,
                "started": self.session_started_gt_24h,
                "received": self.received,
            }
        )
        # Env: test
        # Time: < 24h
        # Total: 1 Session -> 0% Crash Free
        self.store_session(
            {
                "session_id": "138fe748-b8aa-11eb-8529-0242ac130003",
                "distinct_id": "42c970e4-b97f-11eb-8529-0242ac130003",
                "status": "crashed",
                "seq": 0,
                "release": self.session_release_1,
                "environment": "test",
                "retention_days": 90,
                "org_id": self.project.organization_id,
                "project_id": self.project.id,
                "duration": 60.0,
                "errors": 0,
                "started": self.session_started,
                "received": self.received,
            }
        )

        # Release: foobar@2.0.0
        # Env: prod
        # Time: < 24h
        # Total: 2 Sessions -> 2 Crashed -> 0% Crash free
        self.store_session(
            {
                "session_id": "5e910c1a-6941-460e-9843-24103fb6a63c",
                "distinct_id": "42c971ac-b97f-11eb-8529-0242ac130003",
                "status": "ok",
                "seq": 0,
                "release": self.session_release_2,
                "environment": "prod",
                "retention_days": 90,
                "org_id": self.project.organization_id,
                "project_id": self.project.id,
                "duration": None,
                "errors": 0,
                "started": self.session_started,
                "received": self.received,
            }
        )
        self.store_session(
            {
                "session_id": "5e910c1a-6941-460e-9843-24103fb6a63c",
                "distinct_id": "42c971ac-b97f-11eb-8529-0242ac130003",
                "status": "crashed",
                "seq": 1,
                "release": self.session_release_2,
                "environment": "prod",
                "retention_days": 90,
                "org_id": self.project.organization_id,
                "project_id": self.project.id,
                "duration": 30.0,
                "errors": 0,
                "started": self.session_started,
                "received": self.received,
            }
        )
        self.store_session(
            {
                "session_id": "c9574ab4-b7c7-11eb-8529-0242ac130003",
                "distinct_id": "42c974a4-b97f-11eb-8529-0242ac130003",
                "status": "crashed",
                "seq": 0,
                "release": self.session_release_2,
                "environment": "prod",
                "retention_days": 90,
                "org_id": self.project.organization_id,
                "project_id": self.project.id,
                "duration": 30.0,
                "errors": 0,
                "started": self.session_started,
                "received": self.received,
            }
        )

        # Release: foobar@3.0.0
        # Env: prod
        # Time: <24h
        # Total: 3 Session -> 2 Healthy + 1 Crashed -> 66.666% Crash free
        self.store_session(
            {
                "session_id": "a148c0c5-06a2-423b-8901-6b43b812cf82",
                "distinct_id": "42c9758a-b97f-11eb-8529-0242ac130003",
                "status": "crashed",
                "seq": 0,
                "release": self.session_release_3,
                "environment": "prod",
                "retention_days": 90,
                "org_id": self.project.organization_id,
                "project_id": self.project.id,
                "duration": 60.0,
                "errors": 0,
                "started": self.session_started,
                "received": self.received,
            }
        )
        self.store_session(
            {
                "session_id": "a11d2540-b7c3-11eb-8529-0242ac130003",
                "distinct_id": "42c97648-b97f-11eb-8529-0242ac130003",
                "status": "exited",
                "seq": 0,
                "release": self.session_release_3,
                "environment": "prod",
                "retention_days": 90,
                "org_id": self.project.organization_id,
                "project_id": self.project.id,
                "duration": 60.0,
                "errors": 0,
                "started": self.session_started,
                "received": self.received,
            }
        )
        self.store_session(
            {
                "session_id": "c14be4d2-b7c3-11eb-8529-0242ac130003",
                "distinct_id": "42c97706-b97f-11eb-8529-0242ac130003",
                "status": "exited",
                "seq": 0,
                "release": self.session_release_3,
                "environment": "prod",
                "retention_days": 90,
                "org_id": self.project.organization_id,
                "project_id": self.project.id,
                "duration": 60.0,
                "errors": 0,
                "started": self.session_started,
                "received": self.received,
            }
        )

        # Release: foobar@4.0.0
        # Env: prod
        # Time: <24h
        # Total: 3 Sessions -> 2 Healthy + 1 Crashed -> 66.666% Crash free
        self.store_session(
            {
                "session_id": "9fceb1b2-b7c9-11eb-8529-0242ac130003",
                "distinct_id": "8480ef08-b97f-11eb-8529-0242ac130003",
                "status": "crashed",
                "seq": 0,
                "release": self.session_release_4,
                "environment": "prod",
                "retention_days": 90,
                "org_id": self.project.organization_id,
                "project_id": self.project.id,
                "duration": 60.0,
                "errors": 0,
                "started": self.session_started,
                "received": self.received,
            }
        )
        self.store_session(
            {
                "session_id": "afed2b00-b7c9-11eb-8529-0242ac130003",
                "distinct_id": "8480f232-b97f-11eb-8529-0242ac130003",
                "status": "exited",
                "seq": 0,
                "release": self.session_release_4,
                "environment": "prod",
                "retention_days": 90,
                "org_id": self.project.organization_id,
                "project_id": self.project.id,
                "duration": 60.0,
                "errors": 0,
                "started": self.session_started,
                "received": self.received,
            }
        )
        self.store_session(
            {
                "session_id": "bc146952-b7c9-11eb-8529-0242ac130003",
                "distinct_id": "8480f3ae-b97f-11eb-8529-0242ac130003",
                "status": "exited",
                "seq": 0,
                "release": self.session_release_4,
                "environment": "prod",
                "retention_days": 90,
                "org_id": self.project.organization_id,
                "project_id": self.project.id,
                "duration": 60.0,
                "errors": 0,
                "started": self.session_started,
                "received": self.received,
            }
        )

    def test_get_adjacent_releases_to_last_release_on_crash_free_users_ordering(self):
        adjacent_releases = get_adjacent_releases_based_on_adoption(
            project_id=self.project.id,
            org_id=self.project.organization_id,
            release="foobar@2.0.0",
            environments=["prod"],
            scope="crash_free_users",
        )
        assert adjacent_releases == {
            "next_releases_list": [],
            "prev_releases_list": ["foobar@4.0.0", "foobar@3.0.0", "foobar@1.0.0"],
        }

    def test_get_adjacent_releases_to_first_release_on_crash_free_users_ordering(self):
        adjacent_releases = get_adjacent_releases_based_on_adoption(
            project_id=self.project.id,
            org_id=self.project.organization_id,
            release="foobar@1.0.0",
            environments=["prod"],
            scope="crash_free_users",
        )
        assert adjacent_releases == {
            "next_releases_list": ["foobar@3.0.0", "foobar@4.0.0", "foobar@2.0.0"],
            "prev_releases_list": [],
        }

    def test_get_adjacent_releases_to_middle_release_on_crash_free_users_ordering(self):
        adjacent_releases = get_adjacent_releases_based_on_adoption(
            project_id=self.project.id,
            org_id=self.project.organization_id,
            release="foobar@3.0.0",
            environments=["prod"],
            scope="crash_free_users",
        )
        assert adjacent_releases == {
            "next_releases_list": ["foobar@4.0.0", "foobar@2.0.0"],
            "prev_releases_list": ["foobar@1.0.0"],
        }

    def test_get_adjacent_releases_to_middle_release_with_same_crash_free_percentage_on_crash_free_users_ordering(
        self,
    ):
        adjacent_releases = get_adjacent_releases_based_on_adoption(
            project_id=self.project.id,
            org_id=self.project.organization_id,
            release="foobar@4.0.0",
            environments=["prod"],
            scope="crash_free_users",
        )
        assert adjacent_releases == {
            "next_releases_list": ["foobar@2.0.0"],
            "prev_releases_list": ["foobar@3.0.0", "foobar@1.0.0"],
        }

    def test_get_adjacent_releases_to_middle_release_for_stats_period_7d_on_crash_free_users_ordering(
        self,
    ):
        adjacent_releases = get_adjacent_releases_based_on_adoption(
            project_id=self.project.id,
            org_id=self.project.organization_id,
            release="foobar@3.0.0",
            stats_period="7d",
            environments=["prod"],
            scope="crash_free_users",
        )
        assert adjacent_releases == {
            "next_releases_list": ["foobar@4.0.0", "foobar@1.0.0", "foobar@2.0.0"],
            "prev_releases_list": [],
        }
        adjacent_releases = get_adjacent_releases_based_on_adoption(
            project_id=self.project.id,
            org_id=self.project.organization_id,
            release="foobar@4.0.0",
            stats_period="7d",
            environments=["prod"],
            scope="crash_free_users",
        )
        assert adjacent_releases == {
            "next_releases_list": ["foobar@1.0.0", "foobar@2.0.0"],
            "prev_releases_list": ["foobar@3.0.0"],
        }

    def test_get_adjacent_releases_when_current_release_is_not_found_on_crash_free_users_ordering(
        self,
    ):
        adjacent_releases = get_adjacent_releases_based_on_adoption(
            project_id=self.project.id,
            org_id=self.project.organization_id,
            release="foobar@1.0.0",
            environments=["test-whatever"],
            scope="crash_free_users",
        )
        assert adjacent_releases == {"next_releases_list": [], "prev_releases_list": []}

    def test_get_adjacent_releases_to_last_release_in_different_env_on_crash_free_users_ordering(
        self,
    ):
        adjacent_releases = get_adjacent_releases_based_on_adoption(
            project_id=self.project.id,
            org_id=self.project.organization_id,
            release="foobar@1.0.0",
            environments=["test"],
            scope="crash_free_users",
        )
        assert adjacent_releases == {"next_releases_list": [], "prev_releases_list": []}
