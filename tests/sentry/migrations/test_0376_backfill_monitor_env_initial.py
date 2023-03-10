from datetime import timedelta

from django.utils import timezone

from sentry.models import Environment, EnvironmentProject
from sentry.monitors.models import Monitor, MonitorEnvironment, MonitorType, ScheduleType
from sentry.testutils.cases import TestMigrations

DEFAULT_ENVIRONMENT_NAME = "production"


class MigrateMonitorEnvironmentBackfillInitialTest(TestMigrations):
    migrate_from = "0375_remove_nullable_from_field"
    migrate_to = "0376_backfill_monitor_env_initial"

    def setup_before_migration(self, apps):
        self.monitor = Monitor.objects.create(
            organization_id=self.organization.id,
            project_id=self.project.id,
            next_checkin=timezone.now() - timedelta(minutes=1),
            type=MonitorType.CRON_JOB,
            config={"schedule": "* * * * *", "schedule_type": ScheduleType.CRONTAB},
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
