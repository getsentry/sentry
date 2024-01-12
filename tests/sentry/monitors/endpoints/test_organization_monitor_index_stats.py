from datetime import datetime, timedelta, timezone

from sentry.monitors.models import CheckInStatus, MonitorCheckIn
from sentry.testutils.cases import MonitorTestCase
from sentry.testutils.helpers.datetime import freeze_time
from sentry.testutils.silo import region_silo_test


@region_silo_test
@freeze_time(datetime(2022, 3, 21, 7, 57, tzinfo=timezone.utc))
class OrganizationMonitorIndexStatsTest(MonitorTestCase):
    endpoint = "sentry-api-0-organization-monitor-index-stats"

    def add_checkin(self, monitor, offset, env=None, status=None):
        if status is None:
            status = CheckInStatus.OK
        if env is None:
            env = self.env_prod

        MonitorCheckIn.objects.create(
            monitor=monitor,
            monitor_environment=env,
            project_id=self.project.id,
            date_added=self.monitor1.date_added + timedelta(**offset),
            status=status,
        )

    def setUp(self):
        super().setUp()
        self.login_as(user=self.user)
        self.monitor1 = self._create_monitor()
        self.monitor2 = self._create_monitor()
        self.env_prod = self._create_monitor_environment(monitor=self.monitor1)
        self.env_debug = self._create_monitor_environment(monitor=self.monitor1, name="debug")

        # Be sure to note the freeze time above
        self.since = self.monitor1.date_added
        self.until = self.monitor1.date_added + timedelta(hours=2)

        self.add_checkin(self.monitor1, offset={"minutes": 1})
        self.add_checkin(self.monitor1, offset={"minutes": 1}, status=CheckInStatus.IN_PROGRESS)
        self.add_checkin(self.monitor1, offset={"minutes": 2}, env=self.env_debug)

        self.add_checkin(
            self.monitor1,
            offset={"hours": 1, "minutes": 1},
            status=CheckInStatus.MISSED,
        )
        self.add_checkin(
            self.monitor1,
            offset={"hours": 1, "minutes": 2},
            env=self.env_debug,
            status=CheckInStatus.ERROR,
        )
        self.add_checkin(
            self.monitor1,
            offset={"hours": 1, "minutes": 1},
            status=CheckInStatus.TIMEOUT,
        )
        self.add_checkin(
            self.monitor1,
            offset={"hours": 1, "minutes": 2},
            env=self.env_debug,
            status=CheckInStatus.TIMEOUT,
        )

        self.add_checkin(self.monitor2, offset={"minutes": 1})
        self.add_checkin(self.monitor2, offset={"minutes": 2})

    def test_simple(self):
        resp = self.get_success_response(
            self.organization.slug,
            **{
                "monitor": [self.monitor1.slug, self.monitor2.slug],
                "since": self.since.timestamp(),
                "until": self.until.timestamp(),
                "resolution": "1h",
            },
        )

        assert list(resp.data.keys()) == [self.monitor1.slug, self.monitor2.slug]

        # Check monitor1's stats
        hour_one, hour_two, *extra = resp.data[self.monitor1.slug]
        assert hour_one == [
            1647846000,
            {
                "production": {"in_progress": 1, "ok": 1, "error": 0, "missed": 0, "timeout": 0},
                "debug": {"in_progress": 0, "ok": 1, "error": 0, "missed": 0, "timeout": 0},
            },
        ]
        assert hour_two == [
            1647849600,
            {
                "production": {"in_progress": 0, "ok": 0, "error": 0, "missed": 1, "timeout": 1},
                "debug": {"in_progress": 0, "ok": 0, "error": 1, "missed": 0, "timeout": 1},
            },
        ]

        # Check monitor2's stats
        hour_one, *extra = resp.data[self.monitor2.slug]
        assert hour_one == [
            1647846000,
            {
                "production": {"ok": 2, "error": 0, "missed": 0, "timeout": 0, "in_progress": 0},
            },
        ]

    def test_filtered(self):
        resp = self.get_success_response(
            self.organization.slug,
            **{
                "monitor": [self.monitor2.slug],
                "since": self.since.timestamp(),
                "until": self.until.timestamp(),
                "resolution": "1h",
            },
        )

        assert list(resp.data.keys()) == [self.monitor2.slug]

        # Check monitor2's stats
        hour_one, *extra = resp.data[self.monitor2.slug]
        assert hour_one == [
            1647846000,
            {
                "production": {"ok": 2, "error": 0, "missed": 0, "timeout": 0, "in_progress": 0},
            },
        ]

    def test_custom_resolution(self):
        two_min_later = self.since + timedelta(minutes=2)

        resp = self.get_success_response(
            self.organization.slug,
            **{
                "monitor": [self.monitor1.slug],
                "since": self.since.timestamp(),
                "until": two_min_later.timestamp(),
                "resolution": "1m",
            },
        )

        min_0, min_1, min_2 = resp.data[self.monitor1.slug]

        assert min_0 == [
            1647849420,
            {},
        ]

        assert min_1 == [
            1647849480,
            {
                "production": {"in_progress": 1, "ok": 1, "error": 0, "missed": 0, "timeout": 0},
            },
        ]
        assert min_2 == [
            1647849540,
            {
                "debug": {"in_progress": 0, "ok": 1, "error": 0, "missed": 0, "timeout": 0},
            },
        ]
