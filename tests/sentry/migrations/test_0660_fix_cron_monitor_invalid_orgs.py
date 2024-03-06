from sentry.monitors.models import Monitor
from sentry.testutils.cases import TestMigrations


class RenamePrioritySortToTrendsTest(TestMigrations):
    migrate_from = "0659_artifactbundleindex_cleanup"
    migrate_to = "0660_fix_cron_monitor_invalid_orgs"

    def setup_initial_state(self):
        self.other_org = self.create_organization()
        self.valid_monitor = Monitor.objects.create(
            organization_id=self.project.organization_id,
            project_id=self.project.id,
            slug="valid-monitor",
            name="valid-monitor",
        )
        self.invalid_monitor = Monitor.objects.create(
            organization_id=self.other_org.id,
            project_id=self.project.id,
            slug="invalid-monitor",
            name="invalid-monitor",
        )

    def test(self):
        self.valid_monitor.refresh_from_db()
        self.invalid_monitor.refresh_from_db()
        assert self.valid_monitor.organization_id == self.project.organization_id
        assert self.invalid_monitor.organization_id == self.project.organization_id
