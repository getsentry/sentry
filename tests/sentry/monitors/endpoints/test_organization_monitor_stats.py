from datetime import datetime, timedelta

from freezegun import freeze_time

from sentry.monitors.models import CheckInStatus, MonitorCheckIn
from sentry.testutils import MonitorTestCase
from sentry.testutils.silo import region_silo_test


@region_silo_test(stable=True)
@freeze_time(
    (datetime.now() - timedelta(days=2)).replace(hour=7, minute=57, second=0, microsecond=0)
)
class ListMonitorCheckInsTest(MonitorTestCase):
    endpoint = "sentry-api-0-organization-monitor-stats"

    def setUp(self):
        super().setUp()
        self.login_as(user=self.user)
        self.monitor = self._create_monitor()
        self.since = self.monitor.date_added
        self.until = self.monitor.date_added + timedelta(hours=2)
        monitor_environment_production = self._create_monitor_environment(monitor=self.monitor)
        monitor_environment_debug = self._create_monitor_environment(
            monitor=self.monitor, name="debug"
        )
        MonitorCheckIn.objects.create(
            monitor=self.monitor,
            monitor_environment=monitor_environment_production,
            project_id=self.project.id,
            duration=1000,
            date_added=self.monitor.date_added + timedelta(minutes=1),
            status=CheckInStatus.OK,
        )
        MonitorCheckIn.objects.create(
            monitor=self.monitor,
            monitor_environment=monitor_environment_debug,
            project_id=self.project.id,
            duration=2000,
            date_added=self.monitor.date_added + timedelta(minutes=2),
            status=CheckInStatus.OK,
        )
        MonitorCheckIn.objects.create(
            monitor=self.monitor,
            monitor_environment=monitor_environment_production,
            project_id=self.project.id,
            duration=1500,
            date_added=self.monitor.date_added + timedelta(hours=1, minutes=1),
            status=CheckInStatus.MISSED,
        )
        MonitorCheckIn.objects.create(
            monitor=self.monitor,
            monitor_environment=monitor_environment_debug,
            project_id=self.project.id,
            duration=2500,
            date_added=self.monitor.date_added + timedelta(hours=1, minutes=2),
            status=CheckInStatus.ERROR,
        )
        MonitorCheckIn.objects.create(
            monitor=self.monitor,
            monitor_environment=monitor_environment_production,
            project_id=self.project.id,
            duration=3000,
            date_added=self.monitor.date_added + timedelta(hours=1, minutes=1),
            status=CheckInStatus.TIMEOUT,
        )
        MonitorCheckIn.objects.create(
            monitor=self.monitor,
            monitor_environment=monitor_environment_debug,
            project_id=self.project.id,
            duration=3000,
            date_added=self.monitor.date_added + timedelta(hours=1, minutes=2),
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

        assert hour_two["duration"] == 2500
        assert hour_two["ok"] == 0
        assert hour_two["missed"] == 1
        assert hour_two["error"] == 1
        assert hour_two["timeout"] == 2

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

        assert hour_two["duration"] == 2250
        assert hour_two["ok"] == 0
        assert hour_two["missed"] == 1
        assert hour_two["error"] == 0
        assert hour_two["timeout"] == 1

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

        assert hour_two["duration"] == 2500
        assert hour_two["ok"] == 0
        assert hour_two["missed"] == 1
        assert hour_two["error"] == 1
        assert hour_two["timeout"] == 2

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

        assert hour_two["duration"] == 0
        assert hour_two["ok"] == 0
        assert hour_two["missed"] == 0
        assert hour_two["error"] == 0
        assert hour_two["timeout"] == 0
