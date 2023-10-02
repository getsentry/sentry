from unittest import mock

from django.urls import reverse

from sentry.testutils.cases import APITestCase
from sentry.testutils.silo import region_silo_test


@region_silo_test(stable=True)
class ProjectDynamicSamplingTest(APITestCase):
    @property
    def endpoint(self):
        return reverse(
            "sentry-api-0-project-dynamic-sampling-rate",
            kwargs={
                "organization_slug": self.project.organization.slug,
                "project_slug": self.project.slug,
            },
        )

    def test_permission(self):
        user = self.create_user("foo@example.com")
        self.login_as(user)

        response = self.client.get(self.endpoint)
        assert response.status_code == 403

    @mock.patch("sentry.api.endpoints.project_dynamic_sampling.get_guarded_blended_sample_rate")
    def test_get_project_sample_rate_success(self, mock_get_sample_rate):
        mock_get_sample_rate.return_value = 1.0

        self.login_as(self.user)

        response = self.client.get(f"{self.endpoint}")

        assert mock_get_sample_rate.call_count == 1
        assert response.status_code == 200
        assert response.data["sampleRate"] == 1.0

    def test_get_project_sample_rate_fail(self):
        self.login_as(self.user)

        response = self.client.get(f"{self.endpoint}")
        assert response.status_code == 400
