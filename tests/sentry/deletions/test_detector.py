from sentry.deletions.tasks.scheduled import run_scheduled_deletions
from sentry.incidents.grouptype import MetricAlertFire
from sentry.snuba.models import QuerySubscription, SnubaQuery
from sentry.testutils.hybrid_cloud import HybridCloudTestMixin
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
    def setUp(self):
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
            type=MetricAlertFire.slug,
            workflow_condition_group=self.data_condition_group,
        )
        self.workflow = self.create_workflow()
        self.data_source_detector = self.create_data_source_detector(
            data_source=self.data_source, detector=self.detector
        )
        self.detector_workflow = DetectorWorkflow.objects.create(
            detector=self.detector, workflow=self.workflow
        )

    def test_simple(self):
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

    def test_multiple_data_sources(self):
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

    def test_data_source_not_deleted(self):
        """
        Test that we do not delete a DataSource that is connected to another Detector
        """
        detector_2 = self.create_detector(
            project_id=self.project.id,
            name="Testy Detector",
            type=MetricAlertFire.slug,
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
