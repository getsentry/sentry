from sentry.issues.ongoing import bulk_transition_group_to_ongoing
from sentry.models.activity import Activity
from sentry.models.group import GroupStatus
from sentry.models.grouphistory import GroupHistory, GroupHistoryStatus
from sentry.testutils.cases import TestCase
from sentry.types.activity import ActivityType
from sentry.types.group import GroupSubStatus, PriorityLevel


class TransitionNewToOngoingTest(TestCase):
    def test_new_to_ongoing(self) -> None:
        group = self.create_group(status=GroupStatus.UNRESOLVED, substatus=GroupSubStatus.NEW)

        bulk_transition_group_to_ongoing(GroupStatus.UNRESOLVED, GroupSubStatus.NEW, [group.id])
        assert Activity.objects.filter(
            group=group, type=ActivityType.AUTO_SET_ONGOING.value
        ).exists()
        assert GroupHistory.objects.filter(
            group=group, status=GroupHistoryStatus.UNRESOLVED
        ).exists()
        assert not Activity.objects.filter(
            group=group, type=ActivityType.SET_PRIORITY.value
        ).exists()

    def test_regressed_to_ongoing(self) -> None:
        group = self.create_group(status=GroupStatus.UNRESOLVED, substatus=GroupSubStatus.REGRESSED)

        bulk_transition_group_to_ongoing(
            GroupStatus.UNRESOLVED, GroupSubStatus.REGRESSED, [group.id]
        )
        assert Activity.objects.filter(
            group=group, type=ActivityType.AUTO_SET_ONGOING.value
        ).exists()
        assert GroupHistory.objects.filter(
            group=group, status=GroupHistoryStatus.UNRESOLVED
        ).exists()
        assert not Activity.objects.filter(
            group=group, type=ActivityType.SET_PRIORITY.value
        ).exists()

    def test_escalating_to_ongoing(self) -> None:
        group = self.create_group(
            status=GroupStatus.UNRESOLVED,
            substatus=GroupSubStatus.ESCALATING,
            priority=PriorityLevel.HIGH,
        )
        group.data.get("metadata", {}).update({"initial_priority": PriorityLevel.MEDIUM})
        group.save()

        bulk_transition_group_to_ongoing(
            GroupStatus.UNRESOLVED, GroupSubStatus.ESCALATING, [group.id]
        )
        assert Activity.objects.filter(
            group=group, type=ActivityType.AUTO_SET_ONGOING.value
        ).exists()

        group.refresh_from_db()
        assert group.priority == PriorityLevel.MEDIUM
        assert GroupHistory.objects.filter(
            group=group, status=GroupHistoryStatus.PRIORITY_MEDIUM
        ).exists()
        assert Activity.objects.filter(group=group, type=ActivityType.SET_PRIORITY.value).exists()
