from __future__ import annotations

from datetime import datetime, timedelta
from unittest.mock import MagicMock, patch

from django.utils import timezone

from sentry import audit_log
from sentry.models.auditlogentry import AuditLogEntry
from sentry.models.group import Group, GroupStatus
from sentry.silo.base import SiloMode
from sentry.tasks.delete_pending_groups import PENDING_DELETION_HOURS, delete_pending_groups
from sentry.testutils.cases import TestCase
from sentry.testutils.silo import assume_test_silo_mode
from sentry.types.group import GroupSubStatus


class DeletePendingGroupsTest(TestCase):
    def _create_audit_log_entry(self, group: Group, hours_ago: int) -> AuditLogEntry:
        """Create an ISSUE_DELETE audit log entry for a group."""
        datetime_value = timezone.now() - timedelta(hours=hours_ago)
        with assume_test_silo_mode(SiloMode.CONTROL):
            return AuditLogEntry.objects.create(
                organization_id=group.project.organization_id,
                target_object=group.id,
                event=audit_log.get_event_id("ISSUE_DELETE"),
                datetime=datetime_value,
                actor=self.user,
                data={"issue_id": group.id, "project_slug": group.project.slug},
            )

    def _count_groups_in_deletion_status_with_old_audit_logs(self) -> int:
        """Count groups with deletion statuses that have audit logs older than PENDING_DELETION_HOURS."""
        cutoff_time = timezone.now() - timedelta(hours=PENDING_DELETION_HOURS)
        issue_delete_event_id = audit_log.get_event_id("ISSUE_DELETE")

        # Get groups that have audit log entries older than cutoff
        with assume_test_silo_mode(SiloMode.CONTROL):
            old_audit_log_group_ids = set(
                AuditLogEntry.objects.filter(
                    event=issue_delete_event_id,
                    datetime__lt=cutoff_time,
                )
                .values_list("target_object", flat=True)
                .distinct()
            )

        if not old_audit_log_group_ids:
            return 0

        return Group.objects.filter(
            id__in=old_audit_log_group_ids,
            status__in=[GroupStatus.PENDING_DELETION, GroupStatus.DELETION_IN_PROGRESS],
        ).count()

    def _days_ago(self, days: int) -> datetime:
        return timezone.now() - timedelta(days=days)

    def _hours_ago(self, hours: int) -> datetime:
        return timezone.now() - timedelta(hours=hours)

    def test_schedules_only_groups_with_old_audit_logs(self) -> None:
        """Test that only groups with audit logs older than PENDING_DELETION_HOURS are scheduled."""
        project = self.create_project()

        # Too recent - audit log within 4 hours (should NOT be scheduled)
        too_recent = self.create_group(
            project=project, status=GroupStatus.PENDING_DELETION, last_seen=self._hours_ago(4)
        )
        self._create_audit_log_entry(too_recent, hours_ago=4)

        # Valid - audit log older than 24 hours (should be scheduled)
        valid_group = self.create_group(
            project=project, status=GroupStatus.PENDING_DELETION, last_seen=self._hours_ago(48)
        )
        self._create_audit_log_entry(valid_group, hours_ago=48)

        # No audit log - should NOT be scheduled (edge case)
        no_audit_log = self.create_group(
            project=project, status=GroupStatus.DELETION_IN_PROGRESS, last_seen=self._days_ago(5)
        )

        # Wrong status - should NOT be scheduled even with old audit log
        wrong_status = self.create_group(
            project=project,
            status=GroupStatus.UNRESOLVED,
            substatus=GroupSubStatus.NEW,
            last_seen=self._days_ago(5),
        )
        self._create_audit_log_entry(wrong_status, hours_ago=48)

        with patch(
            "sentry.api.helpers.group_index.delete.delete_groups_for_project.apply_async"
        ) as mock_delete_task:
            with assume_test_silo_mode(SiloMode.MONOLITH):
                delete_pending_groups()

            # Verify only the valid group was scheduled
            mock_delete_task.assert_called_once()
            call_kwargs = mock_delete_task.call_args.kwargs["kwargs"]
            assert call_kwargs["object_ids"] == [valid_group.id]
            assert call_kwargs["project_id"] == project.id

        assert self._count_groups_in_deletion_status_with_old_audit_logs() != 0
        with self.tasks():
            with assume_test_silo_mode(SiloMode.MONOLITH):
                delete_pending_groups()

        assert self._count_groups_in_deletion_status_with_old_audit_logs() == 0
        assert list(Group.objects.all().values_list("id", flat=True).order_by("id")) == [
            too_recent.id,
            no_audit_log.id,
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
        self._create_audit_log_entry(group1, hours_ago=48)

        group2 = self.create_group(
            project=project1, status=GroupStatus.PENDING_DELETION, last_seen=self._days_ago(2)
        )
        self._create_audit_log_entry(group2, hours_ago=48)

        group3 = self.create_group(
            project=project2, status=GroupStatus.PENDING_DELETION, last_seen=self._days_ago(2)
        )
        self._create_audit_log_entry(group3, hours_ago=48)

        with assume_test_silo_mode(SiloMode.MONOLITH):
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
            group = self.create_group(
                project=project, status=GroupStatus.PENDING_DELETION, last_seen=self._days_ago(2)
            )
            self._create_audit_log_entry(group, hours_ago=48)

        with assume_test_silo_mode(SiloMode.MONOLITH):
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
