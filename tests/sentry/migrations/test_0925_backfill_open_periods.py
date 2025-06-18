from datetime import timedelta

from django.utils import timezone

from sentry.models.activity import Activity
from sentry.models.group import Group, GroupStatus
from sentry.models.groupopenperiod import GroupOpenPeriod
from sentry.models.organization import Organization
from sentry.testutils.cases import TestMigrations
from sentry.types.activity import ActivityType
from sentry.types.group import GroupSubStatus


class BackfillGroupOpenPeriodsTest(TestMigrations):
    migrate_from = "0924_dashboard_add_unique_constraint_for_user_org_position"
    migrate_to = "0925_backfill_open_periods"

    def _create_resolved_group(self):
        group = Group.objects.create(
            project=self.project,
            status=GroupStatus.UNRESOLVED,
            substatus=GroupSubStatus.NEW,
            first_seen=self.now - timedelta(days=3),
        )
        resolution_activity_1 = Activity.objects.create(
            group=group,
            project=self.project,
            type=ActivityType.SET_RESOLVED.value,
            datetime=self.now - timedelta(days=2),
        )
        group.update(status=GroupStatus.UNRESOLVED, substatus=GroupSubStatus.REGRESSED)
        regressed_activity = Activity.objects.create(
            group=group,
            project=self.project,
            type=ActivityType.SET_REGRESSION.value,
            datetime=self.now - timedelta(days=1),
        )
        group.update(status=GroupStatus.RESOLVED, substatus=None)
        resolution_activity_2 = Activity.objects.create(
            group=group,
            project=self.project,
            type=ActivityType.SET_RESOLVED.value,
            datetime=self.now,
        )
        return (
            group,
            [group.first_seen, regressed_activity.datetime],
            [
                resolution_activity_1.datetime,
                resolution_activity_2.datetime,
            ],
            [resolution_activity_1, resolution_activity_2],
        )

    def _create_regressed_group(self):
        group = Group.objects.create(
            project=self.project,
            status=GroupStatus.UNRESOLVED,
            substatus=GroupSubStatus.NEW,
            first_seen=self.now - timedelta(days=3),
        )
        group.update(status=GroupStatus.RESOLVED, substatus=None)
        resolution_activity = Activity.objects.create(
            group=group,
            project=self.project,
            type=ActivityType.SET_RESOLVED.value,
            datetime=self.now - timedelta(days=2),
        )
        group.update(status=GroupStatus.UNRESOLVED, substatus=GroupSubStatus.REGRESSED)
        regressed_activity = Activity.objects.create(
            group=group,
            project=self.project,
            type=ActivityType.SET_REGRESSION.value,
            datetime=self.now - timedelta(days=1),
        )
        return (
            group,
            [group.first_seen, regressed_activity.datetime],
            [resolution_activity.datetime, None],
            [resolution_activity, None],
        )

    def _create_ignored_group(self):
        group = Group.objects.create(
            project=self.project,
            status=GroupStatus.UNRESOLVED,
            substatus=GroupSubStatus.NEW,
            first_seen=self.now - timedelta(days=3),
        )
        group.update(status=GroupStatus.IGNORED, substatus=GroupSubStatus.UNTIL_ESCALATING)
        Activity.objects.create(
            group=group,
            project=self.project,
            type=ActivityType.SET_IGNORED.value,
            datetime=self.now - timedelta(days=2),
        )
        return (
            group,
            [group.first_seen],
            [None],
            [None],
        )

    def _create_resolved_group_with_open_period(self):
        group = Group.objects.create(
            project=self.project,
            status=GroupStatus.UNRESOLVED,
            substatus=GroupSubStatus.NEW,
            first_seen=self.now - timedelta(days=3),
        )
        gop = GroupOpenPeriod.objects.create(
            group=group,
            project=self.project,
            date_started=group.first_seen,
        )
        group.update(status=GroupStatus.RESOLVED, substatus=None)
        resolution_activity = Activity.objects.create(
            group=group,
            project=self.project,
            type=ActivityType.SET_RESOLVED.value,
            datetime=self.now,
        )
        gop.update(
            resolution_activity=resolution_activity,
            date_ended=resolution_activity.datetime,
        )
        return (
            group,
            [group.first_seen],
            [resolution_activity.datetime],
            [resolution_activity],
        )

    def _create_auto_resolved_group(self):
        group = Group.objects.create(
            project=self.project,
            status=GroupStatus.UNRESOLVED,
            substatus=GroupSubStatus.NEW,
            first_seen=self.now - timedelta(days=3),
        )

        group.update(status=GroupStatus.RESOLVED, substatus=None)
        resolution_activity = Activity.objects.create(
            group=group,
            project=self.project,
            type=ActivityType.SET_RESOLVED_BY_AGE.value,
            datetime=self.now,
        )

        return (
            group,
            [group.first_seen],
            [resolution_activity.datetime],
            [resolution_activity],
        )

    def _create_auto_resolved_regressed_group(self):
        group = Group.objects.create(
            project=self.project,
            status=GroupStatus.UNRESOLVED,
            substatus=GroupSubStatus.NEW,
            first_seen=self.now - timedelta(days=3),
        )

        group.update(status=GroupStatus.RESOLVED, substatus=None)
        resolution_activity = Activity.objects.create(
            group=group,
            project=self.project,
            type=ActivityType.SET_RESOLVED_BY_AGE.value,
            datetime=self.now - timedelta(days=2),
        )

        group.update(status=GroupStatus.UNRESOLVED, substatus=GroupSubStatus.REGRESSED)
        regressed_activity = Activity.objects.create(
            group=group,
            project=self.project,
            type=ActivityType.SET_REGRESSION.value,
            datetime=self.now - timedelta(days=1),
        )

        return (
            group,
            [group.first_seen, regressed_activity.datetime],
            [resolution_activity.datetime, None],
            [resolution_activity, None],
        )

    def _create_regressed_group_with_auto_resolved_cycles(self):
        group = Group.objects.create(
            project=self.project,
            status=GroupStatus.UNRESOLVED,
            substatus=GroupSubStatus.NEW,
            first_seen=self.now - timedelta(days=6),
        )

        group.update(status=GroupStatus.RESOLVED, substatus=None)
        resolution_activity_1 = Activity.objects.create(
            group=group,
            project=self.project,
            type=ActivityType.SET_RESOLVED_BY_AGE.value,
            datetime=self.now - timedelta(days=5),
        )

        group.update(status=GroupStatus.UNRESOLVED, substatus=GroupSubStatus.REGRESSED)
        regressed_activity_1 = Activity.objects.create(
            group=group,
            project=self.project,
            type=ActivityType.SET_REGRESSION.value,
            datetime=self.now - timedelta(days=4),
        )

        group.update(status=GroupStatus.RESOLVED, substatus=None)
        resolution_activity_2 = Activity.objects.create(
            group=group,
            project=self.project,
            type=ActivityType.SET_RESOLVED_BY_AGE.value,
            datetime=self.now - timedelta(days=3),
        )

        group.update(status=GroupStatus.UNRESOLVED, substatus=GroupSubStatus.REGRESSED)
        regressed_activity_2 = Activity.objects.create(
            group=group,
            project=self.project,
            type=ActivityType.SET_REGRESSION.value,
            datetime=self.now - timedelta(days=2),
        )

        return (
            group,
            [group.first_seen, regressed_activity_1.datetime, regressed_activity_2.datetime],
            [resolution_activity_1.datetime, resolution_activity_2.datetime, None],
            [resolution_activity_1, resolution_activity_2, None],
        )

    def setup_before_migration(self, app):
        self.now = timezone.now()
        self.organization = Organization.objects.create(name="test", slug="test")
        self.project = self.create_project(organization=self.organization)

        self.test_cases = []

        # Create a group that has been resolved and then regressed and resolved again
        group, starts, ends, activities = self._create_resolved_group()
        assert group.status == GroupStatus.RESOLVED
        assert group.substatus is None
        self.test_cases.append(("resolved_group", group, starts, ends, activities))

        # Create a group that has been resolved and then regressed
        group, starts, ends, activities = self._create_regressed_group()
        assert group.status == GroupStatus.UNRESOLVED
        assert group.substatus == GroupSubStatus.REGRESSED
        self.test_cases.append(("regressed_group", group, starts, ends, activities))

        # Create a new group that has never been resolved
        group = Group.objects.create(
            project=self.project,
            status=GroupStatus.UNRESOLVED,
            substatus=GroupSubStatus.NEW,
            first_seen=self.now - timedelta(days=3),
        )
        assert group.status == GroupStatus.UNRESOLVED
        assert group.substatus == GroupSubStatus.NEW
        self.test_cases.append(("new_group", group, [group.first_seen], [None], [None]))

        # Create a group that has been ignored until escalating
        group, starts, ends, activities = self._create_ignored_group()
        assert group.status == GroupStatus.IGNORED
        assert group.substatus == GroupSubStatus.UNTIL_ESCALATING
        self.test_cases.append(("ignored_group", group, starts, ends, activities))

        # Create an unresolved group that already has an open period
        group = Group.objects.create(
            project=self.project,
            status=GroupStatus.UNRESOLVED,
            substatus=GroupSubStatus.NEW,
            first_seen=self.now - timedelta(days=5),
        )
        GroupOpenPeriod.objects.create(
            group=group,
            project=self.project,
            date_started=group.first_seen,
        )
        assert GroupOpenPeriod.objects.filter(group=group).count() == 1
        self.test_cases.append(
            ("unresolved_group_with_open_period", group, [group.first_seen], [None], [None])
        )

        # Create a resolved group that already has an open period
        group, starts, ends, activities = self._create_resolved_group_with_open_period()
        assert GroupOpenPeriod.objects.filter(group=group).count() == 1
        assert group.status == GroupStatus.RESOLVED
        assert group.substatus is None
        self.test_cases.append(("resolved_group_with_open_period", group, starts, ends, activities))

        # Create a group that has been auto-resolved
        group, starts, ends, activities = self._create_auto_resolved_group()
        assert group.status == GroupStatus.RESOLVED
        assert group.substatus is None
        self.test_cases.append(("auto_resolved_group", group, starts, ends, activities))

        # Create a group that has been auto-resolved and then regressed
        group, starts, ends, activities = self._create_auto_resolved_regressed_group()
        assert group.status == GroupStatus.UNRESOLVED
        assert group.substatus == GroupSubStatus.REGRESSED
        self.test_cases.append(("auto_resolved_regressed_group", group, starts, ends, activities))

        # Create a group that has been regressed and then auto-resolved and then regressed again
        group, starts, ends, activities = self._create_regressed_group_with_auto_resolved_cycles()
        assert group.status == GroupStatus.UNRESOLVED
        assert group.substatus == GroupSubStatus.REGRESSED
        self.test_cases.append(
            ("regressed_group_with_auto_resolved_cycles", group, starts, ends, activities)
        )

        # Create a group with activities before the first_seen date
        group, _, _, activities = self._create_resolved_group()
        activities[0].datetime = group.first_seen - timedelta(days=4)
        activities[0].save()

        self.test_cases.append(
            (
                "resolved_group_with_activities_before_first_seen",
                group,
                [group.first_seen],
                [activities[-1].datetime],
                [activities[-1]],
            )
        )

    def test(self):
        for description, group, starts, ends, activities in self.test_cases:
            group.refresh_from_db()
            open_periods = GroupOpenPeriod.objects.filter(group=group).order_by("date_started")
            assert len(open_periods) == len(
                starts
            ), f"{description}: Expected {len(starts)} open periods, got {len(open_periods)}"
            for i, open_period in enumerate(open_periods):
                assert (
                    open_period.date_started == starts[i]
                ), f"{description}: Expected open period start date {starts[i]}, got {open_period.date_started}"
                assert (
                    open_period.date_ended == ends[i]
                ), f"{description}: Expected open period end date {ends[i]}, got {open_period.date_ended}"
                assert (
                    open_period.resolution_activity == activities[i]
                ), f"{description}: Expected resolution activity {activities[i]}, got {open_period.resolution_activity}"
