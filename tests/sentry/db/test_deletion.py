from __future__ import annotations

from datetime import timedelta

from django.utils import timezone

from sentry.db.deletion import BulkDeleteQuery
from sentry.models.group import Group
from sentry.models.project import Project
from sentry.testutils.cases import TestCase, TransactionTestCase


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


class BulkDeleteQueryIteratorTestCase(TransactionTestCase):
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

    def test_iteration_with_multiple_batches_datetime_field(self) -> None:
        """Test that datetime field ordering works correctly across multiple batches.

        This test specifically validates the fix for the issue where datetime values
        from values_list() were being passed to filter() causing TypeError.
        """
        now = timezone.now()
        target_project = self.project

        # Create multiple groups with different last_seen times to ensure
        # multiple batches with datetime-based pagination
        expected_group_ids = set()
        for i in range(5):
            group = self.create_group(target_project, last_seen=now - timedelta(hours=i))
            expected_group_ids.add(group.id)

        other_project = self.create_project()
        self.create_group(other_project, last_seen=now)

        # Use a small batch_size and chunk_size to force multiple iterations
        # This ensures the RangeQuerySetWrapper filters with datetime values
        iterator = BulkDeleteQuery(
            model=Group,
            project_id=target_project.id,
            dtfield="last_seen",
            order_by="last_seen",
            days=0,
        ).iterator(chunk_size=2, batch_size=2)

        results: set[int] = set()
        for chunk in iterator:
            results.update(chunk)

        assert results == expected_group_ids

    def test_datetime_field_pagination_bug_reproduction(self) -> None:
        """Reproduces the exact bug: TypeError when filtering datetime values.

        This test reproduces the exact scenario from the bug report where
        RangeQuerySetWrapper would fail with:
        TypeError: fromisoformat: argument must be str

        The bug occurred when:
        1. BulkDeleteQuery.iterator() used values_list("id", datetime_field)
        2. RangeQuerySetWrapper extracted datetime objects as cur_value
        3. Filtering with datetime objects (not strings) caused Django to fail

        With the fix, we use regular queryset (not values_list) so datetime
        objects are properly handled during filtering.
        """
        now = timezone.now()
        target_project = self.project

        # Create groups with staggered datetime values
        # This ensures the RangeQuerySetWrapper must paginate through multiple batches
        groups = []
        for i in range(10):
            group = self.create_group(target_project, last_seen=now - timedelta(minutes=i * 10))
            groups.append(group)

        # Small batch_size forces multiple RangeQuerySetWrapper iterations
        # Each iteration after the first will call filter() with a datetime value
        # which would have triggered: TypeError: fromisoformat: argument must be str
        iterator = BulkDeleteQuery(
            model=Group,
            project_id=target_project.id,
            dtfield="last_seen",
            order_by="last_seen",
            days=0,
        ).iterator(chunk_size=3, batch_size=3)

        # If the bug exists, this will raise TypeError on the second iteration
        # when RangeQuerySetWrapper tries to filter with a datetime object
        collected_ids: list[int] = []
        iteration_count = 0
        for chunk in iterator:
            iteration_count += 1
            collected_ids.extend(chunk)

        # Verify we actually did multiple iterations (proving we tested pagination)
        assert iteration_count > 1, "Test must iterate multiple times to prove the fix"

        # Verify all groups were collected
        assert len(collected_ids) == len(groups)
        assert set(collected_ids) == {g.id for g in groups}
