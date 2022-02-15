from uuid import uuid4

from sentry.testutils import APITestCase


class ProjectStacktraceTest(APITestCase):
    endpoint = "sentry-api-0-project-stacktrace"

    def setUp(self):
        self.login_as(user=self.user)

    def test_feature_flag_disabled(self):
        response = self.get_response(self.project.organization.slug, self.project.id, str(uuid4()))
        assert response.status_code == 404
