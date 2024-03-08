import uuid

from sentry.monitors.models import CheckInStatus, MonitorType, ScheduleType
from sentry.testutils.cases import TestMigrations


class TestMonitorIncidentUnique(TestMigrations):
    migrate_from = "0669_alert_rule_activation"
    migrate_to = "0670_monitor_incident_cleanup_duplicates"

    mon1_inc1_hash = uuid.uuid4().hex

    mon2_inc1_hash = uuid.uuid4().hex
    mon2_inc2_hash = uuid.uuid4().hex

    mon3_inc1_hash = uuid.uuid4().hex
    mon3_inc2_hash = uuid.uuid4().hex
    mon3_inc3_hash = uuid.uuid4().hex

    def setup_before_migration(self, apps):
        Monitor = apps.get_model("sentry", "Monitor")
        MonitorEnvironment = apps.get_model("sentry", "MonitorEnvironment")
        MonitorCheckIn = apps.get_model("sentry", "MonitorCheckIn")
        MonitorIncident = apps.get_model("sentry", "MonitorIncident")

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
                organization=self.organization, project=self.project, name="prod"
            ).id,
        )
        self.monitor_env2 = MonitorEnvironment.objects.create(
            monitor=self.monitor,
            environment_id=self.create_environment(
                organization=self.organization, project=self.project, name="dev"
            ).id,
        )
        self.monitor_env3 = MonitorEnvironment.objects.create(
            monitor=self.monitor,
            environment_id=self.create_environment(
                organization=self.organization, project=self.project, name="test"
            ).id,
        )

        env2_resolving_checkin = MonitorCheckIn.objects.create(
            guid="9aa14d45-1232-4a4b-9d90-c954c0377975",
            monitor=self.monitor,
            monitor_environment=self.monitor_env1,
            project_id=self.project.id,
            status=CheckInStatus.OK,
        )

        # First environment only has one open incident
        MonitorIncident.objects.create(
            monitor=self.monitor,
            monitor_environment=self.monitor_env1,
            grouphash=self.mon1_inc1_hash,
        )

        # Second environment has one resolved incident, and 2 active incidents
        MonitorIncident.objects.create(
            monitor=self.monitor,
            monitor_environment=self.monitor_env2,
            resolving_checkin=env2_resolving_checkin,
        )
        MonitorIncident.objects.create(
            monitor=self.monitor,
            monitor_environment=self.monitor_env2,
            grouphash=self.mon2_inc1_hash,
        )
        MonitorIncident.objects.create(
            monitor=self.monitor,
            monitor_environment=self.monitor_env2,
            grouphash=self.mon2_inc2_hash,
        )

        # Third environment has three active incidents
        MonitorIncident.objects.create(
            monitor=self.monitor,
            monitor_environment=self.monitor_env3,
            grouphash=self.mon3_inc1_hash,
        )
        MonitorIncident.objects.create(
            monitor=self.monitor,
            monitor_environment=self.monitor_env3,
            grouphash=self.mon3_inc2_hash,
        )
        MonitorIncident.objects.create(
            monitor=self.monitor,
            monitor_environment=self.monitor_env3,
            grouphash=self.mon3_inc3_hash,
        )

    def test(self):
        """
        Validate that all duplicate active incidents have been removed and that
        we now have a proper constraint on the model enforcing that we will not
        create multiple active incidents.
        """
        from sentry.monitors.models import MonitorIncident

        # 3 active incidents and 1 resolved incident
        assert len(MonitorIncident.objects.all()) == 4

        # Ordering was respected and the last created incidents remained
        assert MonitorIncident.objects.filter(grouphash=self.mon1_inc1_hash).exists()
        assert MonitorIncident.objects.filter(grouphash=self.mon2_inc2_hash).exists()
        assert MonitorIncident.objects.filter(grouphash=self.mon3_inc3_hash).exists()

        # Duplicate incidents were removed
        assert not MonitorIncident.objects.filter(grouphash=self.mon2_inc1_hash).exists()
        assert not MonitorIncident.objects.filter(grouphash=self.mon3_inc1_hash).exists()
        assert not MonitorIncident.objects.filter(grouphash=self.mon3_inc2_hash).exists()
