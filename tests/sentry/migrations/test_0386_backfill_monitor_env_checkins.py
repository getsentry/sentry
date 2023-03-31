from datetime import timedelta

import pytest
from django.utils import timezone

from sentry.models import ScheduledDeletion
from sentry.monitors.models import (
    CheckInStatus,
    Monitor,
    MonitorCheckIn,
    MonitorEnvironment,
    MonitorType,
    ScheduleType,
)
from sentry.tasks.deletion.scheduled import run_deletion
from sentry.testutils.cases import TestMigrations

DEFAULT_ENVIRONMENT_NAME = "production"


class MigrateMonitorEnvironmentBackfillInitialTest(TestMigrations):
    migrate_from = "0385_service_hook_hc_fk"
    migrate_to = "0386_backfill_monitor_env_checkins"

    def setup_before_migration(self, apps):
        production_env = self.create_environment(name="production", project=self.project)

        # test default behavior
        monitor = Monitor.objects.create(
            organization_id=self.organization.id,
            project_id=self.project.id,
            next_checkin=timezone.now() - timedelta(minutes=1),
            type=MonitorType.CRON_JOB,
            config={"schedule": "* * * * *", "schedule_type": ScheduleType.CRONTAB},
        )

        self.monitor_env_default = MonitorEnvironment.objects.create(
            monitor=monitor,
            environment=production_env,
        )

        self.checkin_default = MonitorCheckIn.objects.create(
            monitor=monitor,
            project_id=self.project.id,
            date_added=monitor.date_added,
            status=CheckInStatus.OK,
        )

        # test behavior with multiple environments
        monitor_multiple_env = Monitor.objects.create(
            organization_id=self.organization.id,
            project_id=self.project.id,
            next_checkin=timezone.now() - timedelta(minutes=1),
            type=MonitorType.CRON_JOB,
            config={"schedule": "* * * * *", "schedule_type": ScheduleType.CRONTAB},
        )

        self.monitor_env_multiple = MonitorEnvironment.objects.create(
            monitor=monitor_multiple_env,
            environment=production_env,
        )
        self.monitor_env_multiple_incorrect = MonitorEnvironment.objects.create(
            monitor=monitor_multiple_env,
            environment=self.create_environment(name="jungle", project=self.project),
        )

        self.checkin_multiple_env = MonitorCheckIn.objects.create(
            monitor=monitor_multiple_env,
            project_id=self.project.id,
            date_added=monitor_multiple_env.date_added,
            status=CheckInStatus.OK,
        )

        # test behavior for projects that have changed orgs

        org_old = self.create_organization()
        project_changed = self.create_project(organization=org_old)
        environment_old = self.create_environment(name="production", project=project_changed)

        monitor_changed = Monitor.objects.create(
            organization_id=org_old.id,
            project_id=project_changed.id,
            next_checkin=timezone.now() - timedelta(minutes=1),
            type=MonitorType.CRON_JOB,
            config={"schedule": "* * * * *", "schedule_type": ScheduleType.CRONTAB},
        )

        self.monitor_env_old = MonitorEnvironment.objects.create(
            monitor=monitor_changed,
            environment=environment_old,
        )

        self.checkin_old = MonitorCheckIn.objects.create(
            monitor=monitor_changed,
            project_id=project_changed.id,
            date_added=monitor_changed.date_added,
            status=CheckInStatus.OK,
        )

        monitor_changed.organization_id = self.organization.id
        monitor_changed.save()
        project_changed.organization = self.organization
        project_changed.save()

        self.monitor_env_new = MonitorEnvironment.objects.create(
            monitor=monitor_changed,
            environment=production_env,
        )

        self.checkin_new = MonitorCheckIn.objects.create(
            monitor=monitor_changed,
            project_id=project_changed.id,
            date_added=monitor_changed.date_added + timedelta(minutes=1),
            status=CheckInStatus.OK,
        )

        # test behavior for checkins with deleted monitors/projects
        project_deleted = self.create_project(organization=self.organization, name="deleted")

        monitor_deleted = Monitor.objects.create(
            organization_id=self.organization.id,
            project_id=project_deleted.id,
            next_checkin=timezone.now() - timedelta(minutes=1),
            type=MonitorType.CRON_JOB,
            config={"schedule": "* * * * *", "schedule_type": ScheduleType.CRONTAB},
        )

        self.checkin_deleted = MonitorCheckIn.objects.create(
            monitor=monitor_deleted,
            project_id=project_deleted.id,
            date_added=monitor_deleted.date_added,
            status=CheckInStatus.OK,
        )

        deletion = ScheduledDeletion.schedule(project_deleted, days=0)
        deletion.update(in_progress=True)

        with self.tasks():
            run_deletion(deletion.id)

    def test(self):
        self.checkin_default.refresh_from_db()
        self.checkin_multiple_env.refresh_from_db()
        self.checkin_old.refresh_from_db()
        self.checkin_new.refresh_from_db()

        assert self.checkin_default.monitor_environment == self.monitor_env_default
        assert self.checkin_multiple_env.monitor_environment == self.monitor_env_multiple
        assert self.checkin_old.monitor_environment == self.monitor_env_new
        assert self.checkin_new.monitor_environment == self.monitor_env_new
        with pytest.raises(MonitorCheckIn.DoesNotExist):
            self.checkin_deleted.refresh_from_db()
