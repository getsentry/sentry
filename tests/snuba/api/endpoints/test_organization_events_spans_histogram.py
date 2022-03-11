from django.urls import reverse

from sentry.testutils.cases import APITestCase, SnubaTestCase


class OrganizationEventsSpansHistogramEndpointTest(APITestCase, SnubaTestCase):
    FEATURES = ["organizations:performance-span-histogram-view"]
    URL = "sentry-api-0-organization-events-spans-histogram"

    def setUp(self):
        super().setUp()
        self.features = {}
        user = self.create_user()
        self.login_as(user=user)
        self.org = self.create_organization(owner=user)

    def test_no_feature(self):
        response = self.client.get(self.URL, format="json")
        assert response.status_code == 404, response.content

    def test_endpoint(self):
        url = reverse(
            self.URL,
            kwargs={"organization_slug": self.org.slug},
        )

        with self.feature(self.FEATURES):
            response = self.client.get(url, data={"project": [-1]}, format="json")
        assert response.status_code == 200, response.content
