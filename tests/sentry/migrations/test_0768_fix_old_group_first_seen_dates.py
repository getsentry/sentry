from datetime import datetime, timezone

from sentry.models.group import Group
from sentry.models.organization import Organization
from sentry.testutils.cases import TestMigrations


class FixOldGroupFirstSeenDates(TestMigrations):
    migrate_from = "0767_add_selected_aggregate_to_dashboards_widget_query"
    migrate_to = "0768_fix_old_group_first_seen_dates"

    def setup_before_migration(self, app):
        self.organization = Organization.objects.create(name="test", slug="test")
        self.project = self.create_project(organization=self.organization)
        self.old_group = Group.objects.create(
            project=self.project,
            first_seen=datetime(1980, 1, 1, tzinfo=timezone.utc),
            active_at=datetime(2022, 5, 5, tzinfo=timezone.utc),
        )
        self.normal_group = Group.objects.create(
            project=self.project,
            first_seen=datetime(2024, 1, 1, tzinfo=timezone.utc),
            active_at=datetime(2024, 2, 1, tzinfo=timezone.utc),
        )

        assert self.old_group.first_seen == datetime(1980, 1, 1, tzinfo=timezone.utc)
        assert self.normal_group.first_seen == datetime(2024, 1, 1, tzinfo=timezone.utc)

    def test(self):
        self.old_group.refresh_from_db()
        assert self.old_group.first_seen == datetime(2022, 5, 5, tzinfo=timezone.utc)

        self.normal_group.refresh_from_db()
        assert self.normal_group.first_seen == datetime(2024, 1, 1, tzinfo=timezone.utc)
