from datetime import timedelta

import pytest
from django.utils import timezone

from sentry.monitors.models import Monitor, MonitorType, ScheduleType
from sentry.testutils.cases import TestMigrations

DEFAULT_ENVIRONMENT_NAME = "production"


class MigrateMonitorEnvironmentBackfillInitialTest(TestMigrations):
    migrate_from = "0404_backfill_user_avatars"
    migrate_to = "0405_monitor_cleanup"

    def setup_before_migration(self, apps):
        self.monitor = Monitor.objects.create(
            name="exists",
            organization_id=self.organization.id,
            project_id=self.project.id,
            next_checkin=timezone.now() + timedelta(minutes=1),
            type=MonitorType.CRON_JOB,
            config={"schedule": "* * * * *", "schedule_type": ScheduleType.CRONTAB},
        )

        deleted_project = self.create_project(
            organization=self.organization,
            name="deleted_project",
            slug="delete",
            teams=[self.team],
            fire_project_created=True,
        )

        self.project_monitor = Monitor.objects.create(
            organization_id=self.organization.id,
            project_id=deleted_project.id,
            next_checkin=timezone.now() + timedelta(minutes=2),
            type=MonitorType.CRON_JOB,
            config={"schedule": "* * * * *", "schedule_type": ScheduleType.CRONTAB},
        )

        deleted_project.delete()

        deleted_organization = self.create_organization(name="deleted_org", owner=self.user)
        deleted_org_project = self.create_project(organization=deleted_organization)

        self.org_monitor = Monitor.objects.create(
            organization_id=deleted_organization.id,
            project_id=deleted_org_project.id,
            next_checkin=timezone.now() + timedelta(minutes=3),
            type=MonitorType.CRON_JOB,
            config={"schedule": "* * * * *", "schedule_type": ScheduleType.CRONTAB},
        )

        deleted_organization.delete()

    def test(self):
        monitor = Monitor.objects.get(id=self.monitor.id)

        assert monitor is not None
        assert monitor.name == "exists"

        with pytest.raises(Monitor.DoesNotExist):
            Monitor.objects.get(id=self.project_monitor.id)

        with pytest.raises(Monitor.DoesNotExist):
            Monitor.objects.get(id=self.org_monitor.id)
