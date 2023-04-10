from django.db.models.signals import pre_save

from sentry.models import Group, GroupStatus, GroupSubStatus
from sentry.testutils.cases import TestMigrations


class GroupSubstatusBackfillTest(TestMigrations):
    migrate_from = "0416_drop_until_escalating_in_groupsnooze"
    migrate_to = "0417_backfill_groupedmessage_substatus"

    def setup_before_migration(self, apps):
        pre_save.receivers = []

        self.groups_substatus_non_null = [
            self.create_group(status=GroupStatus.UNRESOLVED, substatus=GroupSubStatus.ONGOING),
            self.create_group(status=GroupStatus.IGNORED, substatus=GroupSubStatus.ONGOING),
            self.create_group(status=GroupStatus.RESOLVED, substatus=GroupSubStatus.ONGOING),
            self.create_group(
                status=GroupStatus.PENDING_DELETION, substatus=GroupSubStatus.ONGOING
            ),
            self.create_group(
                status=GroupStatus.DELETION_IN_PROGRESS, substatus=GroupSubStatus.ONGOING
            ),
            self.create_group(status=GroupStatus.PENDING_MERGE, substatus=GroupSubStatus.ONGOING),
            self.create_group(status=GroupStatus.REPROCESSING, substatus=GroupSubStatus.ONGOING),
            self.create_group(status=GroupStatus.MUTED, substatus=GroupSubStatus.ONGOING),
        ]

        groups_substatus_null = [
            self.create_group(status=GroupStatus.UNRESOLVED),
            self.create_group(status=GroupStatus.IGNORED),
            self.create_group(status=GroupStatus.RESOLVED),
            self.create_group(status=GroupStatus.PENDING_DELETION),
            self.create_group(status=GroupStatus.DELETION_IN_PROGRESS),
            self.create_group(status=GroupStatus.PENDING_MERGE),
            self.create_group(status=GroupStatus.REPROCESSING),
            self.create_group(status=GroupStatus.MUTED),
        ]

        for g in groups_substatus_null:
            assert g.substatus is None

    def test(self):
        for g in self.groups_substatus_non_null:
            # make sure the groups with substatus values stay the same
            assert g.substatus == GroupSubStatus.ONGOING

        for g in Group.objects.filter(status=GroupStatus.UNRESOLVED, substatus=None):
            assert g.substatus == GroupSubStatus.ONGOING

        for g in Group.objects.filter(
            status__in=(GroupStatus.IGNORED, GroupStatus.MUTED), substatus=None
        ):
            assert g.substatus == GroupSubStatus.UNTIL_ESCALATING

        for g in Group.objects.filter(
            status__in=(
                GroupStatus.RESOLVED,
                GroupStatus.PENDING_DELETION,
                GroupStatus.DELETION_IN_PROGRESS,
                GroupStatus.PENDING_MERGE,
                GroupStatus.REPROCESSING,
            ),
            substatus=None,
        ):
            assert g.substatus is None
