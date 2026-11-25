from datetime import timedelta
from unittest.mock import MagicMock, patch

import pytest
import rest_framework
from django.db import router, transaction
from django.utils import timezone

from sentry.issues.grouptype import PerformanceNPlusOneGroupType
from sentry.issues.merge import handle_merge
from sentry.issues.models.issuemergeoperation import (
    IssueMergeOperation,
    IssueUnmergeOperation,
    OperationStatus,
    OperationStep,
    StaleOperationBatch,
    UnfinishedIssueOperations,
    unfinished_operations_for_group,
)
from sentry.models.activity import Activity
from sentry.models.group import Group, GroupStatus
from sentry.models.groupinbox import GroupInboxReason, add_group_to_inbox
from sentry.testutils.cases import TestCase
from sentry.testutils.skips import requires_snuba
from sentry.types.activity import ActivityType
from sentry.types.group import GroupSubStatus
from sentry.utils import json


@requires_snuba
class HandleIssueMergeTest(TestCase):
    def setUp(self) -> None:
        self.groups = []
        self.project_lookup = {self.project.id: self.project}
        for _ in range(5):
            group = self.create_group(
                status=GroupStatus.UNRESOLVED, substatus=GroupSubStatus.ONGOING
            )
            add_group_to_inbox(group, GroupInboxReason.NEW)
            self.groups.append(group)

    @patch("sentry.tasks.merge.start_merge_groups.delay")
    def test_handle_merge(self, merge_groups: MagicMock) -> None:
        Activity.objects.all().delete()
        merge = handle_merge(self.groups, self.project_lookup, self.user)

        groups = Group.objects.filter(id__in=[g.id for g in self.groups])

        assert len(groups.filter(status=GroupStatus.PENDING_MERGE)) == 4
        assert len(groups.filter(substatus__isnull=True)) == 4
        assert merge_groups.called

        assert merge_groups.call_args[1]["eventstream_state"][
            "new_group_first_seen"
        ] == json.datetime_to_str(min([g.first_seen for g in groups]))

        primary_group = self.groups[0]
        assert Activity.objects.filter(type=ActivityType.MERGE.value, group=primary_group)
        assert merge["parent"] == str(primary_group.id)
        assert len(merge["children"]) == 4
        assert primary_group.status == GroupStatus.UNRESOLVED
        assert primary_group.substatus == GroupSubStatus.ONGOING
        assert "operation_id" not in merge_groups.call_args.kwargs

    def test_create_failure_does_not_leave_groups_pending_merge(self) -> None:
        with (
            self.feature("organizations:issue-merge-operation-tracking"),
            patch.object(
                IssueMergeOperation.objects, "create", side_effect=RuntimeError("unavailable")
            ),
            patch("sentry.tasks.merge.start_merge_groups.delay") as dispatch,
            pytest.raises(RuntimeError, match="unavailable"),
        ):
            handle_merge(self.groups, self.project_lookup, self.user)
        dispatch.assert_not_called()
        assert not Group.objects.filter(
            project=self.project, status=GroupStatus.PENDING_MERGE
        ).exists()

    def test_handle_merge_performance_issues(self) -> None:
        group = Group.objects.create(
            project=self.project, type=PerformanceNPlusOneGroupType.type_id
        )
        add_group_to_inbox(group, GroupInboxReason.NEW)
        self.groups.append(group)

        with pytest.raises(rest_framework.exceptions.ValidationError) as e:
            handle_merge(self.groups, self.project_lookup, self.user)
        assert e.match("Only error issues can be merged.")


class IssueMergeOperationTest(TestCase):
    lease = timedelta(minutes=5)

    def test_unfinished_operations_are_scoped_to_project_and_issue(self) -> None:
        merge = self.create_issue_merge_operation([1, 2], 3)
        unmerge = self.create_issue_unmerge_operation(
            2,
            ["a" * 32],
            destination_group_id=4,
            status=OperationStatus.NEEDS_ATTENTION,
        )
        self.create_issue_merge_operation([2], 3, project=self.create_project())
        self.create_issue_unmerge_operation(2, ["b" * 32], status=OperationStatus.COMPLETE)
        self.create_issue_merge_operation([2], 5, status=OperationStatus.COMPLETE)

        def unfinished(group_id: int) -> UnfinishedIssueOperations:
            return unfinished_operations_for_group(project_id=self.project.id, group_id=group_id)

        assert unfinished(2) == UnfinishedIssueOperations(merges=[merge], unmerges=[unmerge])
        assert unfinished(3) == UnfinishedIssueOperations(merges=[merge], unmerges=[])
        assert unfinished(4) == UnfinishedIssueOperations(merges=[], unmerges=[unmerge])
        assert unfinished(5) == UnfinishedIssueOperations(merges=[], unmerges=[])

    def test_rollback_and_replay_a_batch(self) -> None:
        operation = self.create_issue_unmerge_operation(11, ["a" * 32], retries_without_progress=2)
        token = operation.claim(lease_duration=self.lease)
        assert token is not None
        cursor = {"timestamp": "2024-01-01T00:00:00Z", "event_id": "a" * 32}

        with pytest.raises(RuntimeError, match="interrupted batch"):
            with operation.apply_batch(
                worker_token=token,
                expected_cursor={},
                next_cursor=cursor,
                lease_duration=self.lease,
            ) as locked:
                locked.update(destination_group_id=12)
                raise RuntimeError("interrupted batch")
        operation.refresh_from_db()
        assert operation.destination_group_id is None
        assert operation.batch_cursor == {}

        def apply() -> None:
            with operation.apply_batch(
                worker_token=token,
                expected_cursor={},
                next_cursor=cursor,
                lease_duration=self.lease,
            ) as locked:
                locked.update(destination_group_id=12)

        with pytest.raises(RuntimeError, match="roll back"):
            with transaction.atomic(using=router.db_for_write(IssueUnmergeOperation)):
                apply()
                raise RuntimeError("roll back")

        operation.refresh_from_db()
        assert operation.destination_group_id is None
        assert operation.batch_cursor == {}
        assert operation.retries_without_progress == 2

        apply()
        committed = IssueUnmergeOperation.objects.get(project_id=self.project.id, id=operation.id)
        assert committed.destination_group_id == 12
        assert committed.batch_cursor == cursor
        assert committed.retries_without_progress == 0
        with pytest.raises(StaleOperationBatch):
            apply()

    def test_replaced_worker_cannot_apply_its_batch(self) -> None:
        operation = self.create_issue_merge_operation([11], 12)
        first = operation.claim(lease_duration=self.lease)
        assert first is not None
        assert operation.claim(lease_duration=self.lease) is None
        operation.update(lease_expires_at=timezone.now() - self.lease)
        second = operation.claim(lease_duration=self.lease)
        assert second is not None and second != first

        with pytest.raises(StaleOperationBatch):
            with operation.apply_batch(
                worker_token=first,
                expected_cursor={},
                next_cursor={"source": 11},
                lease_duration=self.lease,
            ):
                pytest.fail("the replaced worker began applying local changes")

        with operation.apply_batch(
            worker_token=second,
            expected_cursor={},
            next_cursor={"source": 11},
            lease_duration=self.lease,
        ):
            pass
        operation.refresh_from_db()
        assert operation.batch_cursor == {"source": 11}

    def test_only_runnable_work_can_be_claimed(self) -> None:
        operation = self.create_issue_merge_operation(
            [11],
            12,
            status=OperationStatus.RUNNING,
            step=OperationStep.WAIT_FOR_SNUBA,
            lease_expires_at=timezone.now() - self.lease,
        )
        assert operation.claim(lease_duration=self.lease) is None
        operation.update(status=OperationStatus.NEEDS_ATTENTION, step=OperationStep.MOVE)
        assert operation.claim(lease_duration=self.lease) is None
