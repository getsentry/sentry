from datetime import timedelta

from django.utils import timezone

from sentry.models import CheckInStatus, Monitor, MonitorCheckIn, MonitorStatus, MonitorType
from sentry.testutils import APITestCase
from sentry.testutils.silo import region_silo_test


@region_silo_test(stable=True)
class UpdateMonitorCheckInTest(APITestCase):
    endpoint = "sentry-api-0-monitor-check-in-details"
    method = "put"

    def setUp(self):
        super().setUp()
        self.login_as(self.user)

    def test_noop_in_progerss(self):
        monitor = Monitor.objects.create(
            organization_id=self.organization.id,
            project_id=self.project.id,
            next_checkin=timezone.now() - timedelta(minutes=1),
            type=MonitorType.CRON_JOB,
            config={"schedule": "* * * * *"},
            date_added=timezone.now() - timedelta(minutes=1),
        )
        checkin = MonitorCheckIn.objects.create(
            monitor=monitor,
            project_id=self.project.id,
            date_added=monitor.date_added,
            status=CheckInStatus.IN_PROGRESS,
        )

        self.get_success_response(monitor.guid, checkin.guid)

        checkin = MonitorCheckIn.objects.get(id=checkin.id)
        assert checkin.status == CheckInStatus.IN_PROGRESS
        assert checkin.date_updated > checkin.date_added

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

        self.get_success_response(monitor.guid, checkin.guid, status="error")

        checkin = MonitorCheckIn.objects.get(id=checkin.id)
        assert checkin.status == CheckInStatus.ERROR

        monitor = Monitor.objects.get(id=monitor.id)
        assert monitor.next_checkin > checkin.date_added
        assert monitor.status == MonitorStatus.ERROR
        assert monitor.last_checkin > checkin.date_added

    def test_latest_returns_last_unfinished(self):
        monitor = Monitor.objects.create(
            organization_id=self.organization.id,
            project_id=self.project.id,
            next_checkin=timezone.now() - timedelta(minutes=1),
            type=MonitorType.CRON_JOB,
            config={"schedule": "* * * * *"},
            date_added=timezone.now() - timedelta(minutes=1),
        )
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
        self.get_success_response(monitor.guid, "latest", status="ok")

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
        monitor = Monitor.objects.create(
            organization_id=self.organization.id,
            project_id=self.project.id,
            next_checkin=timezone.now() - timedelta(minutes=1),
            type=MonitorType.CRON_JOB,
            config={"schedule": "* * * * *"},
            date_added=timezone.now() - timedelta(minutes=1),
        )
        MonitorCheckIn.objects.create(
            monitor=monitor,
            project_id=self.project.id,
            date_added=monitor.date_added,
            status=CheckInStatus.OK,
        )

        self.get_error_response(monitor.guid, "latest", status="ok")
