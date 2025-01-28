from sentry.api.serializers import serialize
from sentry.incidents.grouptype import MetricAlertFire
from sentry.testutils.cases import APITestCase
from sentry.testutils.silo import region_silo_test


class ProjectDetectorDetailsBaseTest(APITestCase):
    endpoint = "sentry-api-0-project-detector-details"

    def setUp(self):
        super().setUp()
        self.login_as(user=self.user)


@region_silo_test
class ProjectDetectorIndexGetTest(ProjectDetectorDetailsBaseTest):
    def test_simple(self):
        detector = self.create_detector(
            project_id=self.project.id, name="Test Detector", type=MetricAlertFire.slug
        )
        response = self.get_success_response(self.organization.slug, self.project.slug, detector.id)
        assert response.data == serialize(detector)

    def test_does_not_exist(self):
        self.get_error_response(self.organization.slug, self.project.slug, 3, status_code=404)
