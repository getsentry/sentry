from datetime import timedelta

from django.core.files.base import ContentFile
from django.urls import reverse
from django.utils import timezone

from sentry.monitors.models import CheckInStatus, Monitor, MonitorCheckIn, MonitorType
from sentry.testutils import APITestCase
from sentry.testutils.silo import region_silo_test


@region_silo_test(stable=True)
class OrganizationMonitorCheckInAttachmentEndpointTest(APITestCase):
    endpoint = "sentry-api-0-organization-monitor-check-in-attachment"

    def setUp(self):
        super().setUp()
        self.login_as(self.user)

    def _path_func(self, monitor, checkin):
        return reverse(self.endpoint, args=[self.organization.slug, monitor.guid, checkin.guid])

    def _create_monitor(self):
        return Monitor.objects.create(
            organization_id=self.organization.id,
            project_id=self.project.id,
            next_checkin=timezone.now() - timedelta(minutes=1),
            type=MonitorType.CRON_JOB,
            config={"schedule": "* * * * *"},
            date_added=timezone.now() - timedelta(minutes=1),
        )

    def test_download(self):
        file = self.create_file(name="log.txt", type="checkin.attachment")
        file.putfile(ContentFile(b"some data!"))

        monitor = self._create_monitor()
        checkin = MonitorCheckIn.objects.create(
            monitor=monitor,
            project_id=self.project.id,
            date_added=monitor.date_added,
            status=CheckInStatus.IN_PROGRESS,
            attachment_id=file.id,
        )

        resp = self.get_success_response(self.organization.slug, monitor.slug, checkin.guid)
        assert resp.get("Content-Disposition") == "attachment; filename=log.txt"
        assert b"".join(resp.streaming_content) == b"some data!"

    def test_download_no_file(self):
        monitor = self._create_monitor()
        checkin = MonitorCheckIn.objects.create(
            monitor=monitor,
            project_id=self.project.id,
            date_added=monitor.date_added,
            status=CheckInStatus.IN_PROGRESS,
        )

        resp = self.get_error_response(
            self.organization.slug, monitor.slug, checkin.guid, status_code=404
        )
        assert resp.data["detail"] == "Check-in has no attachment"
