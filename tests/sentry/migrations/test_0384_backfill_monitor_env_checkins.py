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

        self.checkin_1 = MonitorCheckIn.objects.create(
            monitor=self.monitor,
            project_id=self.project.id,
            date_added=self.monitor.date_added,
            status=CheckInStatus.OK,
        )

        self.monitor_2 = Monitor.objects.create(
            organization_id=self.organization.id,
            project_id=self.project.id,
            next_checkin=timezone.now() - timedelta(minutes=1),
            type=MonitorType.CRON_JOB,
            config={"schedule": "* * * * *", "schedule_type": ScheduleType.CRONTAB},
        )

        monitorenvironment_defaults_2 = {
            "status": self.monitor_2.status,
            "next_checkin": self.monitor_2.next_checkin,
            "last_checkin": self.monitor_2.last_checkin,
        }

        self.monitor_env_2 = MonitorEnvironment.objects.create(
            monitor=self.monitor_2,
            environment=self.create_environment(name="production", project=self.project),
            **monitorenvironment_defaults_2,
        )
        self.monitor_env_3 = MonitorEnvironment.objects.create(
            monitor=self.monitor_2,
            environment=self.create_environment(name="jungle", project=self.project),
            **monitorenvironment_defaults_2,
        )

        self.checkin_2 = MonitorCheckIn.objects.create(
            monitor=self.monitor_2,
            project_id=self.project.id,
            date_added=self.monitor_2.date_added,
            status=CheckInStatus.OK,
        )

        # add test for duplicate envs

    def test(self):
        self.checkin_1.refresh_from_db()
        self.checkin_2.refresh_from_db()

        assert self.checkin_1.monitor_environment == self.monitor_env
        assert self.checkin_2.monitor_environment == self.monitor_env_3
