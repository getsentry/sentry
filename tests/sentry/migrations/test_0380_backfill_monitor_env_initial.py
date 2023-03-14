from datetime import timedelta

import pytest
from django.utils import timezone

from sentry.models import Environment, EnvironmentProject, Project
from sentry.monitors.models import (
    Monitor,
    MonitorEnvironment,
    MonitorStatus,
    MonitorType,
    ScheduleType,
)
from sentry.testutils.cases import TestMigrations

DEFAULT_ENVIRONMENT_NAME = "production"


class MigrateMonitorEnvironmentBackfillInitialTest(TestMigrations):
    migrate_from = "0379_create_notificationaction_model"
    migrate_to = "0380_backfill_monitor_env_initial"

    def setup_before_migration(self, apps):
        self.monitor = Monitor.objects.create(
            organization_id=self.organization.id,
            project_id=self.project.id,
            next_checkin=timezone.now() - timedelta(minutes=1),
            type=MonitorType.CRON_JOB,
            config={"schedule": "* * * * *", "schedule_type": ScheduleType.CRONTAB},
        )

        self.deleted_project = self.create_project(
            name="Delete", slug="delete", teams=[self.team], fire_project_created=True
        )

        self.orphaned_monitor = Monitor.objects.create(
            organization_id=self.organization.id,
            project_id=self.deleted_project.id,
            next_checkin=timezone.now() - timedelta(minutes=1),
            type=MonitorType.CRON_JOB,
            config={"schedule": "* * * * *", "schedule_type": ScheduleType.CRONTAB},
        )

        self.deleted_project.delete()

        self.deleting_monitor = Monitor.objects.create(
            organization_id=self.organization.id,
            project_id=self.project.id,
            next_checkin=timezone.now() - timedelta(minutes=1),
            type=MonitorType.CRON_JOB,
            config={"schedule": "* * * * *", "schedule_type": ScheduleType.CRONTAB},
            status=MonitorStatus.PENDING_DELETION,
        )

    def test(self):
        environment = Environment.objects.get(name=DEFAULT_ENVIRONMENT_NAME)

        assert environment is not None
        assert environment.name == DEFAULT_ENVIRONMENT_NAME

        environment_project = EnvironmentProject.objects.get(
            environment=environment, project_id=self.monitor.project_id
        )
        assert environment_project is not None

        monitor_environment = MonitorEnvironment.objects.filter(monitor=self.monitor)[0]

        assert monitor_environment is not None
        assert monitor_environment.monitor == self.monitor
        assert monitor_environment.environment.name == "production"
        assert monitor_environment.status == self.monitor.status

        with pytest.raises(Project.DoesNotExist):
            Project.objects.get(id=self.orphaned_monitor.project_id)

        assert len(MonitorEnvironment.objects.filter(monitor=self.orphaned_monitor)) == 0

        assert len(MonitorEnvironment.objects.filter(monitor=self.deleting_monitor)) == 0
