from datetime import timedelta
from uuid import UUID

from django.utils import timezone
from freezegun import freeze_time
from rest_framework import status

from sentry.models import CheckInStatus, Monitor, MonitorCheckIn, MonitorStatus, MonitorType
from sentry.testutils import APITestCase


@freeze_time()
class CreateMonitorCheckInTest(APITestCase):
    endpoint = "sentry-api-0-monitor-check-in-index"
    method = "post"

    def test_passing(self):
        self.login_as(self.user)

        monitor = Monitor.objects.create(
            organization_id=self.organization.id,
            project_id=self.project.id,
            next_checkin=timezone.now() - timedelta(minutes=1),
            type=MonitorType.CRON_JOB,
            config={"schedule": "* * * * *"},
        )

        with self.feature("organizations:monitors"):
            response = self.get_success_response(monitor.guid, status="ok")

        checkin = MonitorCheckIn.objects.get(guid=response.data["id"])
        assert checkin.status == CheckInStatus.OK

        monitor = Monitor.objects.get(id=monitor.id)
        assert monitor.status == MonitorStatus.OK
        assert monitor.last_checkin == checkin.date_added
        assert monitor.next_checkin == monitor.get_next_scheduled_checkin(checkin.date_added)

    def test_failing(self):
        self.login_as(self.user)

        monitor = Monitor.objects.create(
            organization_id=self.organization.id,
            project_id=self.project.id,
            next_checkin=timezone.now() - timedelta(minutes=1),
            type=MonitorType.CRON_JOB,
            config={"schedule": "* * * * *"},
        )

        with self.feature("organizations:monitors"):
            response = self.get_success_response(monitor.guid, status="error")

        checkin = MonitorCheckIn.objects.get(guid=response.data["id"])
        assert checkin.status == CheckInStatus.ERROR

        monitor = Monitor.objects.get(id=monitor.id)
        assert monitor.status == MonitorStatus.ERROR
        assert monitor.last_checkin == checkin.date_added
        assert monitor.next_checkin == monitor.get_next_scheduled_checkin(checkin.date_added)

    def test_disabled(self):
        self.login_as(self.user)

        monitor = Monitor.objects.create(
            organization_id=self.organization.id,
            project_id=self.project.id,
            next_checkin=timezone.now() - timedelta(minutes=1),
            type=MonitorType.CRON_JOB,
            status=MonitorStatus.DISABLED,
            config={"schedule": "* * * * *"},
        )

        with self.feature("organizations:monitors"):
            response = self.get_success_response(monitor.guid, status="error")

        assert response.status_code == 201, response.content

        checkin = MonitorCheckIn.objects.get(guid=response.data["id"])
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

        with self.feature("organizations:monitors"):
            self.get_error_response(
                monitor.guid,
                status="error",
                status_code=status.HTTP_404_NOT_FOUND,
            )

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

        with self.feature("organizations:monitors"):
            self.get_error_response(
                monitor.guid,
                status="error",
                status_code=status.HTTP_404_NOT_FOUND,
            )

    def test_with_dsn_auth(self):
        project_key = self.create_project_key(project=self.project)

        monitor = Monitor.objects.create(
            organization_id=self.organization.id,
            project_id=self.project.id,
            next_checkin=timezone.now() - timedelta(minutes=1),
            type=MonitorType.CRON_JOB,
            config={"schedule": "* * * * *"},
        )

        with self.feature("organizations:monitors"):
            response = self.get_success_response(
                monitor.guid,
                status="ok",
                extra_headers={"HTTP_AUTHORIZATION": f"DSN {project_key.dsn_public}"},
            )

        # DSN auth should only return id
        assert list(response.data.keys()) == ["id"]
        assert UUID(response.data["id"])

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

        with self.feature("organizations:monitors"):
            self.get_error_response(
                monitor.guid,
                status="ok",
                extra_headers={"HTTP_AUTHORIZATION": f"DSN {project_key.dsn_public}"},
                status_code=status.HTTP_400_BAD_REQUEST,
            )
