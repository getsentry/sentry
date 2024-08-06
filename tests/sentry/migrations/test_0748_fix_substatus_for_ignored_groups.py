from sentry.models.activity import Activity
from sentry.models.group import Group, GroupStatus
from sentry.models.groupsnooze import GroupSnooze
from sentry.testutils.cases import TestMigrations
from sentry.types.activity import ActivityType
from sentry.types.group import GroupSubStatus


class BackfillMissingUnresolvedSubstatus(TestMigrations):
    migrate_from = "0747_create_datasecrecywaiver_table"
    migrate_to = "0748_fix_substatus_for_ignored_groups"

    def setup_initial_state(self):
        self.do_not_update = Group.objects.create(
            project=self.project,
            status=GroupStatus.IGNORED,
            substatus=GroupSubStatus.UNTIL_ESCALATING,
        )

        self.ignored_until_condition_met = Group.objects.create(
            project=self.project,
            status=GroupStatus.IGNORED,
        )
        # .update() skips calling the pre_save checks which requires a substatus
        self.ignored_until_condition_met.update(substatus=None)
        self.ignored_until_condition_met.refresh_from_db()
        assert self.ignored_until_condition_met.substatus is None
        Activity.objects.create(
            group=self.ignored_until_condition_met,
            project=self.project,
            type=ActivityType.SET_IGNORED.value,
            data={"ignoreCount": 10},
        )

        self.ignored_until_condition_met_no_activity = Group.objects.create(
            project=self.project,
            status=GroupStatus.IGNORED,
        )
        self.ignored_until_condition_met_no_activity.update(substatus=None)
        assert self.ignored_until_condition_met_no_activity.substatus is None
        Activity.objects.create(
            group=self.ignored_until_condition_met_no_activity,
            project=self.project,
            type=ActivityType.SET_IGNORED.value,
            data={
                "ignoreCount": None,
                "ignoreDuration": None,
                "ignoreUntil": None,
                "ignoreUserCount": None,
                "ignoreUserWindow": None,
                "ignoreWindow": None,
                "ignoreUntilEscalating": None,
            },
        )
        GroupSnooze.objects.create(
            group=self.ignored_until_condition_met_no_activity,
            count=10,
        )

        self.ignored_until_escalating = Group.objects.create(
            project=self.project,
            status=GroupStatus.IGNORED,
        )
        # .update() skips calling the pre_save checks which requires a substatus
        self.ignored_until_escalating.update(substatus=None)
        self.ignored_until_escalating.refresh_from_db()
        assert self.ignored_until_escalating.substatus is None
        Activity.objects.create(
            group=self.ignored_until_escalating,
            project=self.project,
            type=ActivityType.SET_IGNORED.value,
            data={"ignoreUntilEscalating": True},
        )

        self.ignored_forever = Group.objects.create(
            project=self.project,
            status=GroupStatus.IGNORED,
        )
        self.ignored_forever.update(substatus=None)
        assert self.ignored_forever.substatus is None

    def test(self):
        self.do_not_update.refresh_from_db()
        assert self.do_not_update.substatus == GroupSubStatus.UNTIL_ESCALATING

        self.ignored_until_condition_met.refresh_from_db()
        assert self.ignored_until_condition_met.substatus == GroupSubStatus.UNTIL_CONDITION_MET

        self.ignored_until_condition_met_no_activity.refresh_from_db()
        assert (
            self.ignored_until_condition_met_no_activity.substatus
            == GroupSubStatus.UNTIL_CONDITION_MET
        )

        self.ignored_until_escalating.refresh_from_db()
        assert self.ignored_until_escalating.substatus == GroupSubStatus.UNTIL_ESCALATING

        self.ignored_forever.refresh_from_db()
        assert self.ignored_forever.substatus == GroupSubStatus.FOREVER
