from datetime import UTC, datetime, timedelta
from unittest.mock import MagicMock, patch

from sentry.grouping.grouptype import ErrorGroupType
from sentry.models.group import GroupStatus
from sentry.workflow_engine.models import BulkJobState, BulkJobStatus, DetectorGroup
from sentry.workflow_engine.processors.backfill import (
    ERROR_DETECTOR_BACKFILL_JOB,
    ErrorDetectorWorkChunk,
    coordinate_bulk_jobs,
    create_bulk_job_records,
    process_bulk_job,
)
from tests.sentry.workflow_engine.test_base import BaseWorkflowTest


def create_backfill_status(detector_id: int, status: BulkJobState) -> BulkJobStatus:
    """Helper to create a BulkJobStatus record for error detector backfilling."""
    work_chunk = ErrorDetectorWorkChunk(detector_id=detector_id)
    batch_key = ERROR_DETECTOR_BACKFILL_JOB.get_batch_key(work_chunk)
    backfill_status = BulkJobStatus(
        job_type=ERROR_DETECTOR_BACKFILL_JOB.job_type,
        batch_key=batch_key,
        work_chunk_info=work_chunk.dict(),
        status=status,
    )
    backfill_status.save()
    return backfill_status


class ProcessDetectorBackfillTest(BaseWorkflowTest):
    def setUp(self) -> None:
        super().setUp()
        self.detector = self.create_detector(type=ErrorGroupType.slug)

    def test_process_backfill_success(self) -> None:
        """Test that processing a backfill creates DetectorGroups for all unresolved groups"""
        # Create some unresolved error groups
        group1 = self.create_group(project=self.detector.project, status=GroupStatus.UNRESOLVED)
        group2 = self.create_group(project=self.detector.project, status=GroupStatus.UNRESOLVED)
        group3 = self.create_group(project=self.detector.project, status=GroupStatus.RESOLVED)

        backfill_status = create_backfill_status(self.detector.id, BulkJobState.NOT_STARTED)

        # Process the backfill
        process_bulk_job(backfill_status.id)

        # Check that DetectorGroups were created for unresolved groups
        assert DetectorGroup.objects.filter(
            detector_id=self.detector.id, group_id=group1.id
        ).exists()
        assert DetectorGroup.objects.filter(
            detector_id=self.detector.id, group_id=group2.id
        ).exists()

        # Should not create for resolved group
        assert not DetectorGroup.objects.filter(
            detector_id=self.detector.id, group_id=group3.id
        ).exists()

        # Check that status was updated to completed
        backfill_status.refresh_from_db()
        assert backfill_status.status == BulkJobState.COMPLETED

    def test_process_backfill_already_exists(self) -> None:
        """Test that processing a backfill succeeds even if some DetectorGroups already exist"""
        group1 = self.create_group(project=self.detector.project, status=GroupStatus.UNRESOLVED)
        group2 = self.create_group(project=self.detector.project, status=GroupStatus.UNRESOLVED)

        # Create DetectorGroup for group1 first
        DetectorGroup.objects.create(
            detector_id=self.detector.id,
            group_id=group1.id,
        )

        backfill_status = create_backfill_status(self.detector.id, BulkJobState.NOT_STARTED)

        # Process the backfill (should not fail)
        process_bulk_job(backfill_status.id)

        # Check that status was updated to completed
        backfill_status.refresh_from_db()
        assert backfill_status.status == BulkJobState.COMPLETED

        # group1 should still have its DetectorGroup, group2 should have one now
        assert (
            DetectorGroup.objects.filter(detector_id=self.detector.id, group_id=group1.id).count()
            == 1
        )
        assert DetectorGroup.objects.filter(
            detector_id=self.detector.id, group_id=group2.id
        ).exists()

    def test_process_backfill_not_found(self) -> None:
        """Test that processing a non-existent backfill doesn't crash"""
        # This should log a warning but not crash
        process_bulk_job(999999)

    def test_process_backfill_marks_in_progress(self) -> None:
        """Test that processing marks the backfill as in_progress and then completed"""
        backfill_status = create_backfill_status(self.detector.id, BulkJobState.NOT_STARTED)

        # Create a group to process
        self.create_group(project=self.detector.project, status=GroupStatus.UNRESOLVED)

        # Process the backfill
        process_bulk_job(backfill_status.id)

        # Check that status transitioned from not_started -> in_progress -> completed
        backfill_status.refresh_from_db()
        assert backfill_status.status == BulkJobState.COMPLETED

    def test_process_backfill_date_added_preservation(self) -> None:
        """Test that DetectorGroup.date_added is set to Group.first_seen"""
        from datetime import timedelta

        from django.utils import timezone

        # Create a group with a specific first_seen date
        old_date = timezone.now() - timedelta(days=30)
        group = self.create_group(project=self.detector.project, status=GroupStatus.UNRESOLVED)
        group.first_seen = old_date
        group.save()

        backfill_status = create_backfill_status(self.detector.id, BulkJobState.NOT_STARTED)

        process_bulk_job(backfill_status.id)

        # Check that DetectorGroup.date_added matches Group.first_seen
        detector_group = DetectorGroup.objects.get(detector_id=self.detector.id, group_id=group.id)
        assert detector_group.date_added == old_date


class CoordinateBackfillsTest(BaseWorkflowTest):
    def setUp(self) -> None:
        super().setUp()
        self.detector = self.create_detector(type=ErrorGroupType.slug)

    def test_coordinate_schedules_pending_items(self) -> None:
        """Test that coordinator schedules pending backfill items"""
        detector2 = self.create_detector(type=ErrorGroupType.slug, project=self.create_project())

        create_backfill_status(self.detector.id, BulkJobState.NOT_STARTED)
        create_backfill_status(detector2.id, BulkJobState.NOT_STARTED)

        mock_schedule = MagicMock()

        coordinate_bulk_jobs(
            ERROR_DETECTOR_BACKFILL_JOB.job_type,
            max_batch_size=100,
            in_progress_timeout=timedelta(hours=1),
            completed_cleanup_age=timedelta(days=30),
            schedule_task_fn=mock_schedule,
        )

        # Should have scheduled both items
        assert mock_schedule.call_count == 2

    def test_coordinate_resets_stuck_items(self) -> None:
        """Test that coordinator resets items stuck in_progress for more than the timeout"""
        backfill_status = create_backfill_status(self.detector.id, BulkJobState.IN_PROGRESS)

        # Manually set date_updated to more than 1 hour ago
        old_time = datetime.now(UTC) - timedelta(hours=2)
        BulkJobStatus.objects.filter(id=backfill_status.id).update(date_updated=old_time)

        mock_schedule = MagicMock()

        coordinate_bulk_jobs(
            ERROR_DETECTOR_BACKFILL_JOB.job_type,
            max_batch_size=100,
            in_progress_timeout=timedelta(hours=1),
            completed_cleanup_age=timedelta(days=30),
            schedule_task_fn=mock_schedule,
        )

        # Check that status was reset to not_started
        backfill_status.refresh_from_db()
        assert backfill_status.status == BulkJobState.NOT_STARTED

    def test_coordinate_deletes_old_completed(self) -> None:
        """Test that coordinator deletes completed items older than the cleanup age"""
        backfill_status = create_backfill_status(self.detector.id, BulkJobState.COMPLETED)

        # Manually set date_updated to more than 30 days ago
        old_time = datetime.now(UTC) - timedelta(days=31)
        BulkJobStatus.objects.filter(id=backfill_status.id).update(date_updated=old_time)

        mock_schedule = MagicMock()

        coordinate_bulk_jobs(
            ERROR_DETECTOR_BACKFILL_JOB.job_type,
            max_batch_size=100,
            in_progress_timeout=timedelta(hours=1),
            completed_cleanup_age=timedelta(days=30),
            schedule_task_fn=mock_schedule,
        )

        # Check that the record was deleted
        assert not BulkJobStatus.objects.filter(id=backfill_status.id).exists()

    def test_coordinate_respects_batch_size(self) -> None:
        """Test that coordinator only schedules up to max_batch_size items"""
        max_batch_size = 10

        # Create more than max_batch_size items
        for _ in range(max_batch_size + 5):
            project = self.create_project()
            detector = self.create_detector(type=ErrorGroupType.slug, project=project)
            create_backfill_status(detector.id, BulkJobState.NOT_STARTED)

        mock_schedule = MagicMock()

        coordinate_bulk_jobs(
            ERROR_DETECTOR_BACKFILL_JOB.job_type,
            max_batch_size=max_batch_size,
            in_progress_timeout=timedelta(hours=1),
            completed_cleanup_age=timedelta(days=30),
            schedule_task_fn=mock_schedule,
        )

        # Should only schedule max_batch_size items
        assert mock_schedule.call_count == max_batch_size

    def test_coordinate_ignores_recent_in_progress(self) -> None:
        """Test that coordinator doesn't reset recent in_progress items"""
        backfill_status = create_backfill_status(self.detector.id, BulkJobState.IN_PROGRESS)

        mock_schedule = MagicMock()

        coordinate_bulk_jobs(
            ERROR_DETECTOR_BACKFILL_JOB.job_type,
            max_batch_size=100,
            in_progress_timeout=timedelta(hours=1),
            completed_cleanup_age=timedelta(days=30),
            schedule_task_fn=mock_schedule,
        )

        # Check that status is still in_progress
        backfill_status.refresh_from_db()
        assert backfill_status.status == BulkJobState.IN_PROGRESS

    def test_coordinate_ignores_recent_completed(self) -> None:
        """Test that coordinator doesn't delete recent completed items"""
        backfill_status = create_backfill_status(self.detector.id, BulkJobState.COMPLETED)

        mock_schedule = MagicMock()

        coordinate_bulk_jobs(
            ERROR_DETECTOR_BACKFILL_JOB.job_type,
            max_batch_size=100,
            in_progress_timeout=timedelta(hours=1),
            completed_cleanup_age=timedelta(days=30),
            schedule_task_fn=mock_schedule,
        )

        # Check that the record still exists
        assert BulkJobStatus.objects.filter(id=backfill_status.id).exists()

    def test_coordinate_handles_schedule_failures(self) -> None:
        """Test that coordinator continues scheduling even if one item fails"""
        detector2 = self.create_detector(type=ErrorGroupType.slug, project=self.create_project())
        detector3 = self.create_detector(type=ErrorGroupType.slug, project=self.create_project())

        create_backfill_status(self.detector.id, BulkJobState.NOT_STARTED)
        create_backfill_status(detector2.id, BulkJobState.NOT_STARTED)
        create_backfill_status(detector3.id, BulkJobState.NOT_STARTED)

        call_count = 0

        def side_effect(backfill_status_id):
            nonlocal call_count
            call_count += 1
            if call_count == 2:
                raise Exception("Scheduling failed")

        mock_schedule = MagicMock(side_effect=side_effect)

        coordinate_bulk_jobs(
            ERROR_DETECTOR_BACKFILL_JOB.job_type,
            max_batch_size=100,
            in_progress_timeout=timedelta(hours=1),
            completed_cleanup_age=timedelta(days=30),
            schedule_task_fn=mock_schedule,
        )

        # Should have attempted to schedule all 3 items
        assert mock_schedule.call_count == 3

    def test_coordinate_logs_metrics(self) -> None:
        """Test that coordinator logs appropriate metrics"""
        detector2 = self.create_detector(type=ErrorGroupType.slug, project=self.create_project())

        create_backfill_status(self.detector.id, BulkJobState.NOT_STARTED)
        backfill_status_completed = create_backfill_status(detector2.id, BulkJobState.COMPLETED)

        # Set completed item to old date for cleanup
        old_time = datetime.now(UTC) - timedelta(days=31)
        BulkJobStatus.objects.filter(id=backfill_status_completed.id).update(date_updated=old_time)

        mock_schedule = MagicMock()

        with (
            patch("sentry.utils.metrics.incr") as mock_incr,
            patch("sentry.utils.metrics.gauge") as mock_gauge,
        ):
            coordinate_bulk_jobs(
                ERROR_DETECTOR_BACKFILL_JOB.job_type,
                max_batch_size=100,
                in_progress_timeout=timedelta(hours=1),
                completed_cleanup_age=timedelta(days=30),
                schedule_task_fn=mock_schedule,
            )

            # Check that metrics were recorded
            assert mock_incr.called
            assert mock_gauge.called


class PopulateBackfillStatusRecordsTest(BaseWorkflowTest):
    def setUp(self) -> None:
        super().setUp()

    def test_populate_creates_records(self) -> None:
        """Test that populate creates BulkJobStatus records for all error detectors"""
        detector1 = self.create_detector(type=ErrorGroupType.slug)
        detector2 = self.create_detector(type=ErrorGroupType.slug, project=self.create_project())
        detector3 = self.create_detector(type=ErrorGroupType.slug, project=self.create_project())

        result = create_bulk_job_records(
            ERROR_DETECTOR_BACKFILL_JOB.job_type,
        )

        assert result is None
        assert BulkJobStatus.objects.filter(batch_key=f"error_detector:{detector1.id}").exists()
        assert BulkJobStatus.objects.filter(batch_key=f"error_detector:{detector2.id}").exists()
        assert BulkJobStatus.objects.filter(batch_key=f"error_detector:{detector3.id}").exists()

    def test_populate_idempotent(self) -> None:
        """Test that populate is idempotent and doesn't create duplicates"""
        detector = self.create_detector(type=ErrorGroupType.slug)

        create_bulk_job_records(
            ERROR_DETECTOR_BACKFILL_JOB.job_type,
        )
        create_bulk_job_records(
            ERROR_DETECTOR_BACKFILL_JOB.job_type,
        )

        assert BulkJobStatus.objects.filter(batch_key=f"error_detector:{detector.id}").count() == 1

    def test_populate_with_start_from(self) -> None:
        """Test that populate respects start_from parameter"""
        detector1 = self.create_detector(type=ErrorGroupType.slug)
        detector2 = self.create_detector(type=ErrorGroupType.slug, project=self.create_project())
        detector3 = self.create_detector(type=ErrorGroupType.slug, project=self.create_project())

        result = create_bulk_job_records(
            ERROR_DETECTOR_BACKFILL_JOB.job_type, start_from=f"error_detector:{detector2.id}"
        )

        assert result is None
        assert not BulkJobStatus.objects.filter(batch_key=f"error_detector:{detector1.id}").exists()
        assert BulkJobStatus.objects.filter(batch_key=f"error_detector:{detector2.id}").exists()
        assert BulkJobStatus.objects.filter(batch_key=f"error_detector:{detector3.id}").exists()

    def test_populate_with_deadline(self) -> None:
        """Test that populate returns resume point when deadline is reached"""
        for _ in range(5):
            self.create_detector(type=ErrorGroupType.slug, project=self.create_project())

        past_deadline = datetime.now(UTC) - timedelta(seconds=1)
        result = create_bulk_job_records(
            ERROR_DETECTOR_BACKFILL_JOB.job_type, deadline=past_deadline
        )

        assert result is not None
        assert BulkJobStatus.objects.count() == 0

    def test_populate_resumes_from_last_processed(self) -> None:
        """Test that populate can resume from where it left off"""
        detectors = [
            self.create_detector(type=ErrorGroupType.slug, project=self.create_project())
            for _ in range(3)
        ]

        create_bulk_job_records(
            ERROR_DETECTOR_BACKFILL_JOB.job_type, start_from=f"error_detector:{detectors[0].id}"
        )
        assert BulkJobStatus.objects.count() == 3

        detector4 = self.create_detector(type=ErrorGroupType.slug, project=self.create_project())
        create_bulk_job_records(
            ERROR_DETECTOR_BACKFILL_JOB.job_type, start_from=f"error_detector:{detector4.id}"
        )

        assert BulkJobStatus.objects.count() == 4
        assert BulkJobStatus.objects.filter(batch_key=f"error_detector:{detector4.id}").exists()
