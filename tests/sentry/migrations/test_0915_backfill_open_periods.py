from datetime import timedelta

import pytest
from django.utils import timezone

from sentry.models.activity import Activity
from sentry.models.group import Group, GroupStatus
from sentry.models.groupopenperiod import GroupOpenPeriod
from sentry.models.organization import Organization
from sentry.testutils.cases import TestMigrations
from sentry.types.activity import ActivityType
from sentry.types.group import GroupSubStatus


@pytest.mark.skip(reason="Skipping migration test to avoid blocking CI")
class BackfillGroupOpenPeriodsTest(TestMigrations):
    migrate_from = "0877_integer_drift_release"
    migrate_to = "0878_backfill_open_periods"

    def setup_before_migration(self, app):
        now = timezone.now()
        self.organization = Organization.objects.create(name="test", slug="test")
        self.project = self.create_project(organization=self.organization)

        # Create a group that has been resolved and then regressed and resolved again
        self.group_resolved = Group.objects.create(
            project=self.project,
            status=GroupStatus.UNRESOLVED,
            substatus=GroupSubStatus.NEW,
            first_seen=now - timedelta(days=3),
        )
        self.group_resolved_resolution_activity_1 = Activity.objects.create(
            group=self.group_resolved,
            project=self.project,
            type=ActivityType.SET_RESOLVED.value,
            datetime=now - timedelta(days=2),
        )
        self.group_resolved.update(
            status=GroupStatus.UNRESOLVED, substatus=GroupSubStatus.REGRESSED
        )
        Activity.objects.create(
            group=self.group_resolved,
            project=self.project,
            type=ActivityType.SET_REGRESSION.value,
            datetime=now - timedelta(days=1),
        )
        self.group_resolved.update(status=GroupStatus.RESOLVED, substatus=None)
        self.group_resolved_resolution_activity_2 = Activity.objects.create(
            group=self.group_resolved,
            project=self.project,
            type=ActivityType.SET_RESOLVED.value,
            datetime=now,
        )
        assert self.group_resolved.status == GroupStatus.RESOLVED
        assert self.group_resolved.substatus is None

        # Create a group that has been resolved and then regressed
        self.group_regressed = Group.objects.create(
            project=self.project,
            status=GroupStatus.UNRESOLVED,
            substatus=GroupSubStatus.NEW,
            first_seen=now - timedelta(days=3),
        )
        self.group_regressed.update(status=GroupStatus.RESOLVED, substatus=None)
        self.group_regressed_resolution_activity = Activity.objects.create(
            group=self.group_regressed,
            project=self.project,
            type=ActivityType.SET_RESOLVED.value,
            datetime=now - timedelta(days=2),
        )
        self.group_regressed.update(
            status=GroupStatus.UNRESOLVED, substatus=GroupSubStatus.REGRESSED
        )
        Activity.objects.create(
            group=self.group_regressed,
            project=self.project,
            type=ActivityType.SET_REGRESSION.value,
            datetime=now - timedelta(days=1),
        )
        assert self.group_regressed.status == GroupStatus.UNRESOLVED
        assert self.group_regressed.substatus == GroupSubStatus.REGRESSED

        # Create a new group that has never been resolved
        self.group_new = Group.objects.create(
            project=self.project,
            status=GroupStatus.UNRESOLVED,
            substatus=GroupSubStatus.NEW,
            first_seen=now - timedelta(days=3),
        )
        assert self.group_new.status == GroupStatus.UNRESOLVED
        assert self.group_new.substatus == GroupSubStatus.NEW

        # Create a group that has been ignored until escalating
        self.group_ignored = Group.objects.create(
            project=self.project,
            status=GroupStatus.UNRESOLVED,
            substatus=GroupSubStatus.NEW,
            first_seen=now - timedelta(days=3),
        )
        self.group_ignored.update(
            status=GroupStatus.IGNORED, substatus=GroupSubStatus.UNTIL_ESCALATING
        )
        Activity.objects.create(
            group=self.group_ignored,
            project=self.project,
            type=ActivityType.SET_IGNORED.value,
            datetime=now - timedelta(days=2),
        )
        assert self.group_ignored.status == GroupStatus.IGNORED
        assert self.group_ignored.substatus == GroupSubStatus.UNTIL_ESCALATING

        # Create an unresolved group that already has an open period
        self.unresolved_group_with_open_period = Group.objects.create(
            project=self.project,
            status=GroupStatus.UNRESOLVED,
            substatus=GroupSubStatus.NEW,
            first_seen=now - timedelta(days=5),
        )
        GroupOpenPeriod.objects.create(
            group=self.unresolved_group_with_open_period,
            project=self.project,
            date_started=self.unresolved_group_with_open_period.first_seen,
        )

        assert (
            GroupOpenPeriod.objects.filter(group=self.unresolved_group_with_open_period).count()
            == 1
        )

        # Create a resolved group that already has an open period
        self.resolved_group_with_open_period = Group.objects.create(
            project=self.project,
            status=GroupStatus.UNRESOLVED,
            substatus=GroupSubStatus.NEW,
            first_seen=now - timedelta(days=3),
        )
        gop = GroupOpenPeriod.objects.create(
            group=self.resolved_group_with_open_period,
            project=self.project,
            date_started=self.resolved_group_with_open_period.first_seen,
        )
        self.resolved_group_with_open_period.update(status=GroupStatus.RESOLVED, substatus=None)
        self.resolved_group_with_open_period_resolution_activity = Activity.objects.create(
            group=self.resolved_group_with_open_period,
            project=self.project,
            type=ActivityType.SET_RESOLVED.value,
            datetime=now,
        )
        gop.update(
            resolution_activity=self.resolved_group_with_open_period_resolution_activity,
            date_ended=self.resolved_group_with_open_period_resolution_activity.datetime,
        )
        assert (
            GroupOpenPeriod.objects.filter(group=self.resolved_group_with_open_period).count() == 1
        )
        assert self.resolved_group_with_open_period.status == GroupStatus.RESOLVED
        assert self.resolved_group_with_open_period.substatus is None

    def test(self):
        self.group_resolved.refresh_from_db()
        open_periods = GroupOpenPeriod.objects.filter(group=self.group_resolved).order_by(
            "date_started"
        )
        assert len(open_periods) == 2
        assert open_periods[0].date_started == self.group_resolved.first_seen
        assert open_periods[0].date_ended == self.group_resolved_resolution_activity_1.datetime
        assert open_periods[0].resolution_activity == self.group_resolved_resolution_activity_1
        assert open_periods[1].date_started > open_periods[0].date_started
        assert open_periods[1].date_ended == self.group_resolved_resolution_activity_2.datetime
        assert open_periods[1].resolution_activity == self.group_resolved_resolution_activity_2

        self.group_regressed.refresh_from_db()
        open_periods = GroupOpenPeriod.objects.filter(group=self.group_regressed).order_by(
            "date_started"
        )
        assert len(open_periods) == 2
        assert open_periods[0].date_started == self.group_regressed.first_seen
        assert open_periods[0].date_ended == self.group_regressed_resolution_activity.datetime
        assert open_periods[1].date_started > open_periods[0].date_started
        assert open_periods[1].date_ended is None
        assert open_periods[1].resolution_activity is None

        self.group_new.refresh_from_db()
        open_periods = GroupOpenPeriod.objects.filter(group=self.group_new)
        assert len(open_periods) == 1
        assert open_periods[0].date_started == self.group_new.first_seen
        assert open_periods[0].date_ended is None
        assert open_periods[0].resolution_activity is None

        self.group_ignored.refresh_from_db()
        open_periods = GroupOpenPeriod.objects.filter(group=self.group_ignored)
        assert len(open_periods) == 1
        assert open_periods[0].date_started == self.group_ignored.first_seen
        assert open_periods[0].date_ended is None
        assert open_periods[0].resolution_activity is None

        # Ensure that the existing open periods were not touched
        self.unresolved_group_with_open_period.refresh_from_db()
        open_periods = GroupOpenPeriod.objects.filter(group=self.unresolved_group_with_open_period)
        assert len(open_periods) == 1
        assert open_periods[0].date_started == self.unresolved_group_with_open_period.first_seen
        assert open_periods[0].date_ended is None
        assert open_periods[0].resolution_activity is None

        self.resolved_group_with_open_period.refresh_from_db()
        open_periods = GroupOpenPeriod.objects.filter(group=self.resolved_group_with_open_period)
        assert len(open_periods) == 1
        assert open_periods[0].date_started == self.resolved_group_with_open_period.first_seen
        assert (
            open_periods[0].date_ended
            == self.resolved_group_with_open_period_resolution_activity.datetime
        )
        assert (
            open_periods[0].resolution_activity
            == self.resolved_group_with_open_period_resolution_activity
        )
