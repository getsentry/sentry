from __future__ import annotations

from datetime import timedelta

from django.utils import timezone

from sentry.db.deletion import BulkDeleteQuery
from sentry.models.group import Group
from sentry.models.project import Project
from sentry.testutils.cases import TestCase


class BulkDeleteQueryTest(TestCase):
    def test_project_restriction(self) -> None:
        project1 = self.create_project()
        group1_1 = self.create_group(project1, create_open_period=False)
        group1_2 = self.create_group(project1, create_open_period=False)
        project2 = self.create_project()
        group2_1 = self.create_group(project2, create_open_period=False)
        group2_2 = self.create_group(project2, create_open_period=False)
        BulkDeleteQuery(model=Group, project_id=project1.id).execute()
        assert Project.objects.filter(id=project1.id).exists()
        assert Project.objects.filter(id=project2.id).exists()
        assert Group.objects.filter(id=group2_1.id).exists()
        assert Group.objects.filter(id=group2_2.id).exists()
        assert not Group.objects.filter(id=group1_1.id).exists()
        assert not Group.objects.filter(id=group1_2.id).exists()

    def test_datetime_restriction(self) -> None:
        now = timezone.now()
        project1 = self.create_project()
        group1_1 = self.create_group(
            project1, create_open_period=False, last_seen=now - timedelta(days=1)
        )
        group1_2 = self.create_group(
            project1, create_open_period=False, last_seen=now - timedelta(days=1)
        )
        group1_3 = self.create_group(project1, create_open_period=False, last_seen=now)
        BulkDeleteQuery(model=Group, dtfield="last_seen", days=1).execute()
        assert not Group.objects.filter(id=group1_1.id).exists()
        assert not Group.objects.filter(id=group1_2.id).exists()
        assert Group.objects.filter(id=group1_3.id).exists()

    def test_partition_restriction(self) -> None:
        project = self.create_project()
        groups = [self.create_group(project, create_open_period=False) for _ in range(8)]

        # Delete only groups where id % 2 == 0
        BulkDeleteQuery(model=Group, project_id=project.id, partition=(0, 2, "id")).execute()

        remaining = Group.objects.filter(project_id=project.id)
        remaining_ids = set(remaining.values_list("id", flat=True))

        # All remaining groups should have id % 2 == 1
        for gid in remaining_ids:
            assert gid % 2 == 1

        # All deleted groups should have had id % 2 == 0
        deleted_ids = {g.id for g in groups} - remaining_ids
        for gid in deleted_ids:
            assert gid % 2 == 0

        assert len(deleted_ids) > 0
        assert len(remaining_ids) > 0

    def test_partition_with_datetime_restriction(self) -> None:
        now = timezone.now()
        project = self.create_project()

        old_groups = [
            self.create_group(project, create_open_period=False, last_seen=now - timedelta(days=2))
            for _ in range(8)
        ]
        recent_groups = [
            self.create_group(project, create_open_period=False, last_seen=now) for _ in range(4)
        ]

        # Delete old groups in partition bucket 0 only
        BulkDeleteQuery(
            model=Group,
            project_id=project.id,
            dtfield="last_seen",
            days=1,
            partition=(0, 2, "id"),
        ).execute()

        remaining_ids = set(
            Group.objects.filter(project_id=project.id).values_list("id", flat=True)
        )

        # All recent groups should still exist
        for g in recent_groups:
            assert g.id in remaining_ids

        # Old groups in bucket 0 (id % 2 == 0) should be deleted
        for g in old_groups:
            if g.id % 2 == 0:
                assert g.id not in remaining_ids
            else:
                assert g.id in remaining_ids

    def test_partition_all_buckets_cover_all_rows(self) -> None:
        project = self.create_project()
        groups = [self.create_group(project, create_open_period=False) for _ in range(8)]
        all_ids = {g.id for g in groups}

        # Delete bucket 0
        BulkDeleteQuery(model=Group, project_id=project.id, partition=(0, 2, "id")).execute()

        # Delete bucket 1
        BulkDeleteQuery(model=Group, project_id=project.id, partition=(1, 2, "id")).execute()

        # All groups should now be deleted
        remaining = Group.objects.filter(id__in=all_ids)
        assert remaining.count() == 0


class BulkDeleteQueryIteratorTestCase(TestCase):
    def test_iteration(self) -> None:
        target_project = self.project
        expected_group_ids = {self.create_group().id for i in range(2)}

        other_project = self.create_project()
        self.create_group(other_project)
        self.create_group(other_project)

        iterator = BulkDeleteQuery(
            model=Group,
            project_id=target_project.id,
            dtfield="last_seen",
            order_by="last_seen",
            days=0,
        ).iterator(1)

        results: set[int] = set()
        for chunk in iterator:
            results.update(chunk)

        assert results == expected_group_ids

    def test_iteration_descending(self) -> None:
        target_project = self.project
        expected_group_ids = {self.create_group().id for i in range(2)}

        other_project = self.create_project()
        self.create_group(other_project)
        self.create_group(other_project)

        iterator = BulkDeleteQuery(
            model=Group,
            project_id=target_project.id,
            dtfield="last_seen",
            order_by="-last_seen",
            days=0,
        ).iterator(chunk_size=1)

        results: set[int] = set()
        for chunk in iterator:
            results.update(chunk)

        assert results == expected_group_ids

    def test_iteration_with_duplicate_timestamps(self) -> None:
        """Test that groups with identical last_seen timestamps are all returned."""
        target_project = self.project
        same_timestamp = timezone.now() - timedelta(days=1)

        # Create multiple groups with the exact same last_seen timestamp
        group1 = self.create_group(project=target_project, last_seen=same_timestamp)
        group2 = self.create_group(project=target_project, last_seen=same_timestamp)
        group3 = self.create_group(project=target_project, last_seen=same_timestamp)
        expected_group_ids = {group1.id, group2.id, group3.id}

        iterator = BulkDeleteQuery(
            model=Group,
            project_id=target_project.id,
            dtfield="last_seen",
            order_by="last_seen",
            days=0,
        ).iterator(chunk_size=1)

        results: set[int] = set()
        for chunk in iterator:
            results.update(chunk)

        # All groups should be returned, even with identical timestamps
        assert results == expected_group_ids

    def test_iteration_with_partition(self) -> None:
        target_project = self.project
        groups = [self.create_group() for _ in range(8)]

        iterator = BulkDeleteQuery(
            model=Group,
            project_id=target_project.id,
            dtfield="last_seen",
            order_by="last_seen",
            days=0,
            partition=(0, 2, "id"),
        ).iterator(chunk_size=100)

        results: set[int] = set()
        for chunk in iterator:
            results.update(chunk)

        # Only IDs where id % 2 == 0 should be returned
        for gid in results:
            assert gid % 2 == 0

        # Verify we got some results (not empty)
        assert len(results) > 0

        # Verify IDs with id % 2 == 1 are NOT in results
        all_ids = {g.id for g in groups}
        for gid in all_ids - results:
            assert gid % 2 == 1
