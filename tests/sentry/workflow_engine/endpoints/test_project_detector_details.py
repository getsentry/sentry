from sentry.api.serializers import serialize
from sentry.deletions.models.scheduleddeletion import RegionScheduledDeletion
from sentry.incidents.grouptype import MetricAlertFire
from sentry.testutils.cases import APITestCase
from sentry.testutils.outbox import outbox_runner
from sentry.testutils.silo import region_silo_test
from sentry.workflow_engine.models import DataConditionGroup, DataSource, DataSourceDetector


class ProjectDetectorDetailsBaseTest(APITestCase):
    endpoint = "sentry-api-0-project-detector-details"

    def setUp(self):
        super().setUp()
        self.login_as(user=self.user)
        self.data_condition_group = self.create_data_condition_group()
        self.detector = self.create_detector(
            project_id=self.project.id,
            name="Test Detector",
            type=MetricAlertFire.slug,
            workflow_condition_group=self.data_condition_group,
        )
        data_source = DataSource.objects.filter(
            id__in=[data_source.id for data_source in self.detector.data_sources.all()]
        ).first()
        self.create_data_source_detector(data_source=data_source, detector=self.detector)


@region_silo_test
class ProjectDetectorIndexGetTest(ProjectDetectorDetailsBaseTest):
    def test_simple(self):
        response = self.get_success_response(
            self.organization.slug, self.project.slug, self.detector.id
        )
        assert response.data == serialize(self.detector)

    def test_does_not_exist(self):
        self.get_error_response(self.organization.slug, self.project.slug, 3, status_code=404)


@region_silo_test
class ProjectDetectorIndexDeleteTest(ProjectDetectorDetailsBaseTest):
    method = "DELETE"

    def test_simple(self):
        detector_id = self.detector.id
        data_condition_group = DataConditionGroup.objects.get(
            id=self.detector.workflow_condition_group.id
        )
        data_source_detector = DataSourceDetector.objects.get(detector_id=detector_id)
        data_source = DataSource.objects.get(detector=detector_id)

        with outbox_runner():
            self.get_success_response(self.organization.slug, self.project.slug, self.detector.id)

        self.detector.refresh_from_db()
        assert RegionScheduledDeletion.objects.filter(
            model_name="Detector", object_id=detector_id
        ).exists()
        assert RegionScheduledDeletion.objects.filter(
            model_name="DataConditionGroup", object_id=data_condition_group.id
        ).exists()
        assert RegionScheduledDeletion.objects.filter(
            model_name="DataSourceDetector", object_id=data_source_detector.id
        ).exists()
        assert RegionScheduledDeletion.objects.filter(
            model_name="DataSource", object_id=data_source.id
        ).exists()
