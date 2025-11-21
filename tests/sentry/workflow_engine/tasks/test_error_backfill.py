"""Tests for task definitions - these primarily verify task names are stable."""

from sentry.workflow_engine.tasks.bulk_job import (
    coordinate_error_backfill,
    populate_error_backfill_status,
    process_error_backfill,
)
from tests.sentry.workflow_engine.test_base import BaseWorkflowTest


class TaskDefinitionTest(BaseWorkflowTest):
    def test_process_error_backfill_name(self) -> None:
        """Test that process_error_backfill has a stable name"""
        assert (
            process_error_backfill.name
            == "sentry.workflow_engine.tasks.error_backfill.process_error_backfill"
        )

    def test_coordinate_error_backfill_name(self) -> None:
        """Test that coordinate_error_backfill has a stable name"""
        assert (
            coordinate_error_backfill.name
            == "sentry.workflow_engine.tasks.error_backfill.coordinate_error_backfill"
        )

    def test_populate_error_backfill_status_name(self) -> None:
        """Test that populate_error_backfill_status has a stable name"""
        assert (
            populate_error_backfill_status.name
            == "sentry.workflow_engine.tasks.error_backfill.populate_error_backfill_status"
        )
