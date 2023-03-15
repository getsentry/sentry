from django.core.files.base import ContentFile

from sentry.monitors.models import CheckInStatus, MonitorCheckIn
from sentry.testutils import MonitorTestCase
from sentry.testutils.silo import region_silo_test


@region_silo_test(stable=True)
class OrganizationMonitorCheckInAttachmentEndpointTest(MonitorTestCase):
    endpoint = "sentry-api-0-organization-monitor-check-in-attachment"

    def setUp(self):
        super().setUp()
        self.login_as(self.user)

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
