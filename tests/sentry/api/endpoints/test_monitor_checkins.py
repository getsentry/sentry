from datetime import timedelta
from uuid import UUID

from django.utils import timezone
from freezegun import freeze_time

from sentry.models import CheckInStatus, Monitor, MonitorCheckIn, MonitorStatus, MonitorType
from sentry.testutils import MonitorTestCase
from sentry.testutils.silo import region_silo_test


@region_silo_test(stable=True)
@freeze_time()
class CreateMonitorCheckInTest(MonitorTestCase):
    endpoint = "sentry-api-0-monitor-check-in-index"
    endpoint_with_org = "sentry-api-0-monitor-check-in-index-with-org"

    def setUp(self):
        super().setUp()

    def test_passing(self):
        self.login_as(self.user)

        for path_func in self._get_path_functions():
            monitor = self._create_monitor()
            path = path_func(monitor)

            resp = self.client.post(path, {"status": "ok"})
            assert resp.status_code == 201, resp.content

            checkin = MonitorCheckIn.objects.get(guid=resp.data["id"])
            assert checkin.status == CheckInStatus.OK

            monitor = Monitor.objects.get(id=monitor.id)
            assert monitor.status == MonitorStatus.OK
            assert monitor.last_checkin == checkin.date_added
            assert monitor.next_checkin == monitor.get_next_scheduled_checkin(checkin.date_added)

    def test_failing(self):
        self.login_as(self.user)

        for path_func in self._get_path_functions():
            monitor = self._create_monitor()
            path = path_func(monitor)

            resp = self.client.post(path, {"status": "error"})
            assert resp.status_code == 201, resp.content

            checkin = MonitorCheckIn.objects.get(guid=resp.data["id"])
            assert checkin.status == CheckInStatus.ERROR

            monitor = Monitor.objects.get(id=monitor.id)
            assert monitor.status == MonitorStatus.ERROR
            assert monitor.last_checkin == checkin.date_added
            assert monitor.next_checkin == monitor.get_next_scheduled_checkin(checkin.date_added)

    def test_disabled(self):
        self.login_as(self.user)

        for path_func in self._get_path_functions():
            monitor = Monitor.objects.create(
                organization_id=self.organization.id,
                project_id=self.project.id,
                next_checkin=timezone.now() - timedelta(minutes=1),
                type=MonitorType.CRON_JOB,
                status=MonitorStatus.DISABLED,
                config={"schedule": "* * * * *"},
            )
            path = path_func(monitor)

            resp = self.client.post(path, {"status": "error"})
            assert resp.status_code == 201, resp.content

            checkin = MonitorCheckIn.objects.get(guid=resp.data["id"])
            assert checkin.status == CheckInStatus.ERROR

            monitor = Monitor.objects.get(id=monitor.id)
            assert monitor.status == MonitorStatus.DISABLED
            assert monitor.last_checkin == checkin.date_added
            assert monitor.next_checkin == monitor.get_next_scheduled_checkin(checkin.date_added)

    def test_pending_deletion(self):
        self.login_as(self.user)

        monitor = Monitor.objects.create(
            organization_id=self.organization.id,
            project_id=self.project.id,
            next_checkin=timezone.now() - timedelta(minutes=1),
            type=MonitorType.CRON_JOB,
            status=MonitorStatus.PENDING_DELETION,
            config={"schedule": "* * * * *"},
        )

        for path_func in self._get_path_functions():
            path = path_func(monitor)

            resp = self.client.post(path, {"status": "error"})
            assert resp.status_code == 404

    def test_deletion_in_progress(self):
        self.login_as(self.user)

        monitor = Monitor.objects.create(
            organization_id=self.organization.id,
            project_id=self.project.id,
            next_checkin=timezone.now() - timedelta(minutes=1),
            type=MonitorType.CRON_JOB,
            status=MonitorStatus.DELETION_IN_PROGRESS,
            config={"schedule": "* * * * *"},
        )

        for path_func in self._get_path_functions():
            path = path_func(monitor)

            resp = self.client.post(path, {"status": "error"})
            assert resp.status_code == 404

    def test_with_dsn_auth(self):
        project_key = self.create_project_key(project=self.project)

        for path_func in self._get_path_functions():
            monitor = self._create_monitor()
            path = path_func(monitor)

            resp = self.client.post(
                path, {"status": "ok"}, HTTP_AUTHORIZATION=f"DSN {project_key.dsn_public}"
            )
            assert resp.status_code == 201, resp.content

            # DSN auth should only return id
            assert list(resp.data.keys()) == ["id"]
            assert UUID(resp.data["id"])

    def test_with_dsn_auth_invalid_project(self):
        project2 = self.create_project()
        project_key = self.create_project_key(project=self.project)

        monitor = Monitor.objects.create(
            organization_id=project2.organization_id,
            project_id=project2.id,
            next_checkin=timezone.now() - timedelta(minutes=1),
            type=MonitorType.CRON_JOB,
            config={"schedule": "* * * * *"},
        )

        for path_func in self._get_path_functions():
            path = path_func(monitor)

            resp = self.client.post(
                path,
                {"status": "ok"},
                HTTP_AUTHORIZATION=f"DSN {project_key.dsn_public}",
            )

            assert resp.status_code == 400, resp.content

    def test_mismatched_org_slugs(self):
        monitor = self._create_monitor()
        path = f"/api/0/monitors/asdf/{monitor.guid}/checkins/"
        self.login_as(user=self.user)

        resp = self.client.post(path)

        assert resp.status_code == 400
