from sentry.api.serializers import serialize
from sentry.deletions.models.scheduleddeletion import RegionScheduledDeletion
from sentry.grouping.grouptype import ErrorGroupType
from sentry.incidents.grouptype import MetricAlertFire
from sentry.testutils.cases import APITestCase
from sentry.testutils.outbox import outbox_runner
from sentry.testutils.silo import region_silo_test


class ProjectDetectorDetailsBaseTest(APITestCase):
    endpoint = "sentry-api-0-project-detector-details"

    def setUp(self):
        super().setUp()
        self.login_as(user=self.user)
        self.data_source = self.create_data_source(organization=self.organization)
        self.data_condition_group = self.create_data_condition_group()
        self.detector = self.create_detector(
            project_id=self.project.id,
            name="Test Detector",
            type=MetricAlertFire.slug,
            workflow_condition_group=self.data_condition_group,
        )
        self.data_source_detector = self.create_data_source_detector(
            data_source=self.data_source, detector=self.detector
        )


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
        with outbox_runner():
            self.get_success_response(self.organization.slug, self.project.slug, self.detector.id)

        assert RegionScheduledDeletion.objects.filter(
            model_name="Detector", object_id=self.detector.id
        ).exists()

    def test_error_group_type(self):
        """
        Test that we do not delete the required error detector
        """
        data_condition_group = self.create_data_condition_group()
        error_detector = self.create_detector(
            project_id=self.project.id,
            name="Error Detector",
            type=ErrorGroupType.slug,
            workflow_condition_group=data_condition_group,
        )
        with outbox_runner():
            self.get_error_response(
                self.organization.slug, self.project.slug, error_detector.id, status_code=403
            )

        assert not RegionScheduledDeletion.objects.filter(
            model_name="Detector", object_id=error_detector.id
        ).exists()
