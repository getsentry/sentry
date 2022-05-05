from uuid import uuid4

from django.urls import reverse
from rest_framework.exceptions import ErrorDetail

from sentry.testutils import APITestCase

PROFILING_FEATURES = {"organizations:profiling": True}


class ProjectProfilingProfileTest(APITestCase):
    endpoint = "sentry-api-0-project-profiling-profile"

    def setUp(self):
        self.login_as(user=self.user)

    def test_feature_flag_disabled(self):
        response = self.get_response(self.project.organization.slug, self.project.id, str(uuid4()))
        assert response.status_code == 404


class ProjectProfilingFunctionsEndpoint(APITestCase):
    endpoint = "sentry-api-0-project-profiling-functions"

    def setUp(self):
        self.login_as(user=self.user)
        self.url = reverse(
            self.endpoint,
            kwargs={
                "organization_slug": self.project.organization.slug,
                "project_slug": self.project.slug,
            },
        )

    def test_feature_flag_disabled(self):
        response = self.get_response(self.project.organization.slug, self.project.id)
        assert response.status_code == 404

    def test_bad_filter(self):
        with self.feature(PROFILING_FEATURES):
            response = self.client.get(self.url, {"query": "foo:bar"})
        assert response.status_code == 400
        assert response.data == {
            "detail": ErrorDetail(string="Invalid query: foo is not supported", code="parse_error")
        }
