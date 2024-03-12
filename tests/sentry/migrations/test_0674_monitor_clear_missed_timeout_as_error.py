from sentry.monitors.models import MonitorType, ScheduleType
from sentry.testutils.cases import TestMigrations


class TestMonitorClearMissedTimeoutAsError(TestMigrations):
    migrate_from = "0673_add_env_muted_to_broken_detection"
    migrate_to = "0674_monitor_clear_missed_timeout_as_error"

    def setup_before_migration(self, apps):
        Monitor = apps.get_model("sentry", "Monitor")
        MonitorEnvironment = apps.get_model("sentry", "MonitorEnvironment")

        self.monitor = Monitor.objects.create(
            guid="9aa14d45-1232-4a4b-9d90-c954c0377970",
            organization_id=self.organization.id,
            project_id=self.project.id,
            type=MonitorType.CRON_JOB,
            config={
                "schedule": "* * * * *",
                "schedule_type": ScheduleType.CRONTAB,
                "checkin_margin": None,
                "max_runtime": None,
            },
        )
        self.monitor_env1 = MonitorEnvironment.objects.create(
            monitor=self.monitor,
            environment_id=self.create_environment(
                organization=self.organization, project=self.project, name="prod1"
            ).id,
            status=4,  # OK
        )
        self.monitor_env2 = MonitorEnvironment.objects.create(
            monitor=self.monitor,
            environment_id=self.create_environment(
                organization=self.organization, project=self.project, name="prod2"
            ).id,
            status=5,  # ERROR
        )
        self.monitor_env3 = MonitorEnvironment.objects.create(
            monitor=self.monitor,
            environment_id=self.create_environment(
                organization=self.organization, project=self.project, name="prod3"
            ).id,
            status=6,  # MISSED_CHECKIN
        )
        self.monitor_env4 = MonitorEnvironment.objects.create(
            monitor=self.monitor,
            environment_id=self.create_environment(
                organization=self.organization, project=self.project, name="prod4"
            ).id,
            status=7,  # TIMEOUT
        )
        self.monitor_env5 = MonitorEnvironment.objects.create(
            monitor=self.monitor,
            environment_id=self.create_environment(
                organization=self.organization, project=self.project, name="prod5"
            ).id,
            status=7,  # TIMEOUT
        )

    def test(self):
        """
        Validate that environments with (MISSED_CHECKIN, TIMEOUT) status's are
        set to error status.
        """
        self.monitor_env1.refresh_from_db()
        self.monitor_env2.refresh_from_db()
        self.monitor_env3.refresh_from_db()
        self.monitor_env4.refresh_from_db()
        self.monitor_env5.refresh_from_db()

        assert self.monitor_env1.status == 4
        assert self.monitor_env2.status == 5
        assert self.monitor_env3.status == 5
        assert self.monitor_env4.status == 5
        assert self.monitor_env5.status == 5
