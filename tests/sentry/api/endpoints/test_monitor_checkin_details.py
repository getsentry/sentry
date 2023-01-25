from datetime import timedelta

from django.urls import reverse
from django.utils import timezone

from sentry.models import CheckInStatus, Monitor, MonitorCheckIn, MonitorStatus, MonitorType
from sentry.testutils import APITestCase
from sentry.testutils.silo import region_silo_test


@region_silo_test(stable=True)
class UpdateMonitorCheckInTest(APITestCase):
    endpoint = "sentry-api-0-monitor-check-in-details"
    endpoint_with_org = "sentry-api-0-monitor-check-in-details-with-org"

    def setUp(self):
        super().setUp()
        self.login_as(self.user)
        self.latest = lambda: None
        self.latest.guid = "latest"

    def _get_path_functions(self):
        return (
            lambda monitor, checkin: reverse(self.endpoint, args=[monitor.guid, checkin.guid]),
            lambda monitor, checkin: reverse(
                self.endpoint_with_org, args=[self.organization.slug, monitor.guid, checkin.guid]
            ),
        )

    def _create_monitor(self):
        return Monitor.objects.create(
            organization_id=self.organization.id,
            project_id=self.project.id,
            next_checkin=timezone.now() - timedelta(minutes=1),
            type=MonitorType.CRON_JOB,
            config={"schedule": "* * * * *"},
            date_added=timezone.now() - timedelta(minutes=1),
        )

    def test_noop_in_progress(self):
        for path_func in self._get_path_functions():
            monitor = self._create_monitor()
            checkin = MonitorCheckIn.objects.create(
                monitor=monitor,
                project_id=self.project.id,
                date_added=monitor.date_added,
                status=CheckInStatus.IN_PROGRESS,
            )

            path = path_func(monitor, checkin)
            resp = self.client.put(path)
            assert resp.status_code == 200, resp.content

            checkin = MonitorCheckIn.objects.get(id=checkin.id)
            assert checkin.status == CheckInStatus.IN_PROGRESS
            assert checkin.date_updated > checkin.date_added

    def test_passing(self):
        for path_func in self._get_path_functions():
            monitor = self._create_monitor()
            checkin = MonitorCheckIn.objects.create(
                monitor=monitor, project_id=self.project.id, date_added=monitor.date_added
            )

            path = path_func(monitor, checkin)
            resp = self.client.put(path, data={"status": "ok"})
            assert resp.status_code == 200, resp.content

            checkin = MonitorCheckIn.objects.get(id=checkin.id)
            assert checkin.status == CheckInStatus.OK

            monitor = Monitor.objects.get(id=monitor.id)
            assert monitor.next_checkin > checkin.date_added
            assert monitor.status == MonitorStatus.OK
            assert monitor.last_checkin > checkin.date_added

    def test_failing(self):
        for path_func in self._get_path_functions():
            monitor = self._create_monitor()
            checkin = MonitorCheckIn.objects.create(
                monitor=monitor, project_id=self.project.id, date_added=monitor.date_added
            )

            path = path_func(monitor, checkin)
            resp = self.client.put(path, data={"status": "error"})
            assert resp.status_code == 200, resp.content

            checkin = MonitorCheckIn.objects.get(id=checkin.id)
            assert checkin.status == CheckInStatus.ERROR

            monitor = Monitor.objects.get(id=monitor.id)
            assert monitor.next_checkin > checkin.date_added
            assert monitor.status == MonitorStatus.ERROR
            assert monitor.last_checkin > checkin.date_added

    def test_latest_returns_last_unfinished(self):
        for path_func in self._get_path_functions():
            monitor = self._create_monitor()
            checkin = MonitorCheckIn.objects.create(
                monitor=monitor,
                project_id=self.project.id,
                date_added=monitor.date_added - timedelta(minutes=2),
                status=CheckInStatus.IN_PROGRESS,
            )
            checkin2 = MonitorCheckIn.objects.create(
                monitor=monitor,
                project_id=self.project.id,
                date_added=monitor.date_added - timedelta(minutes=1),
                status=CheckInStatus.IN_PROGRESS,
            )
            checkin3 = MonitorCheckIn.objects.create(
                monitor=monitor,
                project_id=self.project.id,
                date_added=monitor.date_added,
                status=CheckInStatus.OK,
            )

            path = path_func(monitor, self.latest)
            resp = self.client.put(path, data={"status": "ok"})
            assert resp.status_code == 200, resp.content

            checkin = MonitorCheckIn.objects.get(id=checkin.id)
            assert checkin.status == CheckInStatus.IN_PROGRESS

            checkin2 = MonitorCheckIn.objects.get(id=checkin2.id)
            assert checkin2.status == CheckInStatus.OK

            checkin3 = MonitorCheckIn.objects.get(id=checkin3.id)
            assert checkin3.status == CheckInStatus.OK

            monitor = Monitor.objects.get(id=monitor.id)
            assert monitor.next_checkin > checkin2.date_added
            assert monitor.status == MonitorStatus.OK
            assert monitor.last_checkin > checkin2.date_added

    def test_latest_with_no_unfinished_checkin(self):
        for path_func in self._get_path_functions():
            monitor = self._create_monitor()
            MonitorCheckIn.objects.create(
                monitor=monitor,
                project_id=self.project.id,
                date_added=monitor.date_added,
                status=CheckInStatus.OK,
            )

            path = path_func(monitor, self.latest)
            resp = self.client.put(path, data={"status": "ok"})
            assert resp.status_code == 404, resp.content
