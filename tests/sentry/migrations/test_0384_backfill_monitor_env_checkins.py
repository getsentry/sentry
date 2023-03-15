from datetime import timedelta

from django.utils import timezone

from sentry.monitors.models import (
    CheckInStatus,
    Monitor,
    MonitorCheckIn,
    MonitorEnvironment,
    MonitorType,
    ScheduleType,
)
from sentry.testutils.cases import TestMigrations

DEFAULT_ENVIRONMENT_NAME = "production"


class MigrateMonitorEnvironmentBackfillInitialTest(TestMigrations):
    migrate_from = "0383_mv_user_avatar"
    migrate_to = "0384_backfill_monitor_env_checkins"

    def setup_before_migration(self, apps):
        self.monitor = Monitor.objects.create(
            organization_id=self.organization.id,
            project_id=self.project.id,
            next_checkin=timezone.now() - timedelta(minutes=1),
            type=MonitorType.CRON_JOB,
            config={"schedule": "* * * * *", "schedule_type": ScheduleType.CRONTAB},
        )

        monitorenvironment_defaults = {
            "status": self.monitor.status,
            "next_checkin": self.monitor.next_checkin,
            "last_checkin": self.monitor.last_checkin,
        }

        self.monitor_env = MonitorEnvironment.objects.create(
            monitor=self.monitor, environment=self.environment, **monitorenvironment_defaults
        )

        self.checkin = MonitorCheckIn.objects.create(
            monitor=self.monitor,
            project_id=self.project.id,
            date_added=self.monitor.date_added,
            status=CheckInStatus.OK,
        )

        empty_monitor = Monitor.objects.create(
            organization_id=self.organization.id,
            project_id=self.project.id,
            next_checkin=timezone.now() - timedelta(minutes=1),
            type=MonitorType.CRON_JOB,
            config={"schedule": "* * * * *", "schedule_type": ScheduleType.CRONTAB},
        )

        self.empty_checkin = MonitorCheckIn.objects.create(
            monitor=empty_monitor,
            project_id=self.project.id,
            date_added=empty_monitor.date_added,
            status=CheckInStatus.OK,
        )

    def test(self):
        self.checkin.refresh_from_db()
        self.empty_checkin.refresh_from_db()

        assert self.checkin.monitor_environment == self.monitor_env

        assert self.empty_checkin.monitor_environment is None
