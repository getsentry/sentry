from django.urls import reverse

from sentry.testutils.cases import APITestCase, BaseSpansTestCase


class OrganizationSpansTagsEndpointTest(BaseSpansTestCase, APITestCase):
    is_eap = True
    view = "sentry-api-0-organization-spans-frequency-stats"

    def setUp(self):
        super().setUp()
        self.login_as(user=self.user)

    def do_request(self, query=None, features=None, **kwargs):
        if features is None:
            features = ["organizations:performance-trace-explorer"]

        if query is None:
            query = {}
        query["dataset"] = "spans"
        if "type" not in query:
            query["type"] = "string"

        with self.feature(features):
            return self.client.get(
                reverse(self.view, kwargs={"organization_id_or_slug": self.organization.slug}),
                query,
                format="json",
                **kwargs,
            )

    def test_no_project(self):
        response = self.do_request()
        assert response.status_code == 200, response.data
        assert response.data == {"attributeDistributions": []}

    def test_no_feature(self):
        response = self.do_request(features=[])
        assert response.status_code == 404, response.data
