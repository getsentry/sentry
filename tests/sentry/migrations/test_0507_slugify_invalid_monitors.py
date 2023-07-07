import pytest
from django.utils.text import slugify

from sentry.monitors.models import Monitor, MonitorType, ScheduleType
from sentry.testutils.cases import TestMigrations


class MigrateSlugifyInvalidMonitorTest(TestMigrations):
    migrate_from = "0506_null_boolean_fields"
    migrate_to = "0507_slugify_invalid_monitors"

    def setup_before_migration(self, apps):
        self.invalid_monitor_1 = Monitor.objects.create(
            name="invalid_1",
            slug="/api/analytics/admin.get?token=123",
            organization_id=self.organization.id,
            project_id=self.project.id,
            type=MonitorType.CRON_JOB,
            config={"schedule": "* * * * *", "schedule_type": ScheduleType.CRONTAB},
        )

        self.invalid_monitor_2 = Monitor.objects.create(
            name="invalid_2",
            slug="/api/cron",
            organization_id=self.organization.id,
            project_id=self.project.id,
            type=MonitorType.CRON_JOB,
            config={"schedule": "* * * * *", "schedule_type": ScheduleType.CRONTAB},
        )

        self.invalid_monitor_3 = Monitor.objects.create(
            name="invalid_2",
            slug="/api/cron/3",
            organization_id=self.organization.id,
            project_id=self.project.id,
            type=MonitorType.CRON_JOB,
            config={"schedule": "* * * * *", "schedule_type": ScheduleType.CRONTAB},
        )

        self.valid_monitor_1 = Monitor.objects.create(
            name="valid_1",
            slug="valid_1",
            organization_id=self.organization.id,
            project_id=self.project.id,
            type=MonitorType.CRON_JOB,
            config={"schedule": "* * * * *", "schedule_type": ScheduleType.CRONTAB},
        )

        self.valid_monitor_2 = Monitor.objects.create(
            name="valid_2",
            slug="apicron3",
            organization_id=self.organization.id,
            project_id=self.project.id,
            type=MonitorType.CRON_JOB,
            config={"schedule": "* * * * *", "schedule_type": ScheduleType.CRONTAB},
        )

    def test(self):
        MAX_SLUG_LENGTH = 50

        invalid_monitor_1 = Monitor.objects.get(id=self.invalid_monitor_1.id)
        invalid_monitor_2 = Monitor.objects.get(id=self.invalid_monitor_2.id)

        valid_monitor_1 = Monitor.objects.get(id=self.valid_monitor_1.id)
        valid_monitor_2 = Monitor.objects.get(id=self.valid_monitor_2.id)

        assert invalid_monitor_1.slug == slugify(self.invalid_monitor_1.slug)[
            :MAX_SLUG_LENGTH
        ].strip("-")
        assert invalid_monitor_2.slug == slugify(self.invalid_monitor_2.slug)[
            :MAX_SLUG_LENGTH
        ].strip("-")

        # assert colliding monitor does not exist
        with pytest.raises(Monitor.DoesNotExist):
            Monitor.objects.get(id=self.invalid_monitor_3.id)

        assert valid_monitor_1.slug == self.valid_monitor_1.slug
        assert valid_monitor_2.slug == self.valid_monitor_2.slug
