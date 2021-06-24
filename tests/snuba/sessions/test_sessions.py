import time
import uuid
from datetime import datetime, timedelta

import pytz
from django.utils import timezone

from sentry.snuba.sessions import (
    _make_stats,
    check_has_health_data,
    get_adjacent_releases_based_on_adoption,
    get_current_and_previous_crash_free_rates,
    get_oldest_health_data_for_releases,
    get_project_releases_by_stability,
    get_release_adoption,
    get_release_health_data_overview,
    get_release_sessions_time_bounds,
)
from sentry.testutils import SnubaTestCase, TestCase
from sentry.utils.dates import to_timestamp


def format_timestamp(dt):
    if not isinstance(dt, datetime):
        dt = datetime.utcfromtimestamp(dt)
    return dt.strftime("%Y-%m-%dT%H:%M:%S+00:00")


def make_24h_stats(ts):
    return _make_stats(datetime.utcfromtimestamp(ts).replace(tzinfo=pytz.utc), 3600, 24)


def generate_session_default_args(session_dict):
    session_dict_default = {
        "session_id": str(uuid.uuid4()),
        "distinct_id": str(uuid.uuid4()),
        "status": "ok",
        "seq": 0,
        "release": "random@1.0",
        "environment": "prod",
        "retention_days": 90,
        "org_id": 0,
        "project_id": 0,
        "duration": 60.0,
        "errors": 0,
        "started": time.time() // 60 * 60,
        "received": time.time(),
    }
    session_dict_default.update(session_dict)
    return session_dict_default


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
            generate_session_default_args(
                {
                    "started": date_100_days_ago // 60 * 60,
                    "received": date_100_days_ago,
                    "project_id": project2.id,
                    "org_id": project2.organization_id,
                    "status": "exited",
                }
            )
        )
        data = check_has_health_data([self.project.id, project2.id])
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
            generate_session_default_args(
                {"project_id": project2.id, "org_id": project2.organization_id, "status": "exited"}
            )
        )
        data = check_has_health_data([self.project.id, project2.id])
        assert data == {self.project.id, project2.id}

    def test_check_has_health_data_does_not_crash_when_sending_projects_list_as_set(self):
        data = check_has_health_data({self.project.id})
        assert data == {self.project.id}

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

    def test_get_project_releases_by_stability_for_crash_free_sort(self):
        """
        Test that ensures that using crash free rate sort options, returns a list of ASC releases
        according to the chosen crash_free sort option
        """
        for scope in "crash_free_sessions", "crash_free_users":
            data = get_project_releases_by_stability(
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
            {
                "session_id": "bd1521fc-d27c-11eb-b8bc-0242ac130003",
                "status": "ok",
                "seq": 0,
                "release": "release-with-no-users",
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
        data = get_project_releases_by_stability(
            [self.project.id], offset=0, limit=100, scope="users", stats_period="24h"
        )
        assert data == [
            (self.project.id, self.session_release),
            (self.project.id, self.session_crashed_release),
        ]

        data = get_project_releases_by_stability(
            [self.project.id], offset=0, limit=100, scope="crash_free_users", stats_period="24h"
        )
        assert data == [
            (self.project.id, self.session_crashed_release),
            (self.project.id, self.session_release),
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


class SnubaReleaseDetailPaginationBaseTestClass:
    @staticmethod
    def compare_releases_list_according_to_current_release_filters(
        project_id, org_id, release, environments, scope, releases_list, stats_period=None
    ):
        adj_releases_filters = {
            "project_id": project_id,
            "org_id": org_id,
            "release": release,
            "environments": environments,
            "scope": scope,
        }
        if stats_period:
            adj_releases_filters.update({"stats_period": stats_period})

        adjacent_releases = get_adjacent_releases_based_on_adoption(**adj_releases_filters)
        assert adjacent_releases == releases_list


class SnubaReleaseDetailPaginationOnSessionsTest(
    TestCase, SnubaTestCase, SnubaReleaseDetailPaginationBaseTestClass
):
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
        self.common_release_filters = {
            "project_id": self.project.id,
            "org_id": self.project.organization_id,
            "scope": "sessions",
        }
        self.received = time.time()
        self.session_started = time.time() // 60 * 60
        self.session_started_gt_24h = self.session_started - 25 * 60 * 60
        self.session_release_1 = "foobar@1.0.0"
        self.session_release_2 = "foobar@2.0.0"
        self.session_release_3 = "foobar@3.0.0"
        self.session_release_4 = "foobar@4.0.0"

        self.common_session_args = {
            "project_id": self.project.id,
            "org_id": self.project.organization_id,
            "received": self.received,
        }

        # Release: foobar@1.0.0
        # Env: prod
        # Time: < 24h
        # Total: 1 Session
        self.store_session(
            generate_session_default_args(
                {
                    **self.common_session_args,
                    "started": self.session_started,
                    "release": self.session_release_1,
                    "status": "exited",
                }
            )
        )

        # Env: prod
        # Time: > 24h but < 14 days
        # Total: 2 sessions
        for _ in range(0, 2):
            self.store_session(
                generate_session_default_args(
                    {
                        **self.common_session_args,
                        "started": self.session_started_gt_24h,
                        "release": self.session_release_1,
                        "status": "exited",
                    }
                )
            )

        # Env: test
        # Time: < 24h
        # Total: 1 Session
        self.store_session(
            generate_session_default_args(
                {
                    **self.common_session_args,
                    "started": self.session_started,
                    "release": self.session_release_1,
                    "status": "exited",
                    "environment": "test",
                }
            )
        )

        # Release: foobar@2.0.0
        # Env: prod
        # Time: < 24h
        # Total: 2 Sessions
        self.store_session(
            generate_session_default_args(
                {
                    **self.common_session_args,
                    "started": self.session_started,
                    "release": self.session_release_2,
                    "duration": None,
                    "session_id": "5e910c1a-6941-460e-9843-24103fb6a63c",
                    "distinct_id": "39887d89-13b2-4c84-8c23-5d13d2102666",
                }
            )
        )
        self.store_session(
            generate_session_default_args(
                {
                    **self.common_session_args,
                    "started": self.session_started,
                    "release": self.session_release_2,
                    "session_id": "5e910c1a-6941-460e-9843-24103fb6a63c",
                    "distinct_id": "39887d89-13b2-4c84-8c23-5d13d2102666",
                    "status": "exited",
                    "seq": 1,
                }
            )
        )
        self.store_session(
            generate_session_default_args(
                {
                    **self.common_session_args,
                    "started": self.session_started,
                    "release": self.session_release_2,
                    "status": "exited",
                }
            )
        )

        # Release: foobar@3.0.0
        # Env: prod
        # Time: <24h
        # Total: 3 Session
        for _ in range(0, 3):
            self.store_session(
                generate_session_default_args(
                    {
                        **self.common_session_args,
                        "started": self.session_started,
                        "release": self.session_release_3,
                        "status": "exited",
                    }
                )
            )

        # Release: foobar@4.0.0
        # Env: prod
        # Time: <24h
        # Total: 3 Sessions
        for _ in range(0, 3):
            self.store_session(
                generate_session_default_args(
                    {
                        **self.common_session_args,
                        "started": self.session_started,
                        "release": self.session_release_4,
                        "status": "exited",
                    }
                )
            )

    def test_get_adjacent_releases_to_last_release(self):
        self.compare_releases_list_according_to_current_release_filters(
            **self.common_release_filters,
            release="foobar@1.0.0",
            environments=["prod"],
            releases_list={
                "next_releases_list": [],
                "prev_releases_list": ["foobar@2.0.0", "foobar@4.0.0", "foobar@3.0.0"],
            },
        )

    def test_get_adjacent_releases_to_first_release(self):
        self.compare_releases_list_according_to_current_release_filters(
            **self.common_release_filters,
            release="foobar@3.0.0",
            environments=["prod"],
            releases_list={
                "next_releases_list": ["foobar@4.0.0", "foobar@2.0.0", "foobar@1.0.0"],
                "prev_releases_list": [],
            },
        )

    def test_get_adjacent_releases_to_middle_release(self):
        self.compare_releases_list_according_to_current_release_filters(
            **self.common_release_filters,
            release="foobar@2.0.0",
            environments=["prod"],
            releases_list={
                "next_releases_list": ["foobar@1.0.0"],
                "prev_releases_list": ["foobar@4.0.0", "foobar@3.0.0"],
            },
        )

    def test_get_adjacent_releases_to_middle_release_with_same_sessions_count(
        self,
    ):
        """
        Test that ensures that releases with the same session count are disambiguated according to asc ordering
        of release version
        example -> Same session count releases
        """
        self.compare_releases_list_according_to_current_release_filters(
            **self.common_release_filters,
            release="foobar@4.0.0",
            environments=["prod"],
            releases_list={
                "next_releases_list": ["foobar@2.0.0", "foobar@1.0.0"],
                "prev_releases_list": ["foobar@3.0.0"],
            },
        )

    def test_get_adjacent_releases_to_middle_release_for_stats_period_7d(self):
        self.compare_releases_list_according_to_current_release_filters(
            **self.common_release_filters,
            release="foobar@3.0.0",
            environments=["prod"],
            stats_period="7d",
            releases_list={
                "next_releases_list": ["foobar@4.0.0", "foobar@2.0.0"],
                "prev_releases_list": ["foobar@1.0.0"],
            },
        )
        self.compare_releases_list_according_to_current_release_filters(
            **self.common_release_filters,
            release="foobar@1.0.0",
            environments=["prod"],
            stats_period="7d",
            releases_list={
                "next_releases_list": ["foobar@3.0.0", "foobar@4.0.0", "foobar@2.0.0"],
                "prev_releases_list": [],
            },
        )

    def test_get_adjacent_releases_when_current_release_is_not_found(self):
        self.compare_releases_list_according_to_current_release_filters(
            **self.common_release_filters,
            release="foobar@1.0.0",
            environments=["test-whatever"],
            releases_list={
                "next_releases_list": [],
                "prev_releases_list": [],
            },
        )

    def test_get_adjacent_releases_to_last_release_in_different_env(self):
        self.compare_releases_list_according_to_current_release_filters(
            **self.common_release_filters,
            release="foobar@1.0.0",
            environments=["test"],
            releases_list={
                "next_releases_list": [],
                "prev_releases_list": [],
            },
        )


class SnubaReleaseDetailPaginationOnCrashFreeSessionsTest(
    TestCase, SnubaTestCase, SnubaReleaseDetailPaginationBaseTestClass
):
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

        self.common_release_filters = {
            "project_id": self.project.id,
            "org_id": self.project.organization_id,
            "scope": "crash_free_sessions",
        }

        self.received = time.time()
        self.session_started = time.time() // 60 * 60
        self.session_started_gt_24h = self.session_started - 25 * 60 * 60
        self.session_release_1 = "foobar@1.0.0"
        self.session_release_2 = "foobar@2.0.0"
        self.session_release_3 = "foobar@3.0.0"
        self.session_release_4 = "foobar@4.0.0"

        self.common_session_args = {
            "project_id": self.project.id,
            "org_id": self.project.organization_id,
            "received": self.received,
        }

        # Release: foobar@1.0.0

        # Env: prod
        # Time: < 24h
        # Total: 1 Session -> 100% Crash Free
        self.store_session(
            generate_session_default_args(
                {
                    **self.common_session_args,
                    "started": self.session_started,
                    "release": self.session_release_1,
                    "status": "exited",
                }
            )
        )

        # Env: prod
        # Time: > 24h but < 14 days
        # Total: 3 sessions -> 1 Healthy + 2 Crashed -> 33.3333% Crash Free
        for _ in range(0, 2):
            self.store_session(
                generate_session_default_args(
                    {
                        **self.common_session_args,
                        "started": self.session_started_gt_24h,
                        "release": self.session_release_1,
                        "status": "crashed",
                    }
                )
            )

        # Env: test
        # Time: < 24h
        # Total: 1 Session -> 0% Crash Free
        self.store_session(
            generate_session_default_args(
                {
                    **self.common_session_args,
                    "started": self.session_started,
                    "release": self.session_release_1,
                    "status": "crashed",
                    "environment": "test",
                }
            )
        )

        # Release: foobar@2.0.0
        # Env: prod
        # Time: < 24h
        # Total: 2 Sessions -> 2 Crashed -> 0% Crash free
        self.store_session(
            generate_session_default_args(
                {
                    **self.common_session_args,
                    "started": self.session_started,
                    "release": self.session_release_2,
                    "duration": None,
                    "session_id": "5e910c1a-6941-460e-9843-24103fb6a63c",
                    "distinct_id": "39887d89-13b2-4c84-8c23-5d13d2102666",
                }
            )
        )
        self.store_session(
            generate_session_default_args(
                {
                    **self.common_session_args,
                    "started": self.session_started,
                    "release": self.session_release_2,
                    "session_id": "5e910c1a-6941-460e-9843-24103fb6a63c",
                    "distinct_id": "39887d89-13b2-4c84-8c23-5d13d2102666",
                    "status": "crashed",
                    "seq": 1,
                }
            )
        )
        self.store_session(
            generate_session_default_args(
                {
                    **self.common_session_args,
                    "started": self.session_started,
                    "release": self.session_release_2,
                    "status": "crashed",
                }
            )
        )

        # Release: foobar@3.0.0
        # Env: prod
        # Time: <24h
        # Total: 3 Session -> 2 Healthy + 1 Crashed -> 66.666% Crash free
        self.store_session(
            generate_session_default_args(
                {
                    **self.common_session_args,
                    "started": self.session_started,
                    "release": self.session_release_3,
                    "status": "crashed",
                }
            )
        )
        for _ in range(0, 2):
            self.store_session(
                generate_session_default_args(
                    {
                        **self.common_session_args,
                        "started": self.session_started,
                        "release": self.session_release_3,
                        "status": "exited",
                    }
                )
            )

        # Release: foobar@4.0.0
        # Env: prod
        # Time: <24h
        # Total: 3 Sessions -> 2 Healthy + 1 Crashed -> 66.666% Crash free
        self.store_session(
            generate_session_default_args(
                {
                    **self.common_session_args,
                    "started": self.session_started,
                    "release": self.session_release_4,
                    "status": "crashed",
                }
            )
        )
        for _ in range(0, 2):
            self.store_session(
                generate_session_default_args(
                    {
                        **self.common_session_args,
                        "started": self.session_started,
                        "release": self.session_release_4,
                        "status": "exited",
                    }
                )
            )

    def test_get_adjacent_releases_to_last_release(self):
        self.compare_releases_list_according_to_current_release_filters(
            **self.common_release_filters,
            release="foobar@2.0.0",
            environments=["prod"],
            releases_list={
                "next_releases_list": [],
                "prev_releases_list": ["foobar@4.0.0", "foobar@3.0.0", "foobar@1.0.0"],
            },
        )

    def test_get_adjacent_releases_to_first_release(self):
        self.compare_releases_list_according_to_current_release_filters(
            **self.common_release_filters,
            release="foobar@1.0.0",
            environments=["prod"],
            releases_list={
                "next_releases_list": ["foobar@3.0.0", "foobar@4.0.0", "foobar@2.0.0"],
                "prev_releases_list": [],
            },
        )

    def test_get_adjacent_releases_to_middle_release(self):
        self.compare_releases_list_according_to_current_release_filters(
            **self.common_release_filters,
            release="foobar@3.0.0",
            environments=["prod"],
            releases_list={
                "next_releases_list": ["foobar@4.0.0", "foobar@2.0.0"],
                "prev_releases_list": ["foobar@1.0.0"],
            },
        )

    def test_get_adjacent_releases_to_middle_release_with_same_crash_free_sessions_percentage(self):
        self.compare_releases_list_according_to_current_release_filters(
            **self.common_release_filters,
            release="foobar@4.0.0",
            environments=["prod"],
            releases_list={
                "next_releases_list": ["foobar@2.0.0"],
                "prev_releases_list": ["foobar@3.0.0", "foobar@1.0.0"],
            },
        )

    def test_get_adjacent_releases_to_middle_release_for_stats_period_7d(self):
        self.compare_releases_list_according_to_current_release_filters(
            **self.common_release_filters,
            release="foobar@3.0.0",
            environments=["prod"],
            stats_period="7d",
            releases_list={
                "next_releases_list": ["foobar@4.0.0", "foobar@1.0.0", "foobar@2.0.0"],
                "prev_releases_list": [],
            },
        )
        self.compare_releases_list_according_to_current_release_filters(
            **self.common_release_filters,
            release="foobar@4.0.0",
            environments=["prod"],
            stats_period="7d",
            releases_list={
                "next_releases_list": ["foobar@1.0.0", "foobar@2.0.0"],
                "prev_releases_list": ["foobar@3.0.0"],
            },
        )

    def test_get_adjacent_releases_when_current_release_is_not_found(self):
        self.compare_releases_list_according_to_current_release_filters(
            **self.common_release_filters,
            release="foobar@1.0.0",
            environments=["test-whatever"],
            releases_list={
                "next_releases_list": [],
                "prev_releases_list": [],
            },
        )

    def test_get_adjacent_releases_to_last_release_in_different_env(self):
        self.compare_releases_list_according_to_current_release_filters(
            **self.common_release_filters,
            release="foobar@1.0.0",
            environments=["test"],
            releases_list={
                "next_releases_list": [],
                "prev_releases_list": [],
            },
        )


class SnubaReleaseDetailPaginationOnUsersTest(
    TestCase, SnubaTestCase, SnubaReleaseDetailPaginationBaseTestClass
):
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

        self.common_release_filters = {
            "project_id": self.project.id,
            "org_id": self.project.organization_id,
            "scope": "users",
        }
        self.received = time.time()
        self.session_started = time.time() // 60 * 60
        self.session_started_gt_24h = self.session_started - 25 * 60 * 60
        self.session_release_1 = "foobar@1.0.0"
        self.session_release_2 = "foobar@2.0.0"
        self.session_release_3 = "foobar@3.0.0"
        self.session_release_4 = "foobar@4.0.0"

        self.common_session_args = {
            "project_id": self.project.id,
            "org_id": self.project.organization_id,
            "received": self.received,
        }
        # Release: foobar@1.0.0

        # Env: prod
        # Time: < 24h
        # Total: 1 Session
        self.store_session(
            generate_session_default_args(
                {
                    **self.common_session_args,
                    "started": self.session_started,
                    "release": self.session_release_1,
                    "status": "exited",
                }
            )
        )

        # Env: prod
        # Time: > 24h but < 14 days
        # Total: 2 sessions
        for _ in range(0, 2):
            self.store_session(
                generate_session_default_args(
                    {
                        **self.common_session_args,
                        "started": self.session_started_gt_24h,
                        "release": self.session_release_1,
                        "status": "exited",
                    }
                )
            )

        # Env: test
        # Time: < 24h
        # Total: 1 Session
        self.store_session(
            generate_session_default_args(
                {
                    **self.common_session_args,
                    "started": self.session_started,
                    "release": self.session_release_1,
                    "status": "exited",
                    "environment": "test",
                }
            )
        )

        # Release: foobar@2.0.0
        # Env: prod
        # Time: < 24h
        # Total: 2 Sessions
        self.store_session(
            generate_session_default_args(
                {
                    **self.common_session_args,
                    "started": self.session_started,
                    "release": self.session_release_2,
                    "duration": None,
                    "session_id": "5e910c1a-6941-460e-9843-24103fb6a63c",
                    "distinct_id": "39887d89-13b2-4c84-8c23-5d13d2102666",
                }
            )
        )
        self.store_session(
            generate_session_default_args(
                {
                    **self.common_session_args,
                    "started": self.session_started,
                    "release": self.session_release_2,
                    "session_id": "5e910c1a-6941-460e-9843-24103fb6a63c",
                    "distinct_id": "39887d89-13b2-4c84-8c23-5d13d2102666",
                    "status": "exited",
                    "seq": 1,
                }
            )
        )

        self.store_session(
            generate_session_default_args(
                {
                    **self.common_session_args,
                    "started": self.session_started,
                    "release": self.session_release_2,
                    "status": "exited",
                }
            )
        )

        # Release: foobar@3.0.0
        # Env: prod
        # Time: <24h
        # Total: 3 Session
        for _ in range(0, 3):
            self.store_session(
                generate_session_default_args(
                    {
                        **self.common_session_args,
                        "started": self.session_started,
                        "release": self.session_release_3,
                        "status": "exited",
                    }
                )
            )

        # Release: foobar@4.0.0
        # Env: prod
        # Time: <24h
        # Total: 3 Sessions
        for _ in range(0, 3):
            self.store_session(
                generate_session_default_args(
                    {
                        **self.common_session_args,
                        "started": self.session_started,
                        "release": self.session_release_4,
                        "status": "exited",
                    }
                )
            )

    def test_get_adjacent_releases_to_last_release(self):
        self.compare_releases_list_according_to_current_release_filters(
            **self.common_release_filters,
            release="foobar@1.0.0",
            environments=["prod"],
            releases_list={
                "next_releases_list": [],
                "prev_releases_list": ["foobar@2.0.0", "foobar@4.0.0", "foobar@3.0.0"],
            },
        )

    def test_get_adjacent_releases_to_first_release(self):
        self.compare_releases_list_according_to_current_release_filters(
            **self.common_release_filters,
            release="foobar@3.0.0",
            environments=["prod"],
            releases_list={
                "next_releases_list": ["foobar@4.0.0", "foobar@2.0.0", "foobar@1.0.0"],
                "prev_releases_list": [],
            },
        )

    def test_get_adjacent_releases_to_middle_release(self):
        self.compare_releases_list_according_to_current_release_filters(
            **self.common_release_filters,
            release="foobar@2.0.0",
            environments=["prod"],
            releases_list={
                "next_releases_list": ["foobar@1.0.0"],
                "prev_releases_list": ["foobar@4.0.0", "foobar@3.0.0"],
            },
        )

    def test_get_adjacent_releases_to_middle_release_with_same_users_count(self):
        self.compare_releases_list_according_to_current_release_filters(
            **self.common_release_filters,
            release="foobar@4.0.0",
            environments=["prod"],
            releases_list={
                "next_releases_list": ["foobar@2.0.0", "foobar@1.0.0"],
                "prev_releases_list": ["foobar@3.0.0"],
            },
        )

    def test_get_adjacent_releases_to_middle_release_for_stats_period_7d(self):
        self.compare_releases_list_according_to_current_release_filters(
            **self.common_release_filters,
            release="foobar@3.0.0",
            environments=["prod"],
            stats_period="7d",
            releases_list={
                "next_releases_list": ["foobar@4.0.0", "foobar@2.0.0"],
                "prev_releases_list": ["foobar@1.0.0"],
            },
        )
        self.compare_releases_list_according_to_current_release_filters(
            **self.common_release_filters,
            release="foobar@1.0.0",
            stats_period="7d",
            environments=["prod"],
            releases_list={
                "next_releases_list": ["foobar@3.0.0", "foobar@4.0.0", "foobar@2.0.0"],
                "prev_releases_list": [],
            },
        )

    def test_get_adjacent_releases_when_current_release_is_not_found(self):
        self.compare_releases_list_according_to_current_release_filters(
            **self.common_release_filters,
            release="foobar@1.0.0",
            environments=["test-whatever"],
            releases_list={
                "next_releases_list": [],
                "prev_releases_list": [],
            },
        )

    def test_get_adjacent_releases_to_last_release_in_different_env(self):
        self.compare_releases_list_according_to_current_release_filters(
            **self.common_release_filters,
            release="foobar@1.0.0",
            environments=["test"],
            releases_list={
                "next_releases_list": [],
                "prev_releases_list": [],
            },
        )


class SnubaReleaseDetailPaginationOnCrashFreeUsersTest(
    TestCase, SnubaTestCase, SnubaReleaseDetailPaginationBaseTestClass
):
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

        self.common_release_filters = {
            "project_id": self.project.id,
            "org_id": self.project.organization_id,
            "scope": "crash_free_users",
        }
        self.received = time.time()
        self.session_started = time.time() // 60 * 60
        self.session_started_gt_24h = self.session_started - 25 * 60 * 60
        self.session_release_1 = "foobar@1.0.0"
        self.session_release_2 = "foobar@2.0.0"
        self.session_release_3 = "foobar@3.0.0"
        self.session_release_4 = "foobar@4.0.0"

        self.common_session_args = {
            "project_id": self.project.id,
            "org_id": self.project.organization_id,
            "received": self.received,
        }
        # Release: foobar@1.0.0

        # Env: prod
        # Time: < 24h
        # Total: 1 Session -> 100% Crash Free
        self.store_session(
            generate_session_default_args(
                {
                    **self.common_session_args,
                    "started": self.session_started,
                    "release": self.session_release_1,
                    "status": "exited",
                }
            )
        )

        # Env: prod
        # Time: > 24h but < 14 days
        # Total: 3 sessions -> 1 Healthy + 2 Crashed -> 33.3333% Crash Free
        for _ in range(0, 2):
            self.store_session(
                generate_session_default_args(
                    {
                        **self.common_session_args,
                        "started": self.session_started_gt_24h,
                        "release": self.session_release_1,
                        "status": "crashed",
                    }
                )
            )
        # Env: test
        # Time: < 24h
        # Total: 1 Session -> 0% Crash Free
        self.store_session(
            generate_session_default_args(
                {
                    **self.common_session_args,
                    "started": self.session_started,
                    "release": self.session_release_1,
                    "status": "crashed",
                    "environment": "test",
                }
            )
        )

        # Release: foobar@2.0.0
        # Env: prod
        # Time: < 24h
        # Total: 2 Sessions -> 2 Crashed -> 0% Crash free
        self.store_session(
            generate_session_default_args(
                {
                    **self.common_session_args,
                    "started": self.session_started,
                    "release": self.session_release_2,
                    "duration": None,
                    "session_id": "5e910c1a-6941-460e-9843-24103fb6a63c",
                    "distinct_id": "39887d89-13b2-4c84-8c23-5d13d2102666",
                }
            )
        )
        self.store_session(
            generate_session_default_args(
                {
                    **self.common_session_args,
                    "started": self.session_started,
                    "release": self.session_release_2,
                    "session_id": "5e910c1a-6941-460e-9843-24103fb6a63c",
                    "distinct_id": "39887d89-13b2-4c84-8c23-5d13d2102666",
                    "status": "crashed",
                    "seq": 1,
                }
            )
        )
        self.store_session(
            generate_session_default_args(
                {
                    **self.common_session_args,
                    "started": self.session_started,
                    "release": self.session_release_2,
                    "status": "crashed",
                }
            )
        )

        # Release: foobar@3.0.0
        # Env: prod
        # Time: <24h
        # Total: 3 Session -> 2 Healthy + 1 Crashed -> 66.666% Crash free
        self.store_session(
            generate_session_default_args(
                {
                    **self.common_session_args,
                    "started": self.session_started,
                    "release": self.session_release_3,
                    "status": "crashed",
                }
            )
        )
        for _ in range(0, 2):
            self.store_session(
                generate_session_default_args(
                    {
                        **self.common_session_args,
                        "started": self.session_started,
                        "release": self.session_release_3,
                        "status": "exited",
                    }
                )
            )

        # Release: foobar@4.0.0
        # Env: prod
        # Time: <24h
        # Total: 3 Sessions -> 2 Healthy + 1 Crashed -> 66.666% Crash free
        self.store_session(
            generate_session_default_args(
                {
                    **self.common_session_args,
                    "started": self.session_started,
                    "release": self.session_release_4,
                    "status": "crashed",
                }
            )
        )
        for _ in range(0, 2):
            self.store_session(
                generate_session_default_args(
                    {
                        **self.common_session_args,
                        "started": self.session_started,
                        "release": self.session_release_4,
                        "status": "exited",
                    }
                )
            )

    def test_get_adjacent_releases_to_last_release(self):
        self.compare_releases_list_according_to_current_release_filters(
            **self.common_release_filters,
            release="foobar@2.0.0",
            environments=["prod"],
            releases_list={
                "next_releases_list": [],
                "prev_releases_list": ["foobar@4.0.0", "foobar@3.0.0", "foobar@1.0.0"],
            },
        )

    def test_get_adjacent_releases_to_first_release(self):
        self.compare_releases_list_according_to_current_release_filters(
            **self.common_release_filters,
            release="foobar@1.0.0",
            environments=["prod"],
            releases_list={
                "next_releases_list": ["foobar@3.0.0", "foobar@4.0.0", "foobar@2.0.0"],
                "prev_releases_list": [],
            },
        )

    def test_get_adjacent_releases_to_middle_release(self):
        self.compare_releases_list_according_to_current_release_filters(
            **self.common_release_filters,
            release="foobar@3.0.0",
            environments=["prod"],
            releases_list={
                "next_releases_list": ["foobar@4.0.0", "foobar@2.0.0"],
                "prev_releases_list": ["foobar@1.0.0"],
            },
        )

    def test_get_adjacent_releases_to_middle_release_with_same_crash_free_percentage(self):
        self.compare_releases_list_according_to_current_release_filters(
            **self.common_release_filters,
            release="foobar@4.0.0",
            environments=["prod"],
            releases_list={
                "next_releases_list": ["foobar@2.0.0"],
                "prev_releases_list": ["foobar@3.0.0", "foobar@1.0.0"],
            },
        )

    def test_get_adjacent_releases_to_middle_release_for_stats_period_7d(self):
        self.compare_releases_list_according_to_current_release_filters(
            **self.common_release_filters,
            release="foobar@3.0.0",
            stats_period="7d",
            environments=["prod"],
            releases_list={
                "next_releases_list": ["foobar@4.0.0", "foobar@1.0.0", "foobar@2.0.0"],
                "prev_releases_list": [],
            },
        )
        self.compare_releases_list_according_to_current_release_filters(
            **self.common_release_filters,
            release="foobar@4.0.0",
            stats_period="7d",
            environments=["prod"],
            releases_list={
                "next_releases_list": ["foobar@1.0.0", "foobar@2.0.0"],
                "prev_releases_list": ["foobar@3.0.0"],
            },
        )

    def test_get_adjacent_releases_when_current_release_is_not_found(self):
        self.compare_releases_list_according_to_current_release_filters(
            **self.common_release_filters,
            release="foobar@1.0.0",
            environments=["test-whatever"],
            releases_list={
                "next_releases_list": [],
                "prev_releases_list": [],
            },
        )

    def test_get_adjacent_releases_to_last_release_in_different_env(
        self,
    ):
        self.compare_releases_list_according_to_current_release_filters(
            **self.common_release_filters,
            release="foobar@1.0.0",
            environments=["test"],
            releases_list={
                "next_releases_list": [],
                "prev_releases_list": [],
            },
        )


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
                generate_session_default_args(
                    {
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
                generate_session_default_args(
                    {
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
                generate_session_default_args(
                    {
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
                generate_session_default_args(
                    {
                        "project_id": self.project3.id,
                        "org_id": self.project3.organization_id,
                        "status": status,
                        "started": self.session_started_gt_24_lt_48,
                    }
                )
            )

    def test_get_current_and_previous_crash_free_rates(self):
        now = timezone.now()
        last_24h_start = now - 24 * timedelta(hours=1)
        last_48h_start = now - 2 * 24 * timedelta(hours=1)

        data = get_current_and_previous_crash_free_rates(
            project_ids=[self.project.id, self.project2.id, self.project3.id],
            current_start=last_24h_start,
            current_end=now,
            previous_start=last_48h_start,
            previous_end=last_24h_start,
            rollup=86400,
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
        now = timezone.now()
        last_48h_start = now - 2 * 24 * timedelta(hours=1)
        last_72h_start = now - 3 * 24 * timedelta(hours=1)
        last_96h_start = now - 4 * 24 * timedelta(hours=1)

        data = get_current_and_previous_crash_free_rates(
            project_ids=[self.project.id],
            current_start=last_72h_start,
            current_end=last_48h_start,
            previous_start=last_96h_start,
            previous_end=last_72h_start,
            rollup=86400,
        )

        assert data == {
            self.project.id: {
                "currentCrashFreeRate": None,
                "previousCrashFreeRate": None,
            },
        }
