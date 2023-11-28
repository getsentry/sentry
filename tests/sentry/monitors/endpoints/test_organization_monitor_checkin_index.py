import uuid
from datetime import timedelta

from django.utils import timezone

from sentry.models.environment import Environment
from sentry.models.group import Group
from sentry.monitors.models import CheckInStatus, MonitorCheckIn, MonitorStatus
from sentry.testutils.cases import MonitorTestCase
from sentry.testutils.helpers.datetime import freeze_time
from sentry.testutils.silo import region_silo_test
from sentry.testutils.skips import requires_snuba
from sentry.utils.samples import load_data

pytestmark = requires_snuba


@region_silo_test
@freeze_time()
class ListMonitorCheckInsTest(MonitorTestCase):
    endpoint = "sentry-api-0-organization-monitor-check-in-index"

    def setUp(self):
        super().setUp()
        self.login_as(user=self.user)

    def create_error(self, platform, trace_id, project_id, timestamp):
        data = load_data(platform, timestamp=timestamp)
        if "contexts" not in data:
            data["contexts"] = {}
        data["contexts"]["trace"] = {
            "type": "trace",
            "trace_id": trace_id,
            "span_id": uuid.uuid4().hex[:16],
        }
        return self.store_event(data, project_id=project_id)

    def test_options_cors(self):
        monitor = self._create_monitor()
        monitor_environment = self._create_monitor_environment(monitor)

        MonitorCheckIn.objects.create(
            monitor=monitor,
            monitor_environment=monitor_environment,
            project_id=self.project.id,
            date_added=monitor.date_added - timedelta(minutes=2),
            status=CheckInStatus.OK,
        )

        resp = self.get_success_response(
            self.organization.slug,
            monitor.slug,
            method="OPTIONS",
            statsPeriod="1d",
        )
        assert resp.status_code == 200
        assert resp["Access-Control-Allow-Origin"]
        assert resp["Access-Control-Allow-Headers"]

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

    def test_trace_ids(self):
        monitor = self._create_monitor()
        monitor_environment = self._create_monitor_environment(monitor)

        trace_id = uuid.uuid4().hex

        error = self.create_error(
            platform="python",
            trace_id=trace_id,
            project_id=self.project.id,
            timestamp=monitor.date_added,
        )
        group = Group.objects.get(id=error.group_id)

        checkin1 = MonitorCheckIn.objects.create(
            monitor=monitor,
            monitor_environment=monitor_environment,
            project_id=self.project.id,
            date_added=monitor.date_added - timedelta(minutes=2),
            status=CheckInStatus.OK,
            trace_id=trace_id,
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
            **{"statsPeriod": "1d", "expand": ["groups"]},
        )
        assert len(resp.data) == 2

        # Newest first
        assert resp.data[0]["id"] == str(checkin2.guid)
        assert resp.data[0]["groups"] == []
        assert resp.data[1]["id"] == str(checkin1.guid)
        assert resp.data[1]["groups"] == [{"id": group.id, "shortId": group.qualified_short_id}]
