from datetime import timedelta
from unittest import mock

from django.core.files.uploadedfile import SimpleUploadedFile
from django.urls import reverse
from django.utils import timezone

from sentry.models import CheckInStatus, File, Monitor, MonitorCheckIn, MonitorType
from sentry.testutils import APITestCase
from sentry.testutils.silo import region_silo_test


@region_silo_test(stable=True)
class UploadMonitorCheckInAttachmentTest(APITestCase):
    endpoint = "sentry-api-0-monitor-check-in-attachment-with-org"

    def setUp(self):
        super().setUp()
        self.login_as(self.user)
        self.latest = lambda: None
        self.latest.guid = "latest"

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

    def test_upload(self):
        monitor = self._create_monitor()
        checkin = MonitorCheckIn.objects.create(
            monitor=monitor,
            project_id=self.project.id,
            date_added=monitor.date_added,
            status=CheckInStatus.IN_PROGRESS,
        )

        path = self._path_func(monitor, checkin)
        resp = self.client.post(
            path,
            {
                "file": SimpleUploadedFile(
                    "log.txt", b"test log data", content_type="application/text"
                ),
            },
            format="multipart",
        )

        assert resp.status_code == 200, resp.content

        checkin = MonitorCheckIn.objects.get(id=checkin.id)

        assert checkin.status == CheckInStatus.IN_PROGRESS
        file = File.objects.get(id=checkin.attachment_id)
        assert file.name == "log.txt"
        assert file.getfile().read() == b"test log data"

    def test_upload_no_file(self):
        monitor = self._create_monitor()
        checkin = MonitorCheckIn.objects.create(
            monitor=monitor,
            project_id=self.project.id,
            date_added=monitor.date_added,
            status=CheckInStatus.IN_PROGRESS,
        )

        path = self._path_func(monitor, checkin)
        resp = self.client.post(
            path,
            {},
            format="multipart",
        )

        assert resp.status_code == 400
        assert resp.data["detail"] == "Missing uploaded file"

    @mock.patch("sentry.api.endpoints.monitor_checkin_attachment.MAX_ATTACHMENT_SIZE", 1)
    def test_upload_file_too_big(self):
        monitor = self._create_monitor()
        checkin = MonitorCheckIn.objects.create(
            monitor=monitor,
            project_id=self.project.id,
            date_added=monitor.date_added,
            status=CheckInStatus.IN_PROGRESS,
        )

        path = self._path_func(monitor, checkin)
        resp = self.client.post(
            path,
            {
                "file": SimpleUploadedFile(
                    "log.txt", b"test log data", content_type="application/text"
                ),
            },
            format="multipart",
        )

        assert resp.status_code == 400
        assert resp.data["detail"] == "Please keep uploads below 100kb"

    def test_duplicate_upload(self):
        monitor = self._create_monitor()
        checkin = MonitorCheckIn.objects.create(
            monitor=monitor,
            project_id=self.project.id,
            date_added=monitor.date_added,
            status=CheckInStatus.IN_PROGRESS,
        )

        path = self._path_func(monitor, checkin)
        resp = self.client.post(
            path,
            {
                "file": SimpleUploadedFile(
                    "log.txt", b"test log data", content_type="application/text"
                ),
            },
            format="multipart",
        )

        assert resp.status_code == 200, resp.content

        checkin = MonitorCheckIn.objects.get(id=checkin.id)

        assert checkin.status == CheckInStatus.IN_PROGRESS
        file = File.objects.get(id=checkin.attachment_id)
        assert file.name == "log.txt"
        assert file.getfile().read() == b"test log data"

        resp = self.client.post(
            path,
            {
                "file": SimpleUploadedFile(
                    "log.txt", b"test log data", content_type="application/text"
                ),
            },
            format="multipart",
        )

        assert resp.status_code == 400
        assert resp.data["detail"] == "Check-in already has an attachment"
