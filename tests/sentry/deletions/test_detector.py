from unittest import mock

import pytest

from sentry.constants import ObjectStatus
from sentry.deletions.tasks.scheduled import run_scheduled_deletions
from sentry.incidents.grouptype import MetricIssue
from sentry.snuba.models import QuerySubscription, SnubaQuery
from sentry.testutils.hybrid_cloud import HybridCloudTestMixin
from sentry.uptime.models import UptimeSubscription, get_uptime_subscription
from sentry.workflow_engine.models import (
    DataCondition,
    DataConditionGroup,
    DataSource,
    DataSourceDetector,
    Detector,
    DetectorWorkflow,
)
from tests.sentry.workflow_engine.test_base import BaseWorkflowTest


class DeleteDetectorTest(BaseWorkflowTest, HybridCloudTestMixin):
    def setUp(self) -> None:
        self.data_condition_group = self.create_data_condition_group()
        self.data_condition = self.create_data_condition(condition_group=self.data_condition_group)
        self.snuba_query = self.create_snuba_query()
        self.subscription = QuerySubscription.objects.create(
            project=self.project,
            status=QuerySubscription.Status.ACTIVE.value,
            subscription_id="123",
            snuba_query=self.snuba_query,
        )
        self.data_source = self.create_data_source(
            organization=self.organization, source_id=self.subscription.id
        )
        self.detector = self.create_detector(
            project_id=self.project.id,
            name="Test Detector",
            type=MetricIssue.slug,
            workflow_condition_group=self.data_condition_group,
        )
        self.workflow = self.create_workflow()
        self.data_source_detector = self.create_data_source_detector(
            data_source=self.data_source, detector=self.detector
        )
        self.detector_workflow = DetectorWorkflow.objects.create(
            detector=self.detector, workflow=self.workflow
        )
        self.detector.status = ObjectStatus.PENDING_DELETION
        self.detector.save()

    def test_simple(self) -> None:
        self.ScheduledDeletion.schedule(instance=self.detector, days=0)

        with self.tasks():
            run_scheduled_deletions()

        assert not Detector.objects.filter(id=self.detector.id).exists()
        assert not DataSourceDetector.objects.filter(id=self.data_source_detector.id).exists()
        assert not DetectorWorkflow.objects.filter(id=self.detector_workflow.id).exists()
        assert not DataConditionGroup.objects.filter(id=self.data_condition_group.id).exists()
        assert not DataCondition.objects.filter(id=self.data_condition.id).exists()
        assert not DataSource.objects.filter(id=self.data_source.id).exists()
        assert not QuerySubscription.objects.filter(id=self.subscription.id).exists()
        assert not SnubaQuery.objects.filter(id=self.snuba_query.id).exists()

    def test_multiple_data_sources(self) -> None:
        snuba_query_2 = self.create_snuba_query()
        subscription_2 = QuerySubscription.objects.create(
            project=self.project,
            status=QuerySubscription.Status.ACTIVE.value,
            subscription_id="456",
            snuba_query=snuba_query_2,
        )
        data_source_2 = self.create_data_source(
            organization=self.organization, source_id=subscription_2.id
        )
        data_source_detector_2 = self.create_data_source_detector(
            data_source=data_source_2, detector=self.detector
        )
        self.ScheduledDeletion.schedule(instance=self.detector, days=0)

        with self.tasks():
            run_scheduled_deletions()

        assert not Detector.objects.filter(id=self.detector.id).exists()
        assert not DataSourceDetector.objects.filter(
            id__in=[self.data_source_detector.id, data_source_detector_2.id]
        ).exists()
        assert not DetectorWorkflow.objects.filter(id=self.detector_workflow.id).exists()
        assert not DataConditionGroup.objects.filter(id=self.data_condition_group.id).exists()
        assert not DataCondition.objects.filter(id=self.data_condition.id).exists()
        assert not DataSource.objects.filter(
            id__in=[self.data_source.id, data_source_2.id]
        ).exists()
        assert not QuerySubscription.objects.filter(
            id__in=[self.subscription.id, subscription_2.id]
        ).exists()
        assert not SnubaQuery.objects.filter(
            id__in=[self.snuba_query.id, snuba_query_2.id]
        ).exists()

    def test_data_source_not_deleted(self) -> None:
        """
        Test that we do not delete a DataSource that is connected to another Detector
        """
        detector_2 = self.create_detector(
            project_id=self.project.id,
            name="Testy Detector",
            type=MetricIssue.slug,
        )
        data_source_detector_2 = self.create_data_source_detector(
            data_source=self.data_source, detector=detector_2
        )
        self.ScheduledDeletion.schedule(instance=self.detector, days=0)

        with self.tasks():
            run_scheduled_deletions()

        assert not Detector.objects.filter(id=self.detector.id).exists()
        assert not DataSourceDetector.objects.filter(id=self.data_source_detector.id).exists()
        assert not DetectorWorkflow.objects.filter(id=self.detector_workflow.id).exists()
        assert not DataConditionGroup.objects.filter(id=self.data_condition_group.id).exists()
        assert not DataCondition.objects.filter(id=self.data_condition.id).exists()
        assert DataSource.objects.filter(id=self.data_source.id).exists()
        assert DataSourceDetector.objects.filter(id=data_source_detector_2.id).exists()

    def test_delete_uptime_detector(self) -> None:
        detector = self.create_uptime_detector()
        uptime_sub = get_uptime_subscription(detector)
        self.ScheduledDeletion.schedule(instance=detector, days=0)

        with self.tasks():
            run_scheduled_deletions()

        with pytest.raises(Detector.DoesNotExist):
            detector.refresh_from_db()
        with pytest.raises(UptimeSubscription.DoesNotExist):
            uptime_sub.refresh_from_db()

    @mock.patch("sentry.quotas.backend.remove_seat")
    def test_delete_uptime_detector_calls_remove_seat(
        self, mock_remove_seat: mock.MagicMock
    ) -> None:
        """Verify remove_seat is called when an uptime detector is deleted."""
        detector = self.create_uptime_detector()
        self.ScheduledDeletion.schedule(instance=detector, days=0)

        with self.tasks():
            run_scheduled_deletions()

        assert not Detector.objects.filter(id=detector.id).exists()
        assert mock_remove_seat.call_count >= 1

    @mock.patch("sentry.deletions.defaults.uptime_subscription.remove_uptime_seat")
    @mock.patch("sentry.uptime.subscriptions.subscriptions.remove_uptime_seat")
    def test_delete_uptime_detector_succeeds_when_remove_seat_fails(
        self,
        mock_remove_seat_subscriptions: mock.MagicMock,
        mock_remove_seat_deletion: mock.MagicMock,
    ) -> None:
        """Detector deletion succeeds even if remove_uptime_seat raises in DetectorDeletionTask."""
        # DetectorDeletionTask.delete_instance does a lazy import from
        # sentry.uptime.subscriptions.subscriptions, so it picks up this mock.
        mock_remove_seat_subscriptions.side_effect = Exception("seat error")
        # UptimeSubscriptionDeletionTask uses a top-level import bound at module
        # load time, so we mock at the import target separately (default no-op).
        detector = self.create_uptime_detector()
        detector_id = detector.id
        self.ScheduledDeletion.schedule(instance=detector, days=0)

        with self.tasks():
            run_scheduled_deletions()

        assert not Detector.objects.filter(id=detector_id).exists()
        # Verify the error path in DetectorDeletionTask was actually exercised.
        mock_remove_seat_subscriptions.assert_called_once()

    def test_delete_uptime_subscription_without_detector(self) -> None:
        """UptimeSubscription deletion proceeds when the detector no longer exists."""
        detector = self.create_uptime_detector()
        uptime_sub = get_uptime_subscription(detector)
        uptime_sub_id = uptime_sub.id

        # Delete the detector and its data sources directly so the
        # UptimeSubscription is orphaned (no detector to find via get_detector).
        DataSourceDetector.objects.filter(detector=detector).delete()
        DataSource.objects.filter(
            source_id=str(uptime_sub.id),
        ).delete()
        detector.delete()

        self.ScheduledDeletion.schedule(instance=uptime_sub, days=0)

        with self.tasks():
            run_scheduled_deletions()

        assert not UptimeSubscription.objects.filter(id=uptime_sub_id).exists()
