from sentry.models.group import Group, GroupStatus
from sentry.models.organization import Organization
from sentry.testutils.cases import TestMigrations
from sentry.types.group import GroupSubStatus


class BackfillMissingUnresolvedSubstatusTest(TestMigrations):
    migrate_from = "0763_add_created_by_to_broadcasts"
    migrate_to = "0764_migrate_bad_status_substatus_rows"

    def setup_before_migration(self, app):
        self.organization = Organization.objects.create(name="test", slug="test")
        self.project = self.create_project(organization=self.organization)
        self.do_not_update = Group.objects.create(
            project=self.project,
            status=GroupStatus.PENDING_MERGE,
        )
        self.do_not_update.update(substatus=None)

        self.do_not_update_2 = Group.objects.create(
            project=self.project,
            status=GroupStatus.UNRESOLVED,
            substatus=GroupSubStatus.NEW,
        )
        assert self.do_not_update_2.substatus == GroupSubStatus.NEW

        self.pending_merge = Group.objects.create(
            project=self.project,
            status=GroupStatus.PENDING_MERGE,
        )
        self.pending_merge.update(substatus=GroupSubStatus.NEW)

    def test(self):
        self.do_not_update.refresh_from_db()
        assert self.do_not_update.substatus is None

        self.do_not_update_2.refresh_from_db()
        assert self.do_not_update_2.substatus == GroupSubStatus.NEW

        self.pending_merge.refresh_from_db()
        assert self.pending_merge.substatus is None
