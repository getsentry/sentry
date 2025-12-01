from __future__ import annotations

from datetime import datetime, timedelta
from unittest.mock import MagicMock, patch

from django.utils import timezone

from sentry import audit_log
from sentry.models.auditlogentry import AuditLogEntry
from sentry.models.group import Group, GroupStatus
from sentry.silo.base import SiloMode
from sentry.tasks.delete_pending_groups import (
    MAX_LAST_SEEN_DAYS,
    MIN_LAST_SEEN_HOURS,
    delete_pending_groups,
)
from sentry.testutils.cases import TestCase
from sentry.testutils.silo import assume_test_silo_mode
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

    def _create_audit_log_for_group_deletion(self, group: Group, deletion_time: datetime) -> None:
        """Create an audit log entry for group deletion."""
        with assume_test_silo_mode(SiloMode.CONTROL):
            AuditLogEntry.objects.create(
                organization_id=group.organization.id,
                event=audit_log.get_event_id("ISSUE_DELETE"),
                target_object=group.id,
                datetime=deletion_time,
                actor=self.user,
                ip_address="127.0.0.1",
                data={"issue_id": group.id, "project_slug": group.project.slug},
            )

    def test_schedules_only_groups_within_valid_date_range(self) -> None:
        """Test that only groups with last_seen between 24h-90d and audit logs are scheduled for deletion."""
        project = self.create_project()

        # Too recent - within 4 hours (should NOT be scheduled due to recent audit log)
        too_recent = self.create_group(
            project=project, status=GroupStatus.PENDING_DELETION, last_seen=self._hours_ago(4)
        )
        self._create_audit_log_for_group_deletion(too_recent, self._hours_ago(4))

        # Valid range - should be scheduled (has audit log older than 6 hours)
        valid_group = self.create_group(
            project=project, status=GroupStatus.PENDING_DELETION, last_seen=self._hours_ago(7)
        )
        self._create_audit_log_for_group_deletion(valid_group, self._hours_ago(7))

        # Too old - over 90 days (should NOT be scheduled due to old last_seen)
        too_old = self.create_group(
            project=project, status=GroupStatus.DELETION_IN_PROGRESS, last_seen=self._days_ago(91)
        )
        self._create_audit_log_for_group_deletion(too_old, self._days_ago(91))

        # Wrong status - should NOT be scheduled
        wrong_status = self.create_group(
            project=project,
            status=GroupStatus.UNRESOLVED,
            substatus=GroupSubStatus.NEW,
            last_seen=self._days_ago(5),
        )

        # No audit log - should NOT be scheduled even with valid status and date
        no_audit_log = self.create_group(
            project=project, status=GroupStatus.PENDING_DELETION, last_seen=self._hours_ago(8)
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

        # Verify all expected groups still exist (none were deleted yet, only scheduled)
        assert set(Group.objects.all().values_list("id", flat=True)) == {
            too_recent.id,
            valid_group.id,
            too_old.id,
            wrong_status.id,
            no_audit_log.id,
        }

    @patch("sentry.api.helpers.group_index.delete.delete_groups_for_project.apply_async")
    def test_groups_by_project(self, mock_delete_task: MagicMock) -> None:
        """Test that groups are properly grouped by project when scheduling deletion."""
        project1 = self.create_project()
        project2 = self.create_project()

        group1 = self.create_group(
            project=project1, status=GroupStatus.PENDING_DELETION, last_seen=self._days_ago(2)
        )
        self._create_audit_log_for_group_deletion(group1, self._days_ago(2))

        group2 = self.create_group(
            project=project1, status=GroupStatus.PENDING_DELETION, last_seen=self._days_ago(2)
        )
        self._create_audit_log_for_group_deletion(group2, self._days_ago(2))

        group3 = self.create_group(
            project=project2, status=GroupStatus.PENDING_DELETION, last_seen=self._days_ago(2)
        )
        self._create_audit_log_for_group_deletion(group3, self._days_ago(2))

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
        deletion_time = self._days_ago(2)
        for _ in range(num_groups):
            group = self.create_group(
                project=project, status=GroupStatus.PENDING_DELETION, last_seen=deletion_time
            )
            self._create_audit_log_for_group_deletion(group, deletion_time)

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

    @patch("sentry.api.helpers.group_index.delete.delete_groups_for_project.apply_async")
    def test_respects_audit_log_time_range(self, mock_delete_task: MagicMock) -> None:
        """Test that only audit logs within the 90-day time range are considered."""
        project = self.create_project()

        # Group with very old audit log (100 days ago) - should NOT be scheduled
        # even though it has valid status and last_seen
        very_old_audit = self.create_group(
            project=project, status=GroupStatus.PENDING_DELETION, last_seen=self._days_ago(10)
        )
        self._create_audit_log_for_group_deletion(very_old_audit, self._days_ago(100))

        # Group with audit log exactly at boundary (91 days ago) - should NOT be scheduled
        at_boundary = self.create_group(
            project=project, status=GroupStatus.PENDING_DELETION, last_seen=self._days_ago(20)
        )
        self._create_audit_log_for_group_deletion(at_boundary, self._days_ago(91))

        # Group with audit log just inside the range (89 days ago) - should be scheduled
        inside_range = self.create_group(
            project=project, status=GroupStatus.PENDING_DELETION, last_seen=self._days_ago(30)
        )
        self._create_audit_log_for_group_deletion(inside_range, self._days_ago(89))

        delete_pending_groups()

        # Verify only the group with audit log inside the time range was scheduled
        mock_delete_task.assert_called_once()
        call_kwargs = mock_delete_task.call_args.kwargs["kwargs"]
        assert call_kwargs["object_ids"] == [inside_range.id]
        assert call_kwargs["project_id"] == project.id
