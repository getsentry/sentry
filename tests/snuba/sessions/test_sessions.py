from __future__ import absolute_import

import time
import pytz
from datetime import datetime

from sentry.testutils import SnubaTestCase, TestCase
from sentry.snuba.sessions import (
    get_oldest_health_data_for_releases,
    check_has_health_data,
    get_project_releases_by_stability,
    get_release_adoption,
    get_release_health_data_overview,
    _make_stats,
)


def format_timestamp(dt):
    if not isinstance(dt, datetime):
        dt = datetime.utcfromtimestamp(dt)
    return dt.strftime("%Y-%m-%dT%H:%M:%S+00:00")


def make_24h_stats(ts):
    return _make_stats(datetime.utcfromtimestamp(ts).replace(tzinfo=pytz.utc), 3600, 24)


class SnubaSessionsTest(TestCase, SnubaTestCase):
    def setUp(self):
        super(SnubaSessionsTest, self).setUp()
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
        assert data == set([(self.project.id, self.session_release)])

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
            },
            (self.project.id, self.session_crashed_release): {
                "sessions_24h": 1,
                "users_24h": 1,
                "adoption": 100.0,
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
            },
            (self.project.id, self.session_crashed_release): {
                "sessions_24h": 2,
                "users_24h": 2,
                "adoption": 100.0,
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
                "has_health_data": True,
                "crash_free_sessions": 0.0,
                "duration_p50": None,
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
                "has_health_data": True,
                "crash_free_sessions": 100.0,
                "duration_p50": 45.0,
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
                "has_health_data": True,
                "crash_free_sessions": 0.0,
                "duration_p50": None,
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
                "has_health_data": True,
                "crash_free_sessions": 100.0,
                "duration_p50": 45.0,
            },
        }
