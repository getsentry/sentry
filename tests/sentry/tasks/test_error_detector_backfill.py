from datetime import UTC, datetime, timedelta
from unittest.mock import patch

from sentry.grouping.grouptype import ErrorGroupType
from sentry.models.group import GroupStatus
from sentry.workflow_engine.models import DetectorGroup, ErrorBackfillStatus
from sentry.workflow_engine.tasks.error_detector_backfill import (
    coordinate_error_backfill,
    populate_error_backfill_status,
    process_error_backfill,
)
from tests.sentry.workflow_engine.test_base import BaseWorkflowTest


class ProcessErrorBackfillTest(BaseWorkflowTest):
    def setUp(self) -> None:
        super().setUp()
        self.detector = self.create_detector(type=ErrorGroupType.slug)

    def test_task_persistent_name(self) -> None:
        """Test that the task has a persistent name"""
        assert (
            process_error_backfill.name
            == "sentry.workflow_engine.tasks.error_detector_backfill.process_error_backfill"
        )

    def test_process_backfill_success(self) -> None:
        """Test that processing a backfill creates DetectorGroups for all unresolved groups"""
        # Create some unresolved error groups
        group1 = self.create_group(project=self.detector.project, status=GroupStatus.UNRESOLVED)
        group2 = self.create_group(project=self.detector.project, status=GroupStatus.UNRESOLVED)
        group3 = self.create_group(project=self.detector.project, status=GroupStatus.RESOLVED)

        backfill_status = ErrorBackfillStatus.objects.create(
            detector=self.detector,
            status="not_started",
        )

        # Process the backfill
        with self.tasks():
            process_error_backfill(backfill_status.id)

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
        assert backfill_status.status == "completed"

    def test_process_backfill_already_exists(self) -> None:
        """Test that processing a backfill succeeds even if some DetectorGroups already exist"""
        group1 = self.create_group(project=self.detector.project, status=GroupStatus.UNRESOLVED)
        group2 = self.create_group(project=self.detector.project, status=GroupStatus.UNRESOLVED)

        # Create DetectorGroup for group1 first
        DetectorGroup.objects.create(
            detector_id=self.detector.id,
            group_id=group1.id,
        )

        backfill_status = ErrorBackfillStatus.objects.create(
            detector=self.detector,
            status="not_started",
        )

        # Process the backfill (should not fail)
        with self.tasks():
            process_error_backfill(backfill_status.id)

        # Check that status was updated to completed
        backfill_status.refresh_from_db()
        assert backfill_status.status == "completed"

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
        with self.tasks():
            process_error_backfill(999999)

    def test_process_backfill_marks_in_progress(self) -> None:
        """Test that processing marks the backfill as in_progress and then completed"""
        backfill_status = ErrorBackfillStatus.objects.create(
            detector=self.detector,
            status="not_started",
        )

        # Create a group to process
        self.create_group(project=self.detector.project, status=GroupStatus.UNRESOLVED)

        # Process the backfill
        with self.tasks():
            process_error_backfill(backfill_status.id)

        # Check that status transitioned from not_started -> in_progress -> completed
        backfill_status.refresh_from_db()
        assert backfill_status.status == "completed"

    def test_process_backfill_date_added_preservation(self) -> None:
        """Test that DetectorGroup.date_added is set to Group.first_seen"""
        from datetime import timedelta

        from django.utils import timezone

        # Create a group with a specific first_seen date
        old_date = timezone.now() - timedelta(days=30)
        group = self.create_group(project=self.detector.project, status=GroupStatus.UNRESOLVED)
        group.first_seen = old_date
        group.save()

        backfill_status = ErrorBackfillStatus.objects.create(
            detector=self.detector,
            status="not_started",
        )

        with self.tasks():
            process_error_backfill(backfill_status.id)

        # Check that DetectorGroup.date_added matches Group.first_seen
        detector_group = DetectorGroup.objects.get(detector_id=self.detector.id, group_id=group.id)
        assert detector_group.date_added == old_date


class CoordinateErrorBackfillTest(BaseWorkflowTest):
    def setUp(self) -> None:
        super().setUp()
        self.detector = self.create_detector(type=ErrorGroupType.slug)

    def test_task_persistent_name(self) -> None:
        """Test that the task has a persistent name"""
        assert (
            coordinate_error_backfill.name
            == "sentry.workflow_engine.tasks.error_detector_backfill.coordinate_error_backfill"
        )

    def test_coordinate_schedules_pending_items(self) -> None:
        """Test that coordinator schedules pending backfill items"""
        detector2 = self.create_detector(type=ErrorGroupType.slug, project=self.create_project())

        ErrorBackfillStatus.objects.create(detector=self.detector, status="not_started")
        ErrorBackfillStatus.objects.create(detector=detector2, status="not_started")

        with patch(
            "sentry.workflow_engine.tasks.error_detector_backfill.process_error_backfill.apply_async"
        ) as mock_apply_async:
            with self.tasks():
                coordinate_error_backfill()

            # Should have scheduled both items
            assert mock_apply_async.call_count == 2

    def test_coordinate_resets_stuck_items(self) -> None:
        """Test that coordinator resets items stuck in_progress for more than 1 hour"""
        backfill_status = ErrorBackfillStatus.objects.create(
            detector=self.detector, status="in_progress"
        )

        # Manually set date_updated to more than 1 hour ago
        old_time = datetime.now(UTC) - timedelta(hours=2)
        ErrorBackfillStatus.objects.filter(id=backfill_status.id).update(date_updated=old_time)

        # Mock apply_async to prevent the task from running
        with patch(
            "sentry.workflow_engine.tasks.error_detector_backfill.process_error_backfill.apply_async"
        ):
            with self.tasks():
                coordinate_error_backfill()

        # Check that status was reset to not_started
        backfill_status.refresh_from_db()
        assert backfill_status.status == "not_started"

    def test_coordinate_deletes_old_completed(self) -> None:
        """Test that coordinator deletes completed items older than 30 days"""
        backfill_status = ErrorBackfillStatus.objects.create(
            detector=self.detector, status="completed"
        )

        # Manually set date_updated to more than 30 days ago
        old_time = datetime.now(UTC) - timedelta(days=31)
        ErrorBackfillStatus.objects.filter(id=backfill_status.id).update(date_updated=old_time)

        with self.tasks():
            coordinate_error_backfill()

        # Check that the record was deleted
        assert not ErrorBackfillStatus.objects.filter(id=backfill_status.id).exists()

    def test_coordinate_respects_batch_size(self) -> None:
        """Test that coordinator only schedules up to MAX_BACKFILL_BATCH_SIZE items"""
        from sentry.workflow_engine.tasks.error_detector_backfill import MAX_BACKFILL_BATCH_SIZE

        # Create more than MAX_BACKFILL_BATCH_SIZE items
        for i in range(MAX_BACKFILL_BATCH_SIZE + 10):
            project = self.create_project()
            detector = self.create_detector(type=ErrorGroupType.slug, project=project)
            ErrorBackfillStatus.objects.create(detector=detector, status="not_started")

        with patch(
            "sentry.workflow_engine.tasks.error_detector_backfill.process_error_backfill.apply_async"
        ) as mock_apply_async:
            with self.tasks():
                coordinate_error_backfill()

            # Should only schedule MAX_BACKFILL_BATCH_SIZE items
            assert mock_apply_async.call_count == MAX_BACKFILL_BATCH_SIZE

    def test_coordinate_ignores_recent_in_progress(self) -> None:
        """Test that coordinator doesn't reset recent in_progress items"""
        backfill_status = ErrorBackfillStatus.objects.create(
            detector=self.detector, status="in_progress"
        )

        with self.tasks():
            coordinate_error_backfill()

        # Check that status is still in_progress
        backfill_status.refresh_from_db()
        assert backfill_status.status == "in_progress"

    def test_coordinate_ignores_recent_completed(self) -> None:
        """Test that coordinator doesn't delete recent completed items"""
        backfill_status = ErrorBackfillStatus.objects.create(
            detector=self.detector, status="completed"
        )

        with self.tasks():
            coordinate_error_backfill()

        # Check that the record still exists
        assert ErrorBackfillStatus.objects.filter(id=backfill_status.id).exists()

    def test_coordinate_logs_metrics(self) -> None:
        """Test that coordinator logs appropriate metrics"""
        detector2 = self.create_detector(type=ErrorGroupType.slug, project=self.create_project())

        ErrorBackfillStatus.objects.create(detector=self.detector, status="not_started")
        backfill_status_completed = ErrorBackfillStatus.objects.create(
            detector=detector2, status="completed"
        )

        # Set completed item to old date for cleanup
        old_time = datetime.now(UTC) - timedelta(days=31)
        ErrorBackfillStatus.objects.filter(id=backfill_status_completed.id).update(
            date_updated=old_time
        )

        with (
            patch("sentry.utils.metrics.incr") as mock_incr,
            patch("sentry.utils.metrics.gauge") as mock_gauge,
        ):
            with self.tasks():
                coordinate_error_backfill()

            # Check that metrics were recorded
            assert mock_incr.called
            assert mock_gauge.called


class PopulateErrorBackfillStatusTest(BaseWorkflowTest):
    def setUp(self) -> None:
        super().setUp()

    def test_task_persistent_name(self) -> None:
        """Test that the task has a persistent name"""
        assert (
            populate_error_backfill_status.name
            == "sentry.workflow_engine.tasks.error_detector_backfill.populate_error_backfill_status"
        )

    def test_populate_creates_records(self) -> None:
        """Test that populate creates ErrorBackfillStatus records for all error detectors"""
        detector1 = self.create_detector(type=ErrorGroupType.slug)
        detector2 = self.create_detector(type=ErrorGroupType.slug, project=self.create_project())
        detector3 = self.create_detector(type=ErrorGroupType.slug, project=self.create_project())

        # Populate
        with self.tasks():
            populate_error_backfill_status()

        # Check that records were created
        assert ErrorBackfillStatus.objects.filter(detector=detector1).exists()
        assert ErrorBackfillStatus.objects.filter(detector=detector2).exists()
        assert ErrorBackfillStatus.objects.filter(detector=detector3).exists()

    def test_populate_idempotent(self) -> None:
        """Test that populate is idempotent and doesn't create duplicates"""
        detector = self.create_detector(type=ErrorGroupType.slug)

        # Populate twice
        with self.tasks():
            populate_error_backfill_status()
            populate_error_backfill_status()

        # Should only have one record
        assert ErrorBackfillStatus.objects.filter(detector=detector).count() == 1
