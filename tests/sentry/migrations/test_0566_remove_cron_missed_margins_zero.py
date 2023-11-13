from uuid import uuid4

import pytest

from sentry.models.outbox import outbox_context
from sentry.testutils.cases import TestMigrations


@pytest.mark.skip("Migration 581 makes alert rule selects fail here.")
class RemoveCronMissedMarginsZeroMigrationTest(TestMigrations):
    migrate_from = "0565_fix_diff_env_dupe_alerts"
    migrate_to = "0566_remove_cron_missed_margins_zero"

    def setup_before_migration(self, apps):
        with outbox_context(flush=False):
            Monitor = apps.get_model("sentry", "Monitor")
            self.monitor1 = Monitor.objects.create(
                guid=uuid4(),
                slug="test1",
                organization_id=self.organization.id,
                project_id=self.project.id,
                config={
                    "schedule": "* * * * *",
                    "checkin_margin": 0,
                    "max_runtime": None,
                },
            )
            self.monitor2 = Monitor.objects.create(
                guid=uuid4(),
                slug="test2",
                organization_id=self.organization.id,
                project_id=self.project.id,
                config={
                    "schedule": "* * * * *",
                    "checkin_margin": 5,
                    "max_runtime": None,
                },
            )

    def test(self):
        self.monitor1.refresh_from_db()
        self.monitor2.refresh_from_db()

        # Checkin margin of zero was removed
        assert self.monitor1.config["checkin_margin"] is None
        assert self.monitor2.config["checkin_margin"] == 5
