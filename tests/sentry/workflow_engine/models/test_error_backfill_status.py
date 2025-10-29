import pytest

from sentry.grouping.grouptype import ErrorGroupType
from sentry.workflow_engine.models import Detector, ErrorBackfillStatus
from tests.sentry.workflow_engine.test_base import BaseWorkflowTest


class ErrorBackfillStatusTest(BaseWorkflowTest):
    def setUp(self) -> None:
        super().setUp()
        self.detector = self.create_detector(type=ErrorGroupType.slug)

    def test_create_error_backfill_status(self) -> None:
        """Test that we can create an ErrorBackfillStatus record"""
        backfill_status = ErrorBackfillStatus.objects.create(
            detector=self.detector,
            status="not_started",
        )

        assert backfill_status.id is not None
        assert backfill_status.detector_id == self.detector.id
        assert backfill_status.status == "not_started"
        assert backfill_status.date_added is not None
        assert backfill_status.date_updated is not None

    def test_unique_constraint(self) -> None:
        """Test that detector is unique"""
        from django.db import IntegrityError

        ErrorBackfillStatus.objects.create(
            detector=self.detector,
            status="not_started",
        )

        # Creating a duplicate should fail
        with pytest.raises(IntegrityError):
            ErrorBackfillStatus.objects.create(
                detector=self.detector,
                status="not_started",
            )

    def test_status_transitions(self) -> None:
        """Test that we can transition between statuses"""
        backfill_status = ErrorBackfillStatus.objects.create(
            detector=self.detector,
            status="not_started",
        )

        # Transition to in_progress
        backfill_status.status = "in_progress"
        backfill_status.save()
        backfill_status.refresh_from_db()
        assert backfill_status.status == "in_progress"

        # Transition to completed
        backfill_status.status = "completed"
        backfill_status.save()
        backfill_status.refresh_from_db()
        assert backfill_status.status == "completed"

    def test_queryset_filter_by_status(self) -> None:
        """Test that we can efficiently query by status"""
        # Create several backfill statuses with different statuses
        detector2 = self.create_detector(type=ErrorGroupType.slug, project=self.create_project())
        detector3 = self.create_detector(type=ErrorGroupType.slug, project=self.create_project())

        ErrorBackfillStatus.objects.create(detector=self.detector, status="not_started")
        ErrorBackfillStatus.objects.create(detector=detector2, status="in_progress")
        ErrorBackfillStatus.objects.create(detector=detector3, status="completed")

        # Query by status
        assert ErrorBackfillStatus.objects.filter(status="not_started").count() == 1
        assert ErrorBackfillStatus.objects.filter(status="in_progress").count() == 1
        assert ErrorBackfillStatus.objects.filter(status="completed").count() == 1

    def test_detector_cascade_delete(self) -> None:
        """Test that deleting a detector cascades to ErrorBackfillStatus"""
        backfill_status = ErrorBackfillStatus.objects.create(
            detector=self.detector,
            status="not_started",
        )

        detector_id = self.detector.id
        backfill_status_id = backfill_status.id

        # Delete the detector
        self.detector.delete()

        # The backfill status should also be deleted
        assert not Detector.objects.filter(id=detector_id).exists()
        assert not ErrorBackfillStatus.objects.filter(id=backfill_status_id).exists()
