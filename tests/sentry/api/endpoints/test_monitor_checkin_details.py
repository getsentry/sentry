from datetime import timedelta

from django.utils import timezone

from sentry.models import CheckInStatus, Monitor, MonitorCheckIn, MonitorStatus, MonitorType
from sentry.testutils import APITestCase


class UpdateMonitorCheckInTest(APITestCase):
    endpoint = "sentry-api-0-monitor-check-in-details"
    method = "put"

    def setUp(self):
        super().setUp()
        self.login_as(self.user)

    def test_passing(self):
        monitor = Monitor.objects.create(
            organization_id=self.organization.id,
            project_id=self.project.id,
            next_checkin=timezone.now() - timedelta(minutes=1),
            type=MonitorType.CRON_JOB,
            config={"schedule": "* * * * *"},
            date_added=timezone.now() - timedelta(minutes=1),
        )
        checkin = MonitorCheckIn.objects.create(
            monitor=monitor, project_id=self.project.id, date_added=monitor.date_added
        )

        with self.feature({"organizations:monitors": True}):
            self.get_success_response(monitor.guid, checkin.guid, status="ok")

        checkin = MonitorCheckIn.objects.get(id=checkin.id)
        assert checkin.status == CheckInStatus.OK

        monitor = Monitor.objects.get(id=monitor.id)
        assert monitor.next_checkin > checkin.date_added
        assert monitor.status == MonitorStatus.OK
        assert monitor.last_checkin > checkin.date_added

    def test_failing(self):
        monitor = Monitor.objects.create(
            organization_id=self.organization.id,
            project_id=self.project.id,
            next_checkin=timezone.now() - timedelta(minutes=1),
            type=MonitorType.CRON_JOB,
            config={"schedule": "* * * * *"},
            date_added=timezone.now() - timedelta(minutes=1),
        )
        checkin = MonitorCheckIn.objects.create(
            monitor=monitor, project_id=self.project.id, date_added=monitor.date_added
        )

        with self.feature({"organizations:monitors": True}):
            self.get_success_response(monitor.guid, checkin.guid, status="error")

        checkin = MonitorCheckIn.objects.get(id=checkin.id)
        assert checkin.status == CheckInStatus.ERROR

        monitor = Monitor.objects.get(id=monitor.id)
        assert monitor.next_checkin > checkin.date_added
        assert monitor.status == MonitorStatus.ERROR
        assert monitor.last_checkin > checkin.date_added
