from __future__ import absolute_import, print_function

from datetime import timedelta
from django.utils import timezone

from sentry.models import CheckInStatus, Monitor, MonitorCheckIn, MonitorStatus, MonitorType
from sentry.testutils import TestCase
from sentry.tasks.check_monitors import check_monitors


class CheckMonitorsTest(TestCase):
    def test_missing_checkin(self):
        org = self.create_organization()
        project = self.create_project(organization=org)

        monitor = Monitor.objects.create(
            organization_id=org.id,
            project_id=project.id,
            next_checkin=timezone.now() - timedelta(minutes=1),
            type=MonitorType.CRON_JOB,
            config={"schedule": "* * * * *"},
            status=MonitorStatus.OK,
        )

        check_monitors()

        assert Monitor.objects.filter(id=monitor.id, status=MonitorStatus.ERROR).exists()

    def test_missing_checkin_but_disabled(self):
        org = self.create_organization()
        project = self.create_project(organization=org)

        monitor = Monitor.objects.create(
            organization_id=org.id,
            project_id=project.id,
            next_checkin=timezone.now() - timedelta(minutes=1),
            type=MonitorType.CRON_JOB,
            config={"schedule": "* * * * *"},
            status=MonitorStatus.DISABLED,
        )

        check_monitors()

        assert Monitor.objects.filter(id=monitor.id, status=MonitorStatus.DISABLED).exists()

    def test_missing_checkin_but_pending_deletion(self):
        org = self.create_organization()
        project = self.create_project(organization=org)

        monitor = Monitor.objects.create(
            organization_id=org.id,
            project_id=project.id,
            next_checkin=timezone.now() - timedelta(minutes=1),
            type=MonitorType.CRON_JOB,
            config={"schedule": "* * * * *"},
            status=MonitorStatus.PENDING_DELETION,
        )

        check_monitors()

        assert Monitor.objects.filter(id=monitor.id, status=MonitorStatus.PENDING_DELETION).exists()

    def test_missing_checkin_but_deletion_in_progress(self):
        org = self.create_organization()
        project = self.create_project(organization=org)

        monitor = Monitor.objects.create(
            organization_id=org.id,
            project_id=project.id,
            next_checkin=timezone.now() - timedelta(minutes=1),
            type=MonitorType.CRON_JOB,
            config={"schedule": "* * * * *"},
            status=MonitorStatus.DELETION_IN_PROGRESS,
        )

        check_monitors()

        assert Monitor.objects.filter(
            id=monitor.id, status=MonitorStatus.DELETION_IN_PROGRESS
        ).exists()

    def test_not_missing_checkin(self):
        org = self.create_organization()
        project = self.create_project(organization=org)

        monitor = Monitor.objects.create(
            organization_id=org.id,
            project_id=project.id,
            next_checkin=timezone.now() + timedelta(minutes=1),
            type=MonitorType.CRON_JOB,
            config={"schedule": "* * * * *"},
            status=MonitorStatus.OK,
        )
        MonitorCheckIn.objects.create(
            monitor=monitor, project_id=project.id, status=CheckInStatus.OK
        )

        check_monitors()

        assert Monitor.objects.filter(id=monitor.id, status=MonitorStatus.OK).exists()

    def test_timeout_with_no_future_complete_checkin(self):
        org = self.create_organization()
        project = self.create_project(organization=org)

        current_datetime = timezone.now() - timedelta(hours=24)

        monitor = Monitor.objects.create(
            organization_id=org.id,
            project_id=project.id,
            next_checkin=current_datetime + timedelta(hours=12, minutes=1),
            last_checkin=current_datetime + timedelta(hours=12),
            type=MonitorType.CRON_JOB,
            config={"schedule": "0 0 * * *"},
            status=MonitorStatus.OK,
            date_added=current_datetime,
        )
        checkin = MonitorCheckIn.objects.create(
            monitor=monitor,
            project_id=project.id,
            status=CheckInStatus.IN_PROGRESS,
            date_added=current_datetime,
            date_updated=current_datetime,
        )
        checkin2 = MonitorCheckIn.objects.create(
            monitor=monitor,
            project_id=project.id,
            status=CheckInStatus.IN_PROGRESS,
            date_added=monitor.last_checkin,
            date_updated=monitor.last_checkin,
        )

        assert checkin.date_added == checkin.date_updated == current_datetime

        check_monitors(current_datetime=current_datetime + timedelta(hours=12, minutes=1))

        assert MonitorCheckIn.objects.filter(id=checkin.id, status=CheckInStatus.ERROR).exists()

        assert MonitorCheckIn.objects.filter(
            id=checkin2.id, status=CheckInStatus.IN_PROGRESS
        ).exists()

        assert Monitor.objects.filter(id=monitor.id, status=MonitorStatus.ERROR).exists()

    def test_timeout_with_future_complete_checkin(self):
        org = self.create_organization()
        project = self.create_project(organization=org)

        current_datetime = timezone.now() - timedelta(hours=24)

        monitor = Monitor.objects.create(
            organization_id=org.id,
            project_id=project.id,
            next_checkin=current_datetime + timedelta(hours=12, minutes=1),
            last_checkin=current_datetime + timedelta(hours=12),
            type=MonitorType.CRON_JOB,
            config={"schedule": "0 0 * * *"},
            status=MonitorStatus.OK,
            date_added=current_datetime,
        )
        checkin = MonitorCheckIn.objects.create(
            monitor=monitor,
            project_id=project.id,
            status=CheckInStatus.IN_PROGRESS,
            date_added=current_datetime,
            date_updated=current_datetime,
        )
        checkin2 = MonitorCheckIn.objects.create(
            monitor=monitor,
            project_id=project.id,
            status=CheckInStatus.OK,
            date_added=monitor.last_checkin,
            date_updated=monitor.last_checkin,
        )

        assert checkin.date_added == checkin.date_updated == current_datetime

        check_monitors(current_datetime=current_datetime + timedelta(hours=12, minutes=1))

        assert MonitorCheckIn.objects.filter(id=checkin.id, status=CheckInStatus.ERROR).exists()

        assert MonitorCheckIn.objects.filter(id=checkin2.id, status=CheckInStatus.OK).exists()

        assert Monitor.objects.filter(id=monitor.id, status=MonitorStatus.OK).exists()

    def test_timeout_with_via_configuration(self):
        org = self.create_organization()
        project = self.create_project(organization=org)

        current_datetime = timezone.now() - timedelta(hours=24)

        monitor = Monitor.objects.create(
            organization_id=org.id,
            project_id=project.id,
            next_checkin=current_datetime + timedelta(hours=1, minutes=1),
            last_checkin=current_datetime + timedelta(hours=1),
            type=MonitorType.CRON_JOB,
            config={"schedule": "0 0 * * *", "max_runtime": 60},
            status=MonitorStatus.OK,
            date_added=current_datetime,
        )
        checkin = MonitorCheckIn.objects.create(
            monitor=monitor,
            project_id=project.id,
            status=CheckInStatus.IN_PROGRESS,
            date_added=current_datetime,
            date_updated=current_datetime,
        )

        assert checkin.date_added == checkin.date_updated == current_datetime

        check_monitors(current_datetime=current_datetime + timedelta(hours=1, minutes=1))

        assert MonitorCheckIn.objects.filter(id=checkin.id, status=CheckInStatus.ERROR).exists()

        assert Monitor.objects.filter(id=monitor.id, status=MonitorStatus.ERROR).exists()
