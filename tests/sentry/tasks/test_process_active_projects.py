from __future__ import annotations

from unittest.mock import patch

from sentry.constants import ObjectStatus
from sentry.models.project import Project
from sentry.tasks.process_active_projects import (
    ISSUE_ACTION_LOG_WRITE_TO_DB,
    process_active_projects,
    process_active_projects_batch,
)
from sentry.testutils.cases import TestCase
from sentry.testutils.helpers.features import with_feature


class ProcessActiveProjectsBatchTest(TestCase):
    def test_counts_enabled_feature(self) -> None:
        enabled = self.create_project()
        disabled = self.create_project()
        inactive = self.create_project(status=ObjectStatus.DISABLED)

        def feature_has(name: str, project: Project, *args: object, **kwargs: object) -> bool:
            return name == ISSUE_ACTION_LOG_WRITE_TO_DB and project.id == enabled.id

        with (
            patch(
                "sentry.tasks.process_active_projects.features.has",
                side_effect=feature_has,
            ),
            patch("sentry.tasks.process_active_projects.metrics.incr") as mock_incr,
        ):
            process_active_projects_batch(
                first_id=min(enabled.id, disabled.id, inactive.id),
                last_id=max(enabled.id, disabled.id, inactive.id),
            )

        mock_incr.assert_called_once_with(
            "process_active_projects.action_log_write_to_db_enabled",
            amount=1,
            sample_rate=1.0,
        )

    def test_no_metric_when_none_enabled(self) -> None:
        project = self.create_project()
        with patch("sentry.tasks.process_active_projects.metrics.incr") as mock_incr:
            process_active_projects_batch(first_id=project.id, last_id=project.id)
        mock_incr.assert_not_called()

    @with_feature(ISSUE_ACTION_LOG_WRITE_TO_DB)
    def test_skips_projects_outside_range(self) -> None:
        inside = self.create_project()
        outside = self.create_project()
        assert outside.id > inside.id

        with patch("sentry.tasks.process_active_projects.metrics.incr") as mock_incr:
            process_active_projects_batch(first_id=inside.id, last_id=inside.id)

        mock_incr.assert_called_once_with(
            "process_active_projects.action_log_write_to_db_enabled",
            amount=1,
            sample_rate=1.0,
        )


class ProcessActiveProjectsTest(TestCase):
    def _max_project_id(self) -> int:
        return Project.objects.order_by("-id").values_list("id", flat=True).first() or 0

    def test_empty(self) -> None:
        start_id = self._max_project_id()
        with (
            patch.object(process_active_projects_batch, "delay") as mock_batch,
            patch.object(process_active_projects, "delay") as mock_self,
        ):
            process_active_projects(start_id=start_id)
        mock_batch.assert_not_called()
        mock_self.assert_not_called()

    def test_dispatches_batches_for_ranges(self) -> None:
        start_id = self._max_project_id()
        projects = [self.create_project() for _ in range(5)]
        ids = sorted(p.id for p in projects)

        with (
            patch.object(process_active_projects_batch, "delay") as mock_batch,
            patch.object(process_active_projects, "delay") as mock_self,
            patch("sentry.tasks.process_active_projects.PROJECTS_PER_RANGE", 2),
            patch("sentry.tasks.process_active_projects.MAX_RANGES_PER_COORDINATOR", 10),
        ):
            process_active_projects(start_id=start_id)

        assert mock_batch.call_count == 3
        mock_batch.assert_any_call(first_id=ids[0], last_id=ids[1])
        mock_batch.assert_any_call(first_id=ids[2], last_id=ids[3])
        mock_batch.assert_any_call(first_id=ids[4], last_id=ids[4])
        mock_self.assert_not_called()

    def test_reschedules_when_max_ranges_reached(self) -> None:
        start_id = self._max_project_id()
        projects = [self.create_project() for _ in range(6)]
        ids = sorted(p.id for p in projects)

        with (
            patch.object(process_active_projects_batch, "delay") as mock_batch,
            patch.object(process_active_projects, "delay") as mock_self,
            patch("sentry.tasks.process_active_projects.PROJECTS_PER_RANGE", 2),
            patch("sentry.tasks.process_active_projects.MAX_RANGES_PER_COORDINATOR", 2),
        ):
            process_active_projects(start_id=start_id)

        assert mock_batch.call_count == 2
        mock_batch.assert_any_call(first_id=ids[0], last_id=ids[1])
        mock_batch.assert_any_call(first_id=ids[2], last_id=ids[3])
        mock_self.assert_called_once_with(start_id=ids[3])

        with (
            patch.object(process_active_projects_batch, "delay") as mock_batch,
            patch.object(process_active_projects, "delay") as mock_self,
            patch("sentry.tasks.process_active_projects.PROJECTS_PER_RANGE", 2),
            patch("sentry.tasks.process_active_projects.MAX_RANGES_PER_COORDINATOR", 2),
        ):
            process_active_projects(start_id=ids[3])

        assert mock_batch.call_count == 1
        mock_batch.assert_called_once_with(first_id=ids[4], last_id=ids[5])
        mock_self.assert_not_called()

    def test_skips_inactive_projects(self) -> None:
        start_id = self._max_project_id()
        active = self.create_project()
        self.create_project(status=ObjectStatus.DISABLED)

        with (
            patch.object(process_active_projects_batch, "delay") as mock_batch,
            patch.object(process_active_projects, "delay"),
            patch("sentry.tasks.process_active_projects.PROJECTS_PER_RANGE", 10),
        ):
            process_active_projects(start_id=start_id)

        mock_batch.assert_called_once_with(first_id=active.id, last_id=active.id)
