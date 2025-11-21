import pytest

from sentry.grouping.grouptype import ErrorGroupType
from sentry.workflow_engine.models import BulkJobState, BulkJobStatus, Detector
from sentry.workflow_engine.processors.error_backfill import (
    ERROR_BACKFILL_JOB,
    ErrorDetectorWorkChunk,
)
from tests.sentry.workflow_engine.test_base import BaseWorkflowTest


class BulkJobStatusTest(BaseWorkflowTest):
    def setUp(self) -> None:
        super().setUp()
        self.detector = self.create_detector(type=ErrorGroupType.slug)

    def test_create_error_backfill_status(self) -> None:
        """Test that we can create a BulkJobStatus record"""
        work_chunk = ErrorDetectorWorkChunk(detector_id=self.detector.id)
        batch_key = ERROR_BACKFILL_JOB.get_batch_key(work_chunk)
        backfill_status = BulkJobStatus(
            job_type=ERROR_BACKFILL_JOB.job_type,
            batch_key=batch_key,
            work_chunk_info=work_chunk.dict(),
            status=BulkJobState.NOT_STARTED,
        )
        backfill_status.save()

        assert backfill_status.id is not None
        assert backfill_status.batch_key == f"error_detector:{self.detector.id}"
        assert backfill_status.work_chunk_info["detector_id"] == self.detector.id
        assert backfill_status.status == BulkJobState.NOT_STARTED
        assert backfill_status.date_added is not None
        assert backfill_status.date_updated is not None

    def test_unique_constraint(self) -> None:
        """Test that batch_key is unique"""
        from django.db import IntegrityError

        work_chunk = ErrorDetectorWorkChunk(detector_id=self.detector.id)
        batch_key = ERROR_BACKFILL_JOB.get_batch_key(work_chunk)
        backfill_status = BulkJobStatus(
            job_type=ERROR_BACKFILL_JOB.job_type,
            batch_key=batch_key,
            work_chunk_info=work_chunk.dict(),
            status=BulkJobState.NOT_STARTED,
        )
        backfill_status.save()

        # Creating a duplicate should fail
        with pytest.raises(IntegrityError):
            duplicate = BulkJobStatus(
                job_type=ERROR_BACKFILL_JOB.job_type,
                batch_key=batch_key,
                work_chunk_info=work_chunk.dict(),
                status=BulkJobState.NOT_STARTED,
            )
            duplicate.save()

    def test_status_transitions(self) -> None:
        """Test that we can transition between statuses"""
        work_chunk = ErrorDetectorWorkChunk(detector_id=self.detector.id)
        batch_key = ERROR_BACKFILL_JOB.get_batch_key(work_chunk)
        backfill_status = BulkJobStatus(
            job_type=ERROR_BACKFILL_JOB.job_type,
            batch_key=batch_key,
            work_chunk_info=work_chunk.dict(),
            status=BulkJobState.NOT_STARTED,
        )
        backfill_status.save()

        # Transition to in_progress
        backfill_status.status = BulkJobState.IN_PROGRESS
        backfill_status.save()
        backfill_status.refresh_from_db()
        assert backfill_status.status == BulkJobState.IN_PROGRESS

        # Transition to completed
        backfill_status.status = BulkJobState.COMPLETED
        backfill_status.save()
        backfill_status.refresh_from_db()
        assert backfill_status.status == BulkJobState.COMPLETED

    def test_queryset_filter_by_status(self) -> None:
        """Test that we can efficiently query by status"""
        # Create several backfill statuses with different statuses
        detector2 = self.create_detector(type=ErrorGroupType.slug, project=self.create_project())
        detector3 = self.create_detector(type=ErrorGroupType.slug, project=self.create_project())

        for detector, status in [
            (self.detector, BulkJobState.NOT_STARTED),
            (detector2, BulkJobState.IN_PROGRESS),
            (detector3, BulkJobState.COMPLETED),
        ]:
            work_chunk = ErrorDetectorWorkChunk(detector_id=detector.id)
            batch_key = ERROR_BACKFILL_JOB.get_batch_key(work_chunk)
            backfill_status = BulkJobStatus(
                job_type=ERROR_BACKFILL_JOB.job_type,
                batch_key=batch_key,
                work_chunk_info=work_chunk.dict(),
                status=status,
            )
            backfill_status.save()

        # Query by status
        assert BulkJobStatus.objects.filter(status=BulkJobState.NOT_STARTED).count() == 1
        assert BulkJobStatus.objects.filter(status=BulkJobState.IN_PROGRESS).count() == 1
        assert BulkJobStatus.objects.filter(status=BulkJobState.COMPLETED).count() == 1

    def test_detector_delete_does_not_cascade(self) -> None:
        """Test that deleting a detector does not cascade to BulkJobStatus (decoupled)"""
        work_chunk = ErrorDetectorWorkChunk(detector_id=self.detector.id)
        batch_key = ERROR_BACKFILL_JOB.get_batch_key(work_chunk)
        backfill_status = BulkJobStatus(
            job_type=ERROR_BACKFILL_JOB.job_type,
            batch_key=batch_key,
            work_chunk_info=work_chunk.dict(),
            status=BulkJobState.NOT_STARTED,
        )
        backfill_status.save()

        detector_id = self.detector.id
        backfill_status_id = backfill_status.id

        # Delete the detector
        self.detector.delete()

        # The backfill status should still exist (decoupled model)
        assert not Detector.objects.filter(id=detector_id).exists()
        assert BulkJobStatus.objects.filter(id=backfill_status_id).exists()
