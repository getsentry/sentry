from sentry.models.group import Group, GroupStatus
from sentry.models.groupinbox import GroupInbox, GroupInboxReason
from sentry.models.organization import Organization
from sentry.testutils.cases import TestMigrations
from sentry.types.group import GroupSubStatus


class RemoveGroupsFromGroupInbox(TestMigrations):
    migrate_from = "0778_userreport_comments_max_length"
    migrate_to = "0779_remove_groups_from_group_inbox"

    def setup_before_migration(self, app):
        self.organization = Organization.objects.create(name="test", slug="test")
        self.project = self.create_project(organization=self.organization)
        self.resolved_group = Group.objects.create(
            project=self.project,
            status=GroupStatus.RESOLVED,
            substatus=None,
        )
        self.ignored_group = Group.objects.create(
            project=self.project,
            status=GroupStatus.IGNORED,
            substatus=GroupSubStatus.UNTIL_ESCALATING,
        )
        self.unresolved_group = Group.objects.create(
            project=self.project,
            status=GroupStatus.UNRESOLVED,
            substatus=GroupSubStatus.NEW,
        )
        GroupInbox.objects.create(group=self.resolved_group, reason=GroupInboxReason.NEW.value)
        GroupInbox.objects.create(group=self.ignored_group, reason=GroupInboxReason.NEW.value)
        GroupInbox.objects.create(group=self.unresolved_group, reason=GroupInboxReason.NEW.value)

    def test(self):
        assert not GroupInbox.objects.filter(group=self.resolved_group).exists()
        assert not GroupInbox.objects.filter(group=self.ignored_group).exists()
        assert GroupInbox.objects.filter(group=self.unresolved_group).exists()
