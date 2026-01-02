from __future__ import annotations

from datetime import datetime, timedelta
from unittest.mock import MagicMock, patch

from django.utils import timezone

from sentry.models.group import Group, GroupStatus
from sentry.tasks.delete_pending_groups import (
    MAX_LAST_SEEN_DAYS,
    MIN_LAST_SEEN_HOURS,
    delete_pending_groups,
)
from sentry.testutils.cases import TestCase
from sentry.types.group import GroupSubStatus


class DeletePendingGroupsTest(TestCase):
    def _count_groups_in_deletion_status_and_valid_date_range(self) -> int:
        """Count groups with deletion statuses in the valid date range."""
        return Group.objects.filter(
            status__in=[GroupStatus.PENDING_DELETION, GroupStatus.DELETION_IN_PROGRESS],
            last_seen__gte=self._days_ago(MAX_LAST_SEEN_DAYS),
            last_seen__lte=self._hours_ago(MIN_LAST_SEEN_HOURS),
        ).count()

    def _days_ago(self, days: int) -> datetime:
        return timezone.now() - timedelta(days=days)

    def _hours_ago(self, hours: int) -> datetime:
        return timezone.now() - timedelta(hours=hours)

    def test_schedules_only_groups_within_valid_date_range(self) -> None:
        """Test that only groups with last_seen between 24h-90d are scheduled for deletion."""
        project = self.create_project()

        # Too recent - within 4 hours (should NOT be scheduled)
        too_recent = self.create_group(
            project=project, status=GroupStatus.PENDING_DELETION, last_seen=self._hours_ago(4)
        )

        # Valid range - should be scheduled
        valid_group = self.create_group(
            project=project, status=GroupStatus.PENDING_DELETION, last_seen=self._hours_ago(7)
        )

        # Too old - over 90 days (should NOT be scheduled)
        too_old = self.create_group(
            project=project, status=GroupStatus.DELETION_IN_PROGRESS, last_seen=self._days_ago(91)
        )

        # Wrong status - should NOT be scheduled
        wrong_status = self.create_group(
            project=project,
            status=GroupStatus.UNRESOLVED,
            substatus=GroupSubStatus.NEW,
            last_seen=self._days_ago(5),
        )

        with patch(
            "sentry.api.helpers.group_index.delete.delete_groups_for_project.apply_async"
        ) as mock_delete_task:
            delete_pending_groups()

            # Verify only the valid group was scheduled
            mock_delete_task.assert_called_once()
            call_kwargs = mock_delete_task.call_args.kwargs["kwargs"]
            assert call_kwargs["object_ids"] == [valid_group.id]
            assert call_kwargs["project_id"] == project.id

        assert self._count_groups_in_deletion_status_and_valid_date_range() != 0
        with self.tasks():
            delete_pending_groups()

        assert self._count_groups_in_deletion_status_and_valid_date_range() == 0
        assert list(Group.objects.all().values_list("id", flat=True).order_by("id")) == [
            too_recent.id,
            too_old.id,
            wrong_status.id,
        ]

    @patch("sentry.api.helpers.group_index.delete.delete_groups_for_project.apply_async")
    def test_groups_by_project(self, mock_delete_task: MagicMock) -> None:
        """Test that groups are properly grouped by project when scheduling deletion."""
        project1 = self.create_project()
        project2 = self.create_project()

        group1 = self.create_group(
            project=project1, status=GroupStatus.PENDING_DELETION, last_seen=self._days_ago(2)
        )
        group2 = self.create_group(
            project=project1, status=GroupStatus.PENDING_DELETION, last_seen=self._days_ago(2)
        )
        group3 = self.create_group(
            project=project2, status=GroupStatus.PENDING_DELETION, last_seen=self._days_ago(2)
        )

        delete_pending_groups()

        assert mock_delete_task.call_count == 2

        # Verify both projects got their deletion tasks scheduled
        all_calls = mock_delete_task.call_args_list
        project_ids = {call.kwargs["kwargs"]["project_id"] for call in all_calls}
        assert project_ids == {project1.id, project2.id}

        # Verify correct groups are in each call
        for call in all_calls:
            call_kwargs = call.kwargs["kwargs"]
            if call_kwargs["project_id"] == project1.id:
                assert set(call_kwargs["object_ids"]) == {group1.id, group2.id}
            elif call_kwargs["project_id"] == project2.id:
                assert set(call_kwargs["object_ids"]) == {group3.id}

    @patch("sentry.api.helpers.group_index.delete.GROUP_CHUNK_SIZE", 10)
    @patch("sentry.api.helpers.group_index.delete.delete_groups_for_project.apply_async")
    @patch("sentry.tasks.delete_pending_groups.metrics.incr")
    def test_chunks_large_batches(
        self,
        mock_metrics_incr: MagicMock,
        mock_delete_task: MagicMock,
    ) -> None:
        """Test that groups are chunked according to GROUP_CHUNK_SIZE when scheduling deletion."""
        GROUP_CHUNK_SIZE = 10
        GROUPS_MORE_THAN_CHUNK_SIZE = 5
        project = self.create_project()

        # Create more groups than GROUP_CHUNK_SIZE (10 in this test)
        num_groups = GROUPS_MORE_THAN_CHUNK_SIZE + GROUP_CHUNK_SIZE
        for _ in range(num_groups):
            self.create_group(
                project=project, status=GroupStatus.PENDING_DELETION, last_seen=self._days_ago(2)
            )

        delete_pending_groups()

        # Should be called twice: one chunk of 10 and one of 5
        assert mock_delete_task.call_count == 2

        # Verify first chunk has GROUP_CHUNK_SIZE groups
        first_call_kwargs = mock_delete_task.call_args_list[0].kwargs["kwargs"]
        assert len(first_call_kwargs["object_ids"]) == GROUP_CHUNK_SIZE

        # Verify second chunk has remaining groups
        second_call_kwargs = mock_delete_task.call_args_list[1].kwargs["kwargs"]
        assert len(second_call_kwargs["object_ids"]) == GROUPS_MORE_THAN_CHUNK_SIZE

        # Assert metrics are called with correct totals
        incr_calls = mock_metrics_incr.call_args_list
        incr_names = [c.args[0] for c in incr_calls]
        assert "delete_pending_groups.groups_scheduled" in incr_names
        assert "delete_pending_groups.tasks_scheduled" in incr_names

        groups_scheduled_call = next(
            c for c in incr_calls if c.args[0] == "delete_pending_groups.groups_scheduled"
        )
        assert groups_scheduled_call.kwargs["amount"] == num_groups

        tasks_scheduled_call = next(
            c for c in incr_calls if c.args[0] == "delete_pending_groups.tasks_scheduled"
        )
        assert tasks_scheduled_call.kwargs["amount"] == 2
