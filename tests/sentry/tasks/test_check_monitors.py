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
            config={'schedule': '* * * * *'},
            status=MonitorStatus.OK,
        )

        check_monitors()

        assert Monitor.objects.filter(
            id=monitor.id,
            status=MonitorStatus.ERROR,
        ).exists()

    def test_not_missing_checkin(self):
        org = self.create_organization()
        project = self.create_project(organization=org)

        monitor = Monitor.objects.create(
            organization_id=org.id,
            project_id=project.id,
            next_checkin=timezone.now() + timedelta(minutes=1),
            type=MonitorType.CRON_JOB,
            config={'schedule': '* * * * *'},
            status=MonitorStatus.OK,
        )
        MonitorCheckIn.objects.create(
            monitor=monitor,
            project_id=project.id,
            status=CheckInStatus.OK,
        )

        check_monitors()

        assert Monitor.objects.filter(
            id=monitor.id,
            status=MonitorStatus.OK,
        ).exists()
