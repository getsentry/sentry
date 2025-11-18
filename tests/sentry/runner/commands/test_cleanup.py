from __future__ import annotations

from sentry.constants import ObjectStatus
from sentry.runner.commands.cleanup import prepare_deletes_by_project
from sentry.silo.base import SiloMode
from sentry.testutils.cases import TestCase
from sentry.testutils.silo import assume_test_silo_mode


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
