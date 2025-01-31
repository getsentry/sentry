from sentry.deletions.tasks.scheduled import run_scheduled_deletions
from sentry.incidents.grouptype import MetricAlertFire
from sentry.testutils.cases import TestCase
from sentry.testutils.hybrid_cloud import HybridCloudTestMixin
from sentry.workflow_engine.models import (  # DataSource,; Workflow,
    DataCondition,
    DataConditionGroup,
    DataSourceDetector,
    Detector,
    DetectorWorkflow,
)


class DeleteDetectorTest(TestCase, HybridCloudTestMixin):
    def test_simple(self):
        data_condition_group = self.create_data_condition_group()
        data_condition = self.create_data_condition(condition_group=data_condition_group)
        data_source = self.create_data_source(organization=self.organization)
        detector = self.create_detector(
            project_id=self.project.id,
            name="Test Detector",
            type=MetricAlertFire.slug,
            workflow_condition_group=data_condition_group,
        )
        workflow = self.create_workflow()
        data_source_detector = self.create_data_source_detector(
            data_source=data_source, detector=detector
        )
        detector_workflow = DetectorWorkflow.objects.create(detector=detector, workflow=workflow)
        self.ScheduledDeletion.schedule(instance=detector, days=0)

        with self.tasks():
            run_scheduled_deletions()

        assert not Detector.objects.filter(id=detector.id).exists()
        assert not DataSourceDetector.objects.filter(id=data_source_detector.id).exists()
        assert not DetectorWorkflow.objects.filter(id=detector_workflow.id).exists()
        assert not DataConditionGroup.objects.filter(id=data_condition_group.id).exists()
        assert not DataCondition.objects.filter(id=data_condition.id).exists()
        # assert not DataSource.objects.filter(id=data_source.id).exists()
