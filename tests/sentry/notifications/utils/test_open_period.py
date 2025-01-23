from django.utils import timezone

from sentry.models.activity import Activity
from sentry.models.group import GroupStatus
from sentry.notifications.utils.open_period import open_period_start_for_group
from sentry.testutils.cases import TestCase
from sentry.types.activity import ActivityType


class OpenPeriodTestCase(TestCase):
    def setUp(self):
        self.group = self.create_group()

    def test_new_group_returns_first_seen(self) -> None:
        """Test that a new group returns first_seen as the open period start"""
        start = open_period_start_for_group(self.group)
        assert start == self.group.first_seen

    def test_unresolved_group_returns_unresolved_activity(self) -> None:
        """Test that a group with unresolved activity returns that activity time"""
        # First resolve the group
        self.group.status = GroupStatus.RESOLVED
        self.group.save()
        resolved_time = timezone.now()
        Activity.objects.create(
            group=self.group,
            project=self.group.project,
            type=ActivityType.SET_RESOLVED.value,
            datetime=resolved_time,
        )

        # Then unresolve it
        unresolved_time = timezone.now()
        self.group.status = GroupStatus.UNRESOLVED
        self.group.save()
        unresolved_activity = Activity.objects.create(
            group=self.group,
            project=self.group.project,
            type=ActivityType.SET_REGRESSION.value,
            datetime=unresolved_time,
        )

        start = open_period_start_for_group(self.group)
        assert start is not None
        assert start == unresolved_activity.datetime

    def test_multiple_unresolved_returns_latest(self) -> None:
        """Test that with multiple unresolved activities, we get the latest one"""
        # Create first unresolved activity
        first_unresolved = timezone.now()
        Activity.objects.create(
            group=self.group,
            project=self.group.project,
            type=ActivityType.SET_REGRESSION.value,
            datetime=first_unresolved,
        )

        # Create second unresolved activity
        second_unresolved = timezone.now()
        second_activity = Activity.objects.create(
            group=self.group,
            project=self.group.project,
            type=ActivityType.SET_REGRESSION.value,
            datetime=second_unresolved,
        )

        start = open_period_start_for_group(self.group)
        assert start is not None
        assert start == second_activity.datetime
