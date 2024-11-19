from datetime import datetime, timedelta

from sentry.monitors.models import CheckInStatus, MonitorCheckIn
from sentry.testutils.cases import MonitorTestCase
from sentry.testutils.helpers.datetime import freeze_time


@freeze_time(
    (datetime.now() - timedelta(days=2)).replace(hour=7, minute=57, second=0, microsecond=0)
)
class BaseMonitorStatsTest(MonitorTestCase):
    __test__ = False

    def add_checkin(self, offset, duration=None, env=None, status=None):
        if status is None:
            status = CheckInStatus.OK
        if env is None:
            env = self.env_prod

        MonitorCheckIn.objects.create(
            monitor=self.monitor,
            monitor_environment=env,
            project_id=self.project.id,
            duration=duration,
            date_added=self.monitor.date_added + timedelta(**offset),
            status=status,
        )

    def setUp(self):
        super().setUp()
        self.login_as(user=self.user)
        self.monitor = self._create_monitor()
        self.env_prod = self._create_monitor_environment(monitor=self.monitor)
        self.env_debug = self._create_monitor_environment(monitor=self.monitor, name="debug")

        # Be sure to note the freeze time above
        self.since = self.monitor.date_added
        self.until = self.monitor.date_added + timedelta(hours=2)

        self.add_checkin(offset={"minutes": 1}, duration=1000)
        self.add_checkin(offset={"minutes": 1}, status=CheckInStatus.IN_PROGRESS)
        self.add_checkin(offset={"minutes": 2}, duration=2000, env=self.env_debug)

        self.add_checkin(
            offset={"hours": 1, "minutes": 1},
            duration=1500,
            status=CheckInStatus.MISSED,
        )
        self.add_checkin(
            offset={"hours": 1, "minutes": 2},
            duration=2500,
            env=self.env_debug,
            status=CheckInStatus.ERROR,
        )
        self.add_checkin(
            offset={"hours": 1, "minutes": 1},
            duration=3000,
            status=CheckInStatus.TIMEOUT,
        )
        self.add_checkin(
            offset={"hours": 1, "minutes": 2},
            duration=3000,
            env=self.env_debug,
            status=CheckInStatus.TIMEOUT,
        )

    def test_simple(self):
        resp = self.get_success_response(
            self.organization.slug,
            self.monitor.slug,
            **{
                "since": self.since.timestamp(),
                "until": self.until.timestamp(),
                "resolution": "1h",
            },
        )

        hour_one, hour_two, *extra = resp.data
        assert hour_one["duration"] == 1500
        assert hour_one["ok"] == 2
        assert hour_one["missed"] == 0
        assert hour_one["error"] == 0
        assert hour_one["timeout"] == 0
        assert hour_one["unknown"] == 0
        assert "in_progress" not in hour_one

        assert hour_two["duration"] == 2500
        assert hour_two["ok"] == 0
        assert hour_two["missed"] == 1
        assert hour_two["error"] == 1
        assert hour_two["timeout"] == 2
        assert hour_two["unknown"] == 0

    def test_simple_environment(self):
        resp = self.get_success_response(
            self.organization.slug,
            self.monitor.slug,
            **{
                "since": self.since.timestamp(),
                "until": self.until.timestamp(),
                "resolution": "1h",
                "environment": "production",
            },
        )

        hour_one, hour_two, *extra = resp.data
        assert hour_one["duration"] == 1000
        assert hour_one["ok"] == 1
        assert hour_one["missed"] == 0
        assert hour_one["error"] == 0
        assert hour_one["timeout"] == 0
        assert hour_one["unknown"] == 0

        assert hour_two["duration"] == 2250
        assert hour_two["ok"] == 0
        assert hour_two["missed"] == 1
        assert hour_two["error"] == 0
        assert hour_two["timeout"] == 1
        assert hour_two["unknown"] == 0

    def test_multiple_environment(self):
        resp = self.get_success_response(
            self.organization.slug,
            self.monitor.slug,
            **{
                "since": self.since.timestamp(),
                "until": self.until.timestamp(),
                "resolution": "1h",
                "qs_params": [("environment", "production"), ("environment", "debug")],
            },
        )

        hour_one, hour_two, *extra = resp.data
        assert hour_one["duration"] == 1500
        assert hour_one["ok"] == 2
        assert hour_one["missed"] == 0
        assert hour_one["error"] == 0
        assert hour_one["timeout"] == 0
        assert hour_one["unknown"] == 0

        assert hour_two["duration"] == 2500
        assert hour_two["ok"] == 0
        assert hour_two["missed"] == 1
        assert hour_two["error"] == 1
        assert hour_two["timeout"] == 2
        assert hour_two["unknown"] == 0

    def test_bad_monitorenvironment(self):
        self.create_environment(name="empty", project=self.project)
        resp = self.get_success_response(
            self.organization.slug,
            self.monitor.slug,
            **{
                "since": self.since.timestamp(),
                "until": self.until.timestamp(),
                "resolution": "1h",
                "environment": "empty",
            },
        )

        hour_one, hour_two, *extra = resp.data
        assert hour_one["duration"] == 0
        assert hour_one["ok"] == 0
        assert hour_one["missed"] == 0
        assert hour_one["error"] == 0
        assert hour_one["timeout"] == 0
        assert hour_one["unknown"] == 0

        assert hour_two["duration"] == 0
        assert hour_two["ok"] == 0
        assert hour_two["missed"] == 0
        assert hour_two["error"] == 0
        assert hour_two["timeout"] == 0
        assert hour_two["unknown"] == 0
