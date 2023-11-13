from datetime import timedelta
from uuid import uuid4

import pytest
from django.utils import timezone

from sentry.models.outbox import outbox_context
from sentry.testutils.cases import TestMigrations


@pytest.mark.skip("Migration 581 makes alert rule selects fail here.")
class MonitorsFixNextCheckinLatestMigrationTest(TestMigrations):
    migrate_from = "0567_add_slug_reservation_model"
    migrate_to = "0568_monitors_fix_next_checkin_latest"

    def setup_before_migration(self, apps):
        with outbox_context(flush=False):
            self.now = timezone.now().replace(second=0, microsecond=0)

            Monitor = apps.get_model("sentry", "Monitor")
            MonitorEnvironment = apps.get_model("sentry", "MonitorEnvironment")

            # checkin_margin is None, should update to default of 1 minute apart
            self.monitor1 = Monitor.objects.create(
                guid=uuid4(),
                slug="test1",
                organization_id=self.organization.id,
                project_id=self.project.id,
                config={
                    "schedule": "* * * * *",
                    "checkin_margin": None,
                    "max_runtime": None,
                },
            )
            self.monitor_env1 = MonitorEnvironment.objects.create(
                monitor=self.monitor1,
                environment_id=self.environment.id,
                next_checkin=self.now,
                next_checkin_latest=self.now,
            )

            # checkin_margin is 3, next_checkin == next_checkin_latest, this will
            # be updated
            self.monitor2 = Monitor.objects.create(
                guid=uuid4(),
                slug="test2",
                organization_id=self.organization.id,
                project_id=self.project.id,
                config={
                    "schedule": "* * * * *",
                    "checkin_margin": 3,
                    "max_runtime": None,
                },
            )
            self.monitor_env2 = MonitorEnvironment.objects.create(
                monitor=self.monitor2,
                environment_id=self.environment.id,
                next_checkin=self.now,
                next_checkin_latest=self.now,
            )

            # checkin_margin mismatches with the next_checkin and
            # next_checkin_latest. However the next_checkin != next_checkin_latest
            # so we will not adjust this.
            self.monitor3 = Monitor.objects.create(
                guid=uuid4(),
                slug="test3",
                organization_id=self.organization.id,
                project_id=self.project.id,
                config={
                    "schedule": "* * * * *",
                    # XXX: This intentionally mismatches what the
                    # next_checkin_latest is set to
                    "checkin_margin": 3,
                    "max_runtime": None,
                },
            )
            self.monitor_env3 = MonitorEnvironment.objects.create(
                monitor=self.monitor3,
                environment_id=self.environment.id,
                next_checkin=self.now,
                next_checkin_latest=self.now + timedelta(minutes=5),
            )

    def test(self):
        self.monitor_env1.refresh_from_db()
        self.monitor_env2.refresh_from_db()
        self.monitor_env3.refresh_from_db()

        # Equal next_checkin_latest is set to the default `1` margin
        assert self.monitor_env1.next_checkin_latest == (self.now + timedelta(minutes=1))

        # Updates with the margin configured in the monitor
        assert self.monitor_env2.next_checkin_latest == (self.now + timedelta(minutes=3))

        # This was not changed
        assert self.monitor_env3.next_checkin_latest == (self.now + timedelta(minutes=5))
