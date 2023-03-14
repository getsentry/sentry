from datetime import timedelta

from django.urls import reverse
from django.utils import timezone

from sentry.models import Environment
from sentry.monitors.models import (
    CheckInStatus,
    Monitor,
    MonitorCheckIn,
    MonitorEnvironment,
    MonitorStatus,
    MonitorType,
)
from sentry.testutils import MonitorIngestTestCase
from sentry.testutils.silo import region_silo_test


@region_silo_test(stable=True)
class UpdateMonitorIngestCheckinTest(MonitorIngestTestCase):
    endpoint = "sentry-api-0-monitor-ingest-check-in-details"
    endpoint_with_org = "sentry-api-0-organization-monitor-check-in-details"

    def setUp(self):
        super().setUp()
        self.latest = lambda: None
        self.latest.guid = "latest"

    def _get_path_functions(self):
        # Monitor paths are supported both with an org slug and without.  We test both as long as we support both.
        # Because removing old urls takes time and consideration of the cost of breaking lingering references, a
        # decision to permanently remove either path schema is a TODO.
        return (
            lambda monitor_id, checkin_id: reverse(self.endpoint, args=[monitor_id, checkin_id]),
            lambda monitor_id, checkin_id: reverse(
                self.endpoint_with_org, args=[self.organization.slug, monitor_id, checkin_id]
            ),
        )

    def _create_monitor(self):
        return Monitor.objects.create(
            slug="my-monitor",
            organization_id=self.organization.id,
            project_id=self.project.id,
            next_checkin=timezone.now() - timedelta(minutes=1),
            type=MonitorType.CRON_JOB,
            config={"schedule": "* * * * *"},
            date_added=timezone.now() - timedelta(minutes=1),
        )

    def _create_monitor_environment(self, monitor):
        environment = Environment.get_or_create(project=self.project, name="production")

        monitorenvironment_defaults = {
            "status": monitor.status,
            "next_checkin": monitor.next_checkin,
            "last_checkin": monitor.last_checkin,
        }

        return MonitorEnvironment.objects.create(
            monitor=monitor, environment=environment, **monitorenvironment_defaults
        )

    def test_noop_in_progress(self):
        monitor = self._create_monitor()
        monitor_environment = self._create_monitor_environment(monitor)
        for path_func in self._get_path_functions():
            checkin = MonitorCheckIn.objects.create(
                monitor=monitor,
                monitor_environment=monitor_environment,
                project_id=self.project.id,
                date_added=monitor.date_added,
                status=CheckInStatus.IN_PROGRESS,
            )

            path = path_func(monitor.guid, checkin.guid)
            resp = self.client.put(path, **self.token_auth_headers)
            assert resp.status_code == 200, resp.content

            checkin = MonitorCheckIn.objects.get(id=checkin.id)
            assert checkin.status == CheckInStatus.IN_PROGRESS
            assert checkin.date_updated > checkin.date_added

    def test_passing(self):
        monitor = self._create_monitor()
        monitor_environment = self._create_monitor_environment(monitor)
        for path_func in self._get_path_functions():
            checkin = MonitorCheckIn.objects.create(
                monitor=monitor,
                monitor_environment=monitor_environment,
                project_id=self.project.id,
                date_added=monitor.date_added,
            )

            path = path_func(monitor.guid, checkin.guid)
            resp = self.client.put(path, data={"status": "ok"}, **self.token_auth_headers)
            assert resp.status_code == 200, resp.content

            checkin = MonitorCheckIn.objects.get(id=checkin.id)
            assert checkin.status == CheckInStatus.OK

            monitor = Monitor.objects.get(id=monitor.id)
            assert monitor.next_checkin > checkin.date_added
            assert monitor.status == MonitorStatus.OK
            assert monitor.last_checkin > checkin.date_added

            monitor_environment = MonitorEnvironment.objects.get(id=monitor_environment.id)
            assert monitor_environment.next_checkin > checkin.date_added
            assert monitor_environment.status == MonitorStatus.OK
            assert monitor_environment.last_checkin > checkin.date_added

    def test_passing_with_slug(self):
        monitor = self._create_monitor()
        checkin = MonitorCheckIn.objects.create(
            monitor=monitor, project_id=self.project.id, date_added=monitor.date_added
        )

        path = reverse(
            self.endpoint_with_org, args=[self.organization.slug, monitor.slug, checkin.guid]
        )
        resp = self.client.put(path, data={"status": "ok"}, **self.token_auth_headers)
        assert resp.status_code == 200, resp.content

        checkin = MonitorCheckIn.objects.get(id=checkin.id)
        assert checkin.status == CheckInStatus.OK

    def test_failing(self):
        monitor = self._create_monitor()
        monitor_environment = self._create_monitor_environment(monitor)
        for path_func in self._get_path_functions():
            checkin = MonitorCheckIn.objects.create(
                monitor=monitor,
                monitor_environment=monitor_environment,
                project_id=self.project.id,
                date_added=monitor.date_added,
            )

            path = path_func(monitor.guid, checkin.guid)
            resp = self.client.put(path, data={"status": "error"}, **self.token_auth_headers)
            assert resp.status_code == 200, resp.content

            checkin = MonitorCheckIn.objects.get(id=checkin.id)
            assert checkin.status == CheckInStatus.ERROR

            monitor = Monitor.objects.get(id=monitor.id)
            assert monitor.next_checkin > checkin.date_added
            assert monitor.status == MonitorStatus.ERROR
            assert monitor.last_checkin > checkin.date_added

            monitor_environment = MonitorEnvironment.objects.get(id=monitor_environment.id)
            assert monitor_environment.next_checkin > checkin.date_added
            assert monitor_environment.status == MonitorStatus.ERROR
            assert monitor_environment.last_checkin > checkin.date_added

    def test_latest_returns_last_unfinished(self):
        monitor = self._create_monitor()
        monitor_environment = self._create_monitor_environment(monitor)
        for path_func in self._get_path_functions():
            checkin = MonitorCheckIn.objects.create(
                monitor=monitor,
                monitor_environment=monitor_environment,
                project_id=self.project.id,
                date_added=monitor.date_added - timedelta(minutes=2),
                status=CheckInStatus.IN_PROGRESS,
            )
            checkin2 = MonitorCheckIn.objects.create(
                monitor=monitor,
                monitor_environment=monitor_environment,
                project_id=self.project.id,
                date_added=monitor.date_added - timedelta(minutes=1),
                status=CheckInStatus.IN_PROGRESS,
            )
            checkin3 = MonitorCheckIn.objects.create(
                monitor=monitor,
                monitor_environment=monitor_environment,
                project_id=self.project.id,
                date_added=monitor.date_added,
                status=CheckInStatus.OK,
            )

            path = path_func(monitor.guid, self.latest.guid)
            resp = self.client.put(path, data={"status": "ok"}, **self.token_auth_headers)
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

            monitor_environment = MonitorEnvironment.objects.get(id=monitor_environment.id)
            assert monitor_environment.next_checkin > checkin2.date_added
            assert monitor_environment.status == MonitorStatus.OK
            assert monitor_environment.last_checkin > checkin2.date_added

    def test_latest_with_no_unfinished_checkin(self):
        monitor = self._create_monitor()
        monitor_environment = self._create_monitor_environment(monitor)
        for path_func in self._get_path_functions():
            MonitorCheckIn.objects.create(
                monitor=monitor,
                monitor_environment=monitor_environment,
                project_id=self.project.id,
                date_added=monitor.date_added,
                status=CheckInStatus.OK,
            )

            path = path_func(monitor.guid, self.latest.guid)
            resp = self.client.put(path, data={"status": "ok"}, **self.token_auth_headers)
            assert resp.status_code == 404, resp.content

    def test_invalid_checkin_id(self):
        monitor = self._create_monitor()
        monitor_environment = self._create_monitor_environment(monitor)
        for path_func in self._get_path_functions():
            MonitorCheckIn.objects.create(
                monitor=monitor,
                monitor_environment=monitor_environment,
                project_id=self.project.id,
                date_added=monitor.date_added,
                status=CheckInStatus.OK,
            )

            path = path_func("invalid-guid", self.latest.guid)
            resp = self.client.put(path, data={"status": "ok"}, **self.token_auth_headers)
            assert resp.status_code == 400, resp.content
