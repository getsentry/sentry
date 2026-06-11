from datetime import timedelta

from django.utils import timezone

from sentry.issues.progress import IssueProgressState, get_group_progress_states
from sentry.models.groupassignee import GroupAssignee
from sentry.testutils.cases import TestCase
from sentry.types.activity import ActivityType


class GetGroupProgressStatesTest(TestCase):
    def test_empty_group_list(self) -> None:
        assert get_group_progress_states([]) == {}

    def test_no_activities_unassigned(self) -> None:
        group = self.create_group()
        result = get_group_progress_states([group.id])
        assert result[group.id] == IssueProgressState.IDENTIFIED

    def test_no_activities_assigned(self) -> None:
        group = self.create_group()
        GroupAssignee.objects.assign(group, self.user)
        result = get_group_progress_states([group.id])
        assert result[group.id] == IssueProgressState.TRIAGED

    def test_diagnosed_state(self) -> None:
        group = self.create_group()
        self.create_group_activity(group=group, type=ActivityType.SEER_RCA_COMPLETED.value)
        result = get_group_progress_states([group.id])
        assert result[group.id] == IssueProgressState.DIAGNOSED

    def test_fix_proposed_state(self) -> None:
        group = self.create_group()
        self.create_group_activity(
            group=group, type=ActivityType.SET_RESOLVED_IN_PULL_REQUEST.value
        )
        result = get_group_progress_states([group.id])
        assert result[group.id] == IssueProgressState.FIX_PROPOSED

    def test_fix_proposed_seer_pr(self) -> None:
        group = self.create_group()
        self.create_group_activity(group=group, type=ActivityType.SEER_PR_CREATED.value)
        result = get_group_progress_states([group.id])
        assert result[group.id] == IssueProgressState.FIX_PROPOSED

    def test_fix_applied_state(self) -> None:
        group = self.create_group()
        self.create_group_activity(group=group, type=ActivityType.SET_RESOLVED.value)
        result = get_group_progress_states([group.id])
        assert result[group.id] == IssueProgressState.FIX_APPLIED

    def test_fix_applied_in_commit(self) -> None:
        group = self.create_group()
        self.create_group_activity(group=group, type=ActivityType.SET_RESOLVED_IN_COMMIT.value)
        result = get_group_progress_states([group.id])
        assert result[group.id] == IssueProgressState.FIX_APPLIED

    def test_fix_applied_in_release(self) -> None:
        group = self.create_group()
        self.create_group_activity(group=group, type=ActivityType.SET_RESOLVED_IN_RELEASE.value)
        result = get_group_progress_states([group.id])
        assert result[group.id] == IssueProgressState.FIX_APPLIED

    def test_highest_state_wins(self) -> None:
        group = self.create_group()
        now = timezone.now()
        self.create_group_activity(
            group=group,
            type=ActivityType.SEER_RCA_COMPLETED.value,
            datetime=now - timedelta(hours=2),
        )
        self.create_group_activity(
            group=group,
            type=ActivityType.SET_RESOLVED.value,
            datetime=now - timedelta(hours=1),
        )
        result = get_group_progress_states([group.id])
        assert result[group.id] == IssueProgressState.FIX_APPLIED

    def test_regression_resets_progress(self) -> None:
        group = self.create_group()
        now = timezone.now()
        self.create_group_activity(
            group=group,
            type=ActivityType.SEER_RCA_COMPLETED.value,
            datetime=now - timedelta(hours=2),
        )
        self.create_group_activity(
            group=group,
            type=ActivityType.SET_REGRESSION.value,
            datetime=now - timedelta(hours=1),
        )
        result = get_group_progress_states([group.id])
        assert result[group.id] == IssueProgressState.IDENTIFIED

    def test_regression_resets_to_triaged_when_assigned(self) -> None:
        group = self.create_group()
        GroupAssignee.objects.assign(group, self.user)
        now = timezone.now()
        self.create_group_activity(
            group=group,
            type=ActivityType.SET_RESOLVED.value,
            datetime=now - timedelta(hours=2),
        )
        self.create_group_activity(
            group=group,
            type=ActivityType.SET_REGRESSION.value,
            datetime=now - timedelta(hours=1),
        )
        result = get_group_progress_states([group.id])
        assert result[group.id] == IssueProgressState.TRIAGED

    def test_activity_after_regression_counts(self) -> None:
        group = self.create_group()
        now = timezone.now()
        self.create_group_activity(
            group=group,
            type=ActivityType.SET_RESOLVED.value,
            datetime=now - timedelta(hours=3),
        )
        self.create_group_activity(
            group=group,
            type=ActivityType.SET_REGRESSION.value,
            datetime=now - timedelta(hours=2),
        )
        self.create_group_activity(
            group=group,
            type=ActivityType.SEER_RCA_COMPLETED.value,
            datetime=now - timedelta(hours=1),
        )
        result = get_group_progress_states([group.id])
        assert result[group.id] == IssueProgressState.DIAGNOSED

    def test_bulk_multiple_groups(self) -> None:
        group1 = self.create_group()
        group2 = self.create_group()
        group3 = self.create_group()

        self.create_group_activity(group=group1, type=ActivityType.SEER_RCA_COMPLETED.value)
        self.create_group_activity(group=group2, type=ActivityType.SET_RESOLVED.value)
        GroupAssignee.objects.assign(group3, self.user)

        result = get_group_progress_states([group1.id, group2.id, group3.id])
        assert result[group1.id] == IssueProgressState.DIAGNOSED
        assert result[group2.id] == IssueProgressState.FIX_APPLIED
        assert result[group3.id] == IssueProgressState.TRIAGED
