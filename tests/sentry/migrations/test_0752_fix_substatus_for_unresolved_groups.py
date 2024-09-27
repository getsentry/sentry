from datetime import timedelta

from django.utils import timezone

from sentry.models.group import Group, GroupStatus
from sentry.models.grouphistory import GroupHistory, GroupHistoryStatus
from sentry.models.organization import Organization
from sentry.testutils.cases import TestMigrations
from sentry.types.group import GroupSubStatus


class BackfillMissingUnresolvedSubstatusTest(TestMigrations):
    migrate_from = "0751_grouphashmetadata_use_one_to_one_field_for_grouphash"
    migrate_to = "0752_fix_substatus_for_unresolved_groups"

    def setup_before_migration(self, app):
        self.organization = Organization.objects.create(name="test", slug="test")
        self.project = self.create_project(organization=self.organization)
        self.do_not_update = Group.objects.create(
            project=self.project,
            status=GroupStatus.UNRESOLVED,
            substatus=GroupSubStatus.NEW,
        )

        self.ongoing_group = Group.objects.create(
            project=self.project,
            status=GroupStatus.UNRESOLVED,
        )
        # .update() skips calling the pre_save checks which add a substatus
        self.ongoing_group.update(
            substatus=None,
            first_seen=timezone.now() - timedelta(days=8),
        )
        self.ongoing_group.refresh_from_db()
        assert self.ongoing_group.substatus is None

        self.regressed_group = Group.objects.create(
            project=self.project,
            status=GroupStatus.UNRESOLVED,
            first_seen=timezone.now() - timedelta(days=8),
        )
        self.regressed_group.update(substatus=None)
        assert self.regressed_group.substatus is None
        GroupHistory.objects.create(
            group=self.regressed_group,
            date_added=timezone.now() - timedelta(days=1),
            organization_id=self.organization.id,
            project_id=self.project.id,
            status=GroupHistoryStatus.REGRESSED,
        )

        self.new_group = Group.objects.create(
            project=self.project,
            status=GroupStatus.UNRESOLVED,
            first_seen=timezone.now(),
        )
        self.new_group.update(substatus=None)
        assert self.new_group.substatus is None

    def test(self):
        self.do_not_update.refresh_from_db()
        assert self.do_not_update.substatus == GroupSubStatus.NEW

        self.ongoing_group.refresh_from_db()
        assert self.ongoing_group.substatus == GroupSubStatus.ONGOING

        self.regressed_group.refresh_from_db()
        assert self.regressed_group.substatus == GroupSubStatus.REGRESSED

        self.new_group.refresh_from_db()
        assert self.new_group.substatus == GroupSubStatus.NEW
