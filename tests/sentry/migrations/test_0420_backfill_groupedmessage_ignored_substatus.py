from sentry.models import Group, GroupStatus, GroupSubStatus
from sentry.testutils.cases import TestMigrations


class GroupIgnoredSubstatusBackfillTest(TestMigrations):
    migrate_from = "0419_add_null_constraint_for_org_integration_denorm"
    migrate_to = "0420_backfill_groupedmessage_ignored_substatus"

    def setup_before_migration(self, apps):
        self.create_group(status=GroupStatus.IGNORED, substatus=GroupSubStatus.UNTIL_ESCALATING),
        self.create_group(status=GroupStatus.MUTED, substatus=GroupSubStatus.UNTIL_ESCALATING),

        # below substates shouldn't be legal but for the purposes of this backfill, we'll null them out
        self.create_group(status=GroupStatus.IGNORED, substatus=GroupSubStatus.ONGOING),
        self.create_group(status=GroupStatus.MUTED, substatus=GroupSubStatus.ONGOING),
        self.create_group(status=GroupStatus.IGNORED, substatus=GroupSubStatus.ESCALATING),
        self.create_group(status=GroupStatus.MUTED, substatus=GroupSubStatus.ESCALATING),

        # nulled substatus should stay the same
        self.create_group(status=GroupStatus.IGNORED)
        self.create_group(status=GroupStatus.MUTED)

        self.unchanged_groups = [
            (
                self.create_group(status=GroupStatus.UNRESOLVED, substatus=GroupSubStatus.ONGOING),
                GroupSubStatus.ONGOING,
            ),
            (self.create_group(status=GroupStatus.RESOLVED), None),
        ]

    def test(self):
        for g in Group.objects.filter(status__in=(GroupStatus.IGNORED, GroupStatus.MUTED)):
            assert g.substatus is None

        for group, expected_substatus in self.unchanged_groups:
            assert group.substatus is expected_substatus
