from __future__ import annotations

from unittest.mock import patch

from sentry.constants import ObjectStatus
from sentry.models.group import Group
from sentry.runner.commands.cleanup import (
    prepare_deletes_by_project,
    run_bulk_deletes_by_project,
    task_execution,
)
from sentry.silo.base import SiloMode
from sentry.testutils.cases import TestCase
from sentry.testutils.helpers.datetime import before_now
from sentry.testutils.silo import assume_test_silo_mode


class SynchronousTaskQueue:
    """Mock task queue that partially implements the _WorkQueue protocol but executes tasks synchronously."""

    def __init__(self) -> None:
        # You can use this to inspect the calls to the queue.
        self.put_calls: list[tuple[str, tuple[int, ...], int | None]] = []

    def put(self, item: tuple[str, tuple[int, ...], int | None]) -> None:
        self.put_calls.append(item)
        task_execution(item[0], item[1], item[2])

    def join(self) -> None:
        pass


class PrepareDeletesByProjectTest(TestCase):
    def test_no_filters(self) -> None:
        """Test that without filters, all active projects are included."""
        project1 = self.create_project()
        project2 = self.create_project()
        project3 = self.create_project()

        query, _ = prepare_deletes_by_project(is_filtered=lambda model: False)

        assert query is not None
        project_ids = list(query.values_list("id", flat=True))
        # We sort the project IDs since the query set is unordered.
        # Adding an order would be useless since the query from prepare_deletes_by_project is used
        # by RangeQuerySetWrapper, which ignores order_by.
        assert sorted(project_ids) == [project1.id, project2.id, project3.id]

    def test_with_specific_project(self) -> None:
        """Test that when a specific project is provided, only that project is included."""
        project1 = self.create_project()
        self.create_project()

        query, _ = prepare_deletes_by_project(
            project_id=project1.id, is_filtered=lambda model: False
        )

        assert query is not None
        project_ids = list(query.values_list("id", flat=True))
        assert sorted(project_ids) == [project1.id]

    def test_with_start_from_id(self) -> None:
        """Test that when start_from_project_id is provided, projects >= that ID are included."""
        # Create projects in specific order
        self.create_project()
        project2 = self.create_project()
        project3 = self.create_project()

        query, _ = prepare_deletes_by_project(
            start_from_project_id=project2.id,
            is_filtered=lambda model: False,
        )

        assert query is not None
        project_ids = list(query.values_list("id", flat=True))
        assert sorted(project_ids) == [project2.id, project3.id]

    def test_specific_project_overrides_start_from(self) -> None:
        """Test that specific project_id takes precedence over start_from_project_id."""
        project1 = self.create_project()
        project2 = self.create_project()

        query, _ = prepare_deletes_by_project(
            project_id=project1.id,
            start_from_project_id=project2.id,  # This should be ignored
            is_filtered=lambda model: False,
        )

        assert query is not None
        project_ids = list(query.values_list("id", flat=True))
        # Only project1 should be included, start_from_project_id is ignored
        assert sorted(project_ids) == [project1.id]

    def test_only_active_projects(self) -> None:
        """Test that only active projects are included."""
        active_project = self.create_project()
        deleted_project = self.create_project()
        # Mark one project as deleted
        deleted_project.update(status=ObjectStatus.PENDING_DELETION)

        query, _ = prepare_deletes_by_project(is_filtered=lambda model: False)

        assert query is not None
        project_ids = list(query.values_list("id", flat=True))
        assert sorted(project_ids) == [active_project.id]

    def test_control_silo_mode_returns_none(self) -> None:
        """Test that in CONTROL silo mode, the function returns None for query and empty list."""
        self.create_project()

        with assume_test_silo_mode(SiloMode.CONTROL):
            query, to_delete = prepare_deletes_by_project(is_filtered=lambda model: False)

        assert query is None
        assert to_delete == []

    def test_region_silo_mode_returns_projects(self) -> None:
        """Test that in REGION silo mode, the function returns projects as expected."""
        project1 = self.create_project()
        project2 = self.create_project()

        with assume_test_silo_mode(SiloMode.REGION):
            query, to_delete = prepare_deletes_by_project(is_filtered=lambda model: False)

        assert query is not None
        project_ids = list(query.values_list("id", flat=True))
        assert sorted(project_ids) == [project1.id, project2.id]
        # Should have model tuples to delete
        assert len(to_delete) > 0


class RunBulkQueryDeletesByProjectTest(TestCase):
    def test_run_bulk_query_deletes_by_project(self) -> None:
        """Test that the function runs bulk query deletes by project as expected."""
        days = 30
        project = self.project  # Get the default project for verification
        # Creating the groups in out of order to test that the chunks are created in the correct order.
        self.create_group(last_seen=before_now(days=days + 4))
        self.create_group()
        self.create_group(last_seen=before_now(days=days + 2))
        self.create_group(last_seen=before_now(days=days + 3))

        assert Group.objects.count() == 4
        assert Group.objects.filter(last_seen__lt=before_now(days=days)).count() == 3
        ids = list(
            Group.objects.filter(last_seen__lt=before_now(days=days)).values_list("id", flat=True)
        )

        with (
            assume_test_silo_mode(SiloMode.REGION),
            patch("sentry.runner.commands.cleanup.DELETES_BY_PROJECT_CHUNK_SIZE", 2),
        ):
            task_queue = SynchronousTaskQueue()

            models_attempted: set[str] = set()
            run_bulk_deletes_by_project(
                task_queue=task_queue,  # type: ignore[arg-type]  # It partially implements the queue protocol
                project_id=None,
                start_from_project_id=None,
                is_filtered=lambda model: False,
                days=days,
                models_attempted=models_attempted,
            )
            assert models_attempted == {"group", "projectdebugfile"}

        assert len(task_queue.put_calls) == 2
        # Verify we deleted all expected groups (order may vary due to non-unique last_seen)
        all_deleted_ids: set[int] = set()
        for call in task_queue.put_calls:
            model_name, chunk_ids, call_project_id = call
            assert model_name == "sentry.models.group.Group"
            assert call_project_id == project.id
            all_deleted_ids.update(chunk_ids)
        assert all_deleted_ids == set(ids)

        assert Group.objects.all().count() == 1

    def test_project_id_passed_to_task_queue(self) -> None:
        """Test that the correct project_id is passed for each chunk."""
        days = 30
        # Create two projects with groups
        project1 = self.create_project()
        project2 = self.create_project()

        # Create groups for project1 (old enough to delete)
        self.create_group(project=project1, last_seen=before_now(days=days + 1))
        self.create_group(project=project1, last_seen=before_now(days=days + 2))

        # Create groups for project2 (old enough to delete)
        self.create_group(project=project2, last_seen=before_now(days=days + 1))

        # Create a group that should NOT be deleted (too recent)
        self.create_group(project=project1)

        with (
            assume_test_silo_mode(SiloMode.REGION),
            patch("sentry.runner.commands.cleanup.DELETES_BY_PROJECT_CHUNK_SIZE", 10),
        ):
            task_queue = SynchronousTaskQueue()

            models_attempted: set[str] = set()
            run_bulk_deletes_by_project(
                task_queue=task_queue,  # type: ignore[arg-type]
                project_id=None,
                start_from_project_id=None,
                is_filtered=lambda model: False,
                days=days,
                models_attempted=models_attempted,
            )

        # Collect project_ids from task queue calls for Group model
        group_calls = [call for call in task_queue.put_calls if "Group" in call[0]]

        # Verify each call has the correct project_id
        project_ids_seen: set[int] = set()
        for call in group_calls:
            model_name, chunk_ids, call_project_id = call
            assert call_project_id is not None
            project_ids_seen.add(call_project_id)

        # Should have seen both projects
        assert project1.id in project_ids_seen
        assert project2.id in project_ids_seen
