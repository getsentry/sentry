from datetime import timedelta
from unittest import mock

from django.core.files.uploadedfile import SimpleUploadedFile
from django.urls import reverse
from django.utils import timezone

from sentry.models import File
from sentry.monitors.models import CheckInStatus, Monitor, MonitorCheckIn, MonitorType
from sentry.testutils import MonitorIngestTestCase
from sentry.testutils.silo import region_silo_test


@region_silo_test(stable=True)
class MonitorIngestCheckinAttachmentEndpointTest(MonitorIngestTestCase):
    endpoint = "sentry-api-0-organization-monitor-check-in-attachment"

    def get_path(self, monitor, checkin):
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

        path = self.get_path(monitor, checkin)
        resp = self.client.post(
            path,
            {
                "file": SimpleUploadedFile(
                    "log.txt", b"test log data", content_type="application/text"
                ),
            },
            format="multipart",
            **self.token_auth_headers,
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

        path = self.get_path(monitor, checkin)
        resp = self.client.post(
            path,
            {},
            format="multipart",
            **self.token_auth_headers,
        )

        assert resp.status_code == 400
        assert resp.data["detail"] == "Missing uploaded file"

    @mock.patch(
        "sentry.monitors.endpoints.monitor_ingest_checkin_attachment.MAX_ATTACHMENT_SIZE", 1
    )
    def test_upload_file_too_big(self):
        monitor = self._create_monitor()
        checkin = MonitorCheckIn.objects.create(
            monitor=monitor,
            project_id=self.project.id,
            date_added=monitor.date_added,
            status=CheckInStatus.IN_PROGRESS,
        )

        path = self.get_path(monitor, checkin)
        resp = self.client.post(
            path,
            {
                "file": SimpleUploadedFile(
                    "log.txt", b"test log data", content_type="application/text"
                ),
            },
            format="multipart",
            **self.token_auth_headers,
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

        path = self.get_path(monitor, checkin)
        resp = self.client.post(
            path,
            {
                "file": SimpleUploadedFile(
                    "log.txt", b"test log data", content_type="application/text"
                ),
            },
            format="multipart",
            **self.token_auth_headers,
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
            **self.token_auth_headers,
        )

        assert resp.status_code == 400
        assert resp.data["detail"] == "Check-in already has an attachment"

    def test_invalid_file_upload(self):
        monitor = self._create_monitor()
        checkin = MonitorCheckIn.objects.create(
            monitor=monitor,
            project_id=self.project.id,
            date_added=monitor.date_added,
            status=CheckInStatus.IN_PROGRESS,
        )

        path = self.get_path(monitor, checkin)
        resp = self.client.post(
            path,
            {"file": "invalid_file"},
            format="multipart",
            **self.token_auth_headers,
        )

        assert resp.status_code == 400
        assert resp.data["detail"] == "Please upload a valid file object"
