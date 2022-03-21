from django.urls import reverse

from sentry.testutils import APITestCase


class OrganizationProfilingProfilesTest(APITestCase):

    endpoints = (
        "sentry-api-0-organization-profiling-profiles",
        "sentry-api-0-organization-profiling-filters",
    )

    def setUp(self):
        self.login_as(user=self.user)

    def test_feature_flag_disabled(self):
        for endpoint in self.endpoints:
            url = reverse(endpoint, args=(self.project.organization.slug,))
            response = self.client.get(url)
            assert response.status_code == 404
