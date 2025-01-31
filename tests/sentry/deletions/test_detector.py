from sentry.deletions.tasks.scheduled import run_scheduled_deletions
from sentry.incidents.grouptype import MetricAlertFire
from sentry.testutils.cases import TestCase
from sentry.testutils.hybrid_cloud import HybridCloudTestMixin
from sentry.workflow_engine.models import (
    DataCondition,
    DataConditionGroup,
    DataSource,
    DataSourceDetector,
    Detector,
    DetectorWorkflow,
)


class DeleteDetectorTest(TestCase, HybridCloudTestMixin):
    def setUp(self):
        self.data_condition_group = self.create_data_condition_group()
        self.data_condition = self.create_data_condition(condition_group=self.data_condition_group)
        self.data_source = self.create_data_source(organization=self.organization)
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
        data_source_2 = self.create_data_source(organization=self.organization)
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

    def test_multiple_data_sources(self):
        """
        Test that if we have multiple data sources where one is connected to another Detector but the other one isn't, we only delete one
        """
        data_condition_group = self.create_data_condition_group()
        self.create_data_condition(condition_group=data_condition_group)
        detector = self.create_detector(
            project_id=self.project.id,
            name="Testy Detector",
            type=MetricAlertFire.slug,
            workflow_condition_group=data_condition_group,
        )
        data_source_2 = self.create_data_source(organization=self.organization)

        # multiple data sources for one detector
        self.create_data_source_detector(data_source=data_source_2, detector=self.detector)
        # but the data source is also connected to a different detector
        self.create_data_source_detector(data_source=data_source_2, detector=detector)
        assert not DataSource.objects.filter(id=self.data_source.id).exists()
        assert DataSource.objects.filter(id=data_source_2.id).exists()
