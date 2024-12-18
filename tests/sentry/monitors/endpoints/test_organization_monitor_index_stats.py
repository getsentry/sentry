from datetime import datetime, timedelta, timezone

from sentry.monitors.models import CheckInStatus, MonitorCheckIn
from sentry.testutils.cases import MonitorTestCase
from sentry.testutils.helpers.datetime import freeze_time


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
        self.env_prod_2 = self._create_monitor_environment(monitor=self.monitor2)

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
        self.add_checkin(
            self.monitor1,
            offset={"hours": 1, "minutes": 2},
            env=self.env_debug,
            status=CheckInStatus.UNKNOWN,
        )

        self.add_checkin(self.monitor2, env=self.env_prod_2, offset={"minutes": 1})
        self.add_checkin(self.monitor2, env=self.env_prod_2, offset={"minutes": 2})

    def test_simple(self):
        resp = self.get_success_response(
            self.organization.slug,
            **{
                "monitor": [str(self.monitor1.guid), str(self.monitor2.guid)],
                "since": self.since.timestamp(),
                "until": self.until.timestamp(),
                "resolution": "1h",
            },
        )

        assert list(resp.data.keys()) == [str(self.monitor1.guid), str(self.monitor2.guid)]

        # Check monitor1's stats
        hour_one, hour_two, *extra = resp.data[str(self.monitor1.guid)]
        assert hour_one == [
            1647846000,
            {
                "production": {
                    "in_progress": 1,
                    "ok": 1,
                    "error": 0,
                    "missed": 0,
                    "timeout": 0,
                    "unknown": 0,
                },
                "debug": {
                    "in_progress": 0,
                    "ok": 1,
                    "error": 0,
                    "missed": 0,
                    "timeout": 0,
                    "unknown": 0,
                },
            },
        ]
        assert hour_two == [
            1647849600,
            {
                "production": {
                    "in_progress": 0,
                    "ok": 0,
                    "error": 0,
                    "missed": 1,
                    "timeout": 1,
                    "unknown": 0,
                },
                "debug": {
                    "in_progress": 0,
                    "ok": 0,
                    "error": 1,
                    "missed": 0,
                    "timeout": 1,
                    "unknown": 1,
                },
            },
        ]

        # Check monitor2's stats
        hour_one, *extra = resp.data[str(self.monitor2.guid)]
        assert hour_one == [
            1647846000,
            {
                "production": {
                    "ok": 2,
                    "error": 0,
                    "missed": 0,
                    "timeout": 0,
                    "in_progress": 0,
                    "unknown": 0,
                },
            },
        ]

    def test_filtered(self):
        resp = self.get_success_response(
            self.organization.slug,
            **{
                "monitor": [str(self.monitor2.guid)],
                "since": self.since.timestamp(),
                "until": self.until.timestamp(),
                "resolution": "1h",
            },
        )

        assert list(resp.data.keys()) == [str(self.monitor2.guid)]

        # Check monitor2's stats
        hour_one, *extra = resp.data[str(self.monitor2.guid)]
        assert hour_one == [
            1647846000,
            {
                "production": {
                    "ok": 2,
                    "error": 0,
                    "missed": 0,
                    "timeout": 0,
                    "in_progress": 0,
                    "unknown": 0,
                },
            },
        ]

    def test_custom_resolution(self):
        two_min_later = self.since + timedelta(minutes=2)

        resp = self.get_success_response(
            self.organization.slug,
            **{
                "monitor": [str(self.monitor1.guid)],
                "since": self.since.timestamp(),
                "until": two_min_later.timestamp(),
                "resolution": "1m",
            },
        )

        min_0, min_1, min_2 = resp.data[str(self.monitor1.guid)]

        assert min_0 == [
            1647849420,
            {},
        ]

        assert min_1 == [
            1647849480,
            {
                "production": {
                    "in_progress": 1,
                    "ok": 1,
                    "error": 0,
                    "missed": 0,
                    "timeout": 0,
                    "unknown": 0,
                },
            },
        ]

        assert min_2 == [
            1647849540,
            {},
        ]

    def test_disallow_stats_when_no_project_access(self):
        # disable Open Membership
        self.organization.flags.allow_joinleave = False
        self.organization.save()

        # user has no access to all the projects
        user_no_team = self.create_user(is_superuser=False)
        self.create_member(
            user=user_no_team, organization=self.organization, role="member", teams=[]
        )
        self.login_as(user_no_team)

        resp = self.get_success_response(
            self.organization.slug,
            **{
                "monitor": [
                    str(self.monitor1.guid),
                ],
                "since": self.since.timestamp(),
                "until": self.until.timestamp(),
                "resolution": "1h",
            },
        )
        assert resp.status_code == 200
        assert resp.data == {}
