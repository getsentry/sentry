from datetime import timedelta

from django.utils import timezone

from sentry.monitors.models import CheckInStatus, Monitor, MonitorCheckIn, MonitorType, ScheduleType
from sentry.testutils.cases import TestMigrations


class MigrateMonitorEnvironmentBackfillTest(TestMigrations):
    migrate_from = "0373_dist_id_to_name"
    migrate_to = "0374_backfill_monitor_environments"

    def setup_before_migration(self, apps):
        self.monitor = Monitor.objects.create(
            organization_id=self.organization.id,
            project_id=self.project.id,
            next_checkin=timezone.now() - timedelta(minutes=1),
            type=MonitorType.CRON_JOB,
            config={"schedule": "* * * * *", "schedule_type": ScheduleType.CRONTAB},
        )
        self.checkin = MonitorCheckIn.objects.create(
            monitor=self.monitor,
            project_id=self.project.id,
            date_added=self.monitor.date_added,
            status=CheckInStatus.IN_PROGRESS,
        )

    def test(self):
        self.checkin.refresh_from_db()
        monitor_environment = self.checkin.monitor_environment

        assert monitor_environment is not None
        assert monitor_environment.monitor == self.monitor
        assert monitor_environment.environment.name == "production"
        assert monitor_environment.status == self.monitor.status
