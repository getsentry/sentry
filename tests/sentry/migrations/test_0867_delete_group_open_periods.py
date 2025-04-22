from datetime import datetime, timezone

from sentry.models.group import Group, GroupStatus
from sentry.models.groupopenperiod import GroupOpenPeriod
from sentry.models.organization import Organization
from sentry.testutils.cases import TestMigrations


class DeleteGroupOpenPeriodsTest(TestMigrations):
    migrate_from = "0866_grouptype_index"
    migrate_to = "0867_delete_group_open_periods"

    def setup_initial_state(self):
        self.organization = Organization.objects.create(name="test", slug="test")
        self.project = self.create_project(organization=self.organization)

        self.group = Group.objects.create(
            project=self.project,
            first_seen=datetime(2025, 1, 1, tzinfo=timezone.utc),
        )
        GroupOpenPeriod.objects.create(
            group=self.group,
            project_id=self.project.id,
            date_started=self.group.first_seen,
            date_ended=None,
        )
        self.group2 = Group.objects.create(
            project=self.project,
            first_seen=datetime(2025, 1, 1, tzinfo=timezone.utc),
        )
        self.group2.status = GroupStatus.RESOLVED
        self.group2.save()
        GroupOpenPeriod.objects.create(
            group=self.group2,
            project_id=self.project.id,
            date_started=self.group2.first_seen,
            date_ended=self.group2.resolved_at,
        )

        assert GroupOpenPeriod.objects.all().count() == 2

    def test_backfill_of_org_mappings(self):
        assert GroupOpenPeriod.objects.all().count() == 0
