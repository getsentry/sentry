from datetime import timedelta

from django.utils import timezone

from sentry.models.activity import Activity
from sentry.models.group import Group, GroupStatus
from sentry.models.grouphistory import GroupHistory, GroupHistoryStatus
from sentry.models.groupsnooze import GroupSnooze
from sentry.models.organization import Organization
from sentry.testutils.cases import TestMigrations
from sentry.types.activity import ActivityType
from sentry.types.group import GroupSubStatus


class BackfillMissingUnresolvedSubstatusTest(TestMigrations):
    migrate_from = "0763_add_created_by_to_broadcasts"
    migrate_to = "0764_migrate_bad_status_substatus_rows"

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
            substatus=GroupSubStatus.UNTIL_ESCALATING,
            first_seen=timezone.now() - timedelta(days=8),
        )

        self.regressed_group = Group.objects.create(
            project=self.project,
            status=GroupStatus.UNRESOLVED,
            first_seen=timezone.now() - timedelta(days=8),
        )
        self.regressed_group.update(substatus=GroupSubStatus.FOREVER)
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
        self.new_group.update(substatus=GroupSubStatus.UNTIL_CONDITION_MET)

        self.do_not_update_2 = Group.objects.create(
            project=self.project,
            status=GroupStatus.IGNORED,
            substatus=GroupSubStatus.UNTIL_ESCALATING,
        )

        self.ignored_until_condition_met = Group.objects.create(
            project=self.project,
            status=GroupStatus.IGNORED,
        )
        # .update() skips calling the pre_save checks which requires a substatus
        self.ignored_until_condition_met.update(substatus=GroupSubStatus.ONGOING)
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
        self.ignored_until_condition_met_no_activity.update(substatus=GroupSubStatus.REGRESSED)
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
        self.ignored_until_escalating.update(substatus=GroupSubStatus.NEW)
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
        self.ignored_forever.update(substatus=GroupSubStatus.ONGOING)

        self.pending_merge = Group.objects.create(
            project=self.project,
            status=GroupStatus.PENDING_MERGE,
        )
        self.pending_merge.update(substatus=GroupSubStatus.NEW)

    def test(self):
        self.do_not_update.refresh_from_db()
        assert self.do_not_update.substatus == GroupSubStatus.NEW

        self.ongoing_group.refresh_from_db()
        assert self.ongoing_group.substatus == GroupSubStatus.ONGOING

        self.regressed_group.refresh_from_db()
        assert self.regressed_group.substatus == GroupSubStatus.REGRESSED

        self.new_group.refresh_from_db()
        assert self.new_group.substatus == GroupSubStatus.NEW

        self.do_not_update_2.refresh_from_db()
        assert self.do_not_update_2.substatus == GroupSubStatus.UNTIL_ESCALATING

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

        self.pending_merge.refresh_from_db()
        assert self.pending_merge.substatus is None
