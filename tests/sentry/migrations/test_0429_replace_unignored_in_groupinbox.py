from sentry.models.group import GroupStatus
from sentry.models.groupinbox import GroupInbox, GroupInboxReason, add_group_to_inbox
from sentry.testutils.cases import TestMigrations
from sentry.types.group import GroupSubStatus


class BackfillActorsTest(TestMigrations):
    migrate_from = "0428_backfill_denormalize_notification_actor"
    migrate_to = "0429_replace_unignored_in_groupinbox"

    def setup_initial_state(self):
        self.ignored_group = self.create_group(
            status=GroupStatus.IGNORED, substatus=GroupSubStatus.FOREVER
        )
        add_group_to_inbox(self.ignored_group, GroupInboxReason.UNIGNORED)
        self.new_group = self.create_group(
            status=GroupStatus.UNRESOLVED, substatus=GroupSubStatus.NEW
        )
        add_group_to_inbox(self.new_group, GroupInboxReason.NEW)

    def setup_before_migration(self, apps):
        pass

    def test(self):
        assert not GroupInbox.objects.filter(reason=GroupInboxReason.UNIGNORED.value).exists()
        assert GroupInbox.objects.filter(reason=GroupInboxReason.ONGOING.value).count() == 1
