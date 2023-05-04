from datetime import timedelta

from django.utils import timezone
from freezegun import freeze_time

from sentry.models import Environment
from sentry.monitors.models import CheckInStatus, MonitorCheckIn, MonitorStatus
from sentry.testutils import MonitorTestCase
from sentry.testutils.silo import region_silo_test


@region_silo_test(stable=True)
@freeze_time()
class ListMonitorCheckInsTest(MonitorTestCase):
    endpoint = "sentry-api-0-organization-monitor-check-in-index"

    def setUp(self):
        super().setUp()
        self.login_as(user=self.user)

    def test_simple(self):
        monitor = self._create_monitor()
        monitor_environment = self._create_monitor_environment(monitor)

        checkin1 = MonitorCheckIn.objects.create(
            monitor=monitor,
            monitor_environment=monitor_environment,
            project_id=self.project.id,
            date_added=monitor.date_added - timedelta(minutes=2),
            status=CheckInStatus.OK,
        )
        checkin2 = MonitorCheckIn.objects.create(
            monitor=monitor,
            monitor_environment=monitor_environment,
            project_id=self.project.id,
            date_added=monitor.date_added - timedelta(minutes=1),
            status=CheckInStatus.OK,
        )

        resp = self.get_success_response(
            self.organization.slug,
            monitor.slug,
            **{"statsPeriod": "1d"},
        )
        assert len(resp.data) == 2

        # Newest first
        assert resp.data[0]["id"] == str(checkin2.guid)
        assert resp.data[1]["id"] == str(checkin1.guid)

    def test_statsperiod_constraints(self):
        monitor = self._create_monitor()
        monitor_environment = self._create_monitor_environment(monitor)

        checkin = MonitorCheckIn.objects.create(
            project_id=self.project.id,
            monitor_id=monitor.id,
            monitor_environment_id=monitor_environment.id,
            status=MonitorStatus.OK,
            date_added=timezone.now() - timedelta(hours=12),
        )

        end = timezone.now()
        startOneHourAgo = end - timedelta(hours=1)
        startOneDayAgo = end - timedelta(days=1)

        resp = self.get_response(self.organization.slug, monitor.slug, **{"statsPeriod": "1h"})
        assert resp.data == []
        resp = self.get_response(
            self.organization.slug,
            monitor.slug,
            **{"start": startOneHourAgo.isoformat(), "end": end.isoformat()},
        )
        assert resp.data == []

        resp = self.get_response(self.organization.slug, monitor.slug, **{"statsPeriod": "1d"})
        assert resp.data[0]["id"] == str(checkin.guid)
        resp = self.get_response(
            self.organization.slug,
            monitor.slug,
            **{"start": startOneDayAgo.isoformat(), "end": end.isoformat()},
        )
        assert resp.data[0]["id"] == str(checkin.guid)

    def test_simple_environment(self):
        self.login_as(self.user)

        monitor = self._create_monitor()
        monitor_environment = self._create_monitor_environment(monitor, name="jungle")
        monitor_environment_2 = self._create_monitor_environment(monitor, name="volcano")

        checkin1 = MonitorCheckIn.objects.create(
            monitor=monitor,
            monitor_environment=monitor_environment,
            project_id=self.project.id,
            date_added=monitor.date_added - timedelta(minutes=2),
            status=CheckInStatus.OK,
        )
        MonitorCheckIn.objects.create(
            monitor=monitor,
            monitor_environment=monitor_environment_2,
            project_id=self.project.id,
            date_added=monitor.date_added - timedelta(minutes=1),
            status=CheckInStatus.OK,
        )

        resp = self.get_success_response(
            self.organization.slug, monitor.slug, **{"statsPeriod": "1d", "environment": "jungle"}
        )
        assert len(resp.data) == 1
        assert resp.data[0]["id"] == str(checkin1.guid)
        assert resp.data[0]["environment"] == str(checkin1.monitor_environment.environment.name)

    def test_bad_monitorenvironment(self):
        self.login_as(self.user)

        monitor = self._create_monitor()
        monitor_environment = self._create_monitor_environment(monitor, name="jungle")
        Environment.objects.create(name="volcano", organization_id=self.organization.id)
        MonitorCheckIn.objects.create(
            monitor=monitor,
            monitor_environment=monitor_environment,
            project_id=self.project.id,
            date_added=monitor.date_added - timedelta(minutes=2),
            status=CheckInStatus.OK,
        )
        MonitorCheckIn.objects.create(
            monitor=monitor,
            monitor_environment=monitor_environment,
            project_id=self.project.id,
            date_added=monitor.date_added - timedelta(minutes=1),
            status=CheckInStatus.OK,
        )

        resp = self.get_success_response(
            self.organization.slug, monitor.slug, **{"statsPeriod": "1d", "environment": "volcano"}
        )
        assert len(resp.data) == 0
