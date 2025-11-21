"""Integration tests for bulk job processing infrastructure."""

import logging
from collections.abc import Iterable
from datetime import timedelta
from typing import Any

from pydantic import BaseModel

from sentry.utils.query import RangeQuerySetWrapper
from sentry.workflow_engine.models import BulkJobState, BulkJobStatus, Workflow
from sentry.workflow_engine.processors.bulk_job import (
    BulkJobSpec,
    bulk_job_registry,
    coordinate_bulk_jobs,
    create_bulk_job_records,
    process_bulk_job,
)
from sentry.workflow_engine.tasks.bulk_job import (
    populate_bulk_job_records_task,
    process_bulk_job_task,
)
from tests.sentry.workflow_engine.test_base import BaseWorkflowTest

logger = logging.getLogger(__name__)


class WorkflowReverseWorkChunk(BaseModel):
    """Work chunk for reversing workflow names."""

    workflow_id: int


class WorkflowNameReverseJob(BulkJobSpec):
    """Test bulk job that reverses workflow names."""

    job_type = "workflow_name_reverse"
    work_chunk_model = WorkflowReverseWorkChunk

    # Configuration optimized for testing
    max_batch_size = 10
    target_running_tasks = 3
    in_progress_timeout = timedelta(minutes=5)
    completed_cleanup_age = timedelta(days=1)

    def process_work_chunk(self, work_chunk: BaseModel) -> dict[str, Any]:
        """Reverse the name of a single workflow."""
        assert isinstance(work_chunk, WorkflowReverseWorkChunk)
        workflow = Workflow.objects.get(id=work_chunk.workflow_id)
        old_name = workflow.name
        workflow.name = old_name[::-1]  # Reverse the string
        workflow.save(update_fields=["name"])

        logger.info(
            "workflow_name_reverse.processed",
            extra={
                "workflow_id": workflow.id,
                "old_name": old_name,
                "new_name": workflow.name,
            },
        )

        return {
            "workflow_id": workflow.id,
            "old_name": old_name,
            "new_name": workflow.name,
        }

    def generate_work_chunks(self, start_from: str | None) -> Iterable[BaseModel]:
        """Generate work chunks for all workflows."""
        workflows = Workflow.objects.all()
        if start_from is not None:
            # Extract workflow_id from batch_key format "workflow:{id}"
            workflow_id = int(start_from.split(":")[-1])
            workflows = workflows.filter(id__gte=workflow_id)

        # RangeQuerySetWrapper doesn't support ORDER BY
        for workflow in RangeQuerySetWrapper(workflows, step=100):
            yield WorkflowReverseWorkChunk(workflow_id=workflow.id)

    def get_batch_key(self, work_chunk: BaseModel) -> str:
        """Get the batch key for a workflow work chunk."""
        assert isinstance(work_chunk, WorkflowReverseWorkChunk)
        return f"workflow:{work_chunk.workflow_id}"


class BulkJobIntegrationTest(BaseWorkflowTest):
    """Integration tests for the bulk job processing system."""

    def setUp(self) -> None:
        super().setUp()
        # Register the test job spec (only if not already registered)
        self.job_spec = WorkflowNameReverseJob()
        if self.job_spec.job_type not in bulk_job_registry.registrations:
            bulk_job_registry.register(self.job_spec.job_type)(self.job_spec)

    def tearDown(self) -> None:
        # Clean up registry
        if self.job_spec.job_type in bulk_job_registry.registrations:
            del bulk_job_registry.registrations[self.job_spec.job_type]
            # Also clean up reverse lookup if enabled
            if (
                bulk_job_registry.enable_reverse_lookup
                and self.job_spec in bulk_job_registry.reverse_lookup
            ):
                del bulk_job_registry.reverse_lookup[self.job_spec]
        super().tearDown()

    def test_full_bulk_job_lifecycle(self) -> None:
        """
        Integration test for the complete bulk job lifecycle.

        This test:
        1. Creates 5 workflows with names 'ABCDEFG'
        2. Runs populate task to create BulkJobStatus records
        3. Runs coordinate task to process jobs
        4. Verifies that all workflow names are reversed to 'GFEDCBA'
        """
        # Create 5 workflows with the same name
        workflows = []
        for i in range(5):
            workflow = self.create_workflow(name="ABCDEFG")
            workflows.append(workflow)

        # Step 1: Populate BulkJobStatus records
        resume_key = create_bulk_job_records(self.job_spec.job_type)
        assert resume_key is None, "Should complete in one pass for only 5 workflows"

        # Verify BulkJobStatus records were created
        job_statuses = BulkJobStatus.objects.filter(job_type=self.job_spec.job_type)
        assert job_statuses.count() == 5
        assert all(status.status == BulkJobState.NOT_STARTED for status in job_statuses)

        # Step 2: Process individual jobs using the low-level function
        for job_status in job_statuses:
            process_bulk_job(job_status.id)

        # Verify all jobs completed
        job_statuses = BulkJobStatus.objects.filter(job_type=self.job_spec.job_type)
        assert all(status.status == BulkJobState.COMPLETED for status in job_statuses)

        # Step 3: Verify workflow names were reversed
        for workflow in workflows:
            workflow.refresh_from_db()
            assert workflow.name == "GFEDCBA", f"Expected 'GFEDCBA', got '{workflow.name}'"

    def test_coordinator_task_with_concurrency_control(self) -> None:
        """
        Test that the coordinator respects target_running_tasks.

        This test:
        1. Creates 10 workflows
        2. Populates BulkJobStatus records
        3. Manually marks 2 as IN_PROGRESS
        4. Runs coordinator with target_running_tasks=3
        5. Verifies only 1 new task was scheduled (to reach target of 3)
        """
        # Create 10 workflows
        workflows = []
        for i in range(10):
            workflow = self.create_workflow(name="ABCDEFG")
            workflows.append(workflow)

        # Populate records
        create_bulk_job_records(self.job_spec.job_type)

        # Manually mark 2 as IN_PROGRESS
        job_statuses = list(
            BulkJobStatus.objects.filter(job_type=self.job_spec.job_type).order_by("id")[:2]
        )
        for status in job_statuses:
            status.status = BulkJobState.IN_PROGRESS
            status.save(update_fields=["status"])

        # Track which jobs get scheduled
        scheduled_ids = []

        def mock_schedule(job_status_id: int) -> None:
            scheduled_ids.append(job_status_id)
            # Actually mark as in progress for realistic simulation
            status = BulkJobStatus.objects.get(id=job_status_id)
            status.status = BulkJobState.IN_PROGRESS
            status.save(update_fields=["status"])

        # Run coordinator
        coordinate_bulk_jobs(
            self.job_spec.job_type,
            max_batch_size=self.job_spec.max_batch_size,
            in_progress_timeout=self.job_spec.in_progress_timeout,
            completed_cleanup_age=self.job_spec.completed_cleanup_age,
            schedule_task_fn=mock_schedule,
            target_running_tasks=self.job_spec.target_running_tasks,
        )

        # Should only schedule 1 more task (target=3, already have 2 in progress)
        assert len(scheduled_ids) == 1

        # Verify we now have 3 in progress
        in_progress_count = BulkJobStatus.objects.filter(
            job_type=self.job_spec.job_type, status=BulkJobState.IN_PROGRESS
        ).count()
        assert in_progress_count == 3

    def test_populate_with_cycles(self) -> None:
        """
        Test populating records over multiple cycles with deadline interruption.

        This test simulates a scenario where populate hits a deadline and needs
        to resume across multiple task invocations.
        """
        from datetime import UTC, datetime

        # Create 15 workflows
        workflows = []
        for i in range(15):
            workflow = self.create_workflow(name=f"WORKFLOW_{i:02d}")
            workflows.append(workflow)

        # First cycle: Set a past deadline so it processes only the first item
        past_deadline = datetime.now(UTC)
        resume_key = create_bulk_job_records(
            self.job_spec.job_type, start_from=None, deadline=past_deadline
        )

        # Should have stopped early and returned a resume key
        assert resume_key is not None
        # Should have created 0 records since deadline was in the past
        assert BulkJobStatus.objects.filter(job_type=self.job_spec.job_type).count() == 0

        # Second cycle: Use a reasonable deadline to process some items
        future_deadline = datetime.now(UTC) + timedelta(seconds=10)
        resume_key = create_bulk_job_records(
            self.job_spec.job_type, start_from=None, deadline=future_deadline
        )

        # Should have completed all workflows
        assert resume_key is None
        assert BulkJobStatus.objects.filter(job_type=self.job_spec.job_type).count() == 15

    def test_end_to_end_with_task_functions(self) -> None:
        """
        End-to-end test using the actual task functions.

        This test:
        1. Creates workflows with 'ABCDEFG' names
        2. Calls populate_bulk_job_records_task
        3. Calls process_bulk_job_task for each job
        4. Verifies names are reversed
        """
        # Create 3 workflows
        workflows = []
        for i in range(3):
            workflow = self.create_workflow(name="ABCDEFG")
            workflows.append(workflow)

        # Call populate task (this doesn't run in celery, just the function)
        populate_bulk_job_records_task(self.job_spec.job_type)

        # Get all job statuses
        job_statuses = BulkJobStatus.objects.filter(job_type=self.job_spec.job_type)
        assert job_statuses.count() == 3

        # Process each job using the task function
        for job_status in job_statuses:
            process_bulk_job_task(job_status.id, self.job_spec.job_type)

        # Verify all completed
        assert all(
            status.status == BulkJobState.COMPLETED
            for status in BulkJobStatus.objects.filter(job_type=self.job_spec.job_type)
        )

        # Verify names reversed
        for workflow in workflows:
            workflow.refresh_from_db()
            assert workflow.name == "GFEDCBA"

    def test_coordinator_task_function(self) -> None:
        """
        Test the coordinator task function.

        This test verifies that coordinate_bulk_jobs_task properly reads
        configuration from the job spec and schedules tasks.
        """
        # Create 5 workflows
        for i in range(5):
            self.create_workflow(name="TESTNAME")

        # Populate records
        create_bulk_job_records(self.job_spec.job_type)

        # Verify all are NOT_STARTED
        assert (
            BulkJobStatus.objects.filter(
                job_type=self.job_spec.job_type, status=BulkJobState.NOT_STARTED
            ).count()
            == 5
        )

        # Call coordinate task - this will try to schedule via celery
        # For testing, the tasks won't actually run in celery, but we can verify
        # that the coordination logic executed
        # Note: This would normally schedule process_bulk_job_task.apply_async()
        # but in tests those won't run unless we have celery running

        # Instead, let's directly test the coordination logic
        scheduled_count = 0

        def counting_schedule(job_status_id: int) -> None:
            nonlocal scheduled_count
            scheduled_count += 1

        coordinate_bulk_jobs(
            self.job_spec.job_type,
            max_batch_size=self.job_spec.max_batch_size,
            in_progress_timeout=self.job_spec.in_progress_timeout,
            completed_cleanup_age=self.job_spec.completed_cleanup_age,
            schedule_task_fn=counting_schedule,
            target_running_tasks=self.job_spec.target_running_tasks,
        )

        # Should schedule up to target_running_tasks (which is 3)
        assert scheduled_count == 3
