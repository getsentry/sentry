from django.urls import reverse

from sentry.testutils.cases import APITestCase
from sentry.testutils.silo import control_silo_test


@control_silo_test
class OrganizationApiApplicationTest(APITestCase):
    endpoint = "sentry-api-0-organization-api-application"

    def setUp(self):
        super().setUp()
        self.login_as(self.user)
        self.url = reverse(self.endpoint, args=(self.organization.slug,))

    def test_get_organization_api_application(self):
        self._create_api_application([], [])
        response = self.client.get(self.url)
        assert response.status_code == 200

        response_json = response.json()
        assert len(response_json) == 3
        assert "id" in response_json
        assert response_json["allowedOrigins"] == []
        assert response_json["redirectUris"] == []

    def test_get_organization_api_application_not_found(self):
        response = self.client.get(self.url)
        assert response.status_code == 404

    def test_post_organization_api_application(self):
        self._create_api_application([], [])

        # Read our writes.
        response = self.client.get(self.url)
        assert response.status_code == 200
        response_json = response.json()
        assert len(response_json) == 3
        assert "id" in response_json
        assert response_json["allowedOrigins"] == []
        assert response_json["redirectUris"] == []

    def test_post_organization_api_application_duplicate(self):
        self._create_api_application([], [])
        response = self.client.post(self.url, data={"allowedOrigins": [], "redirectUris": []})
        assert response.status_code == 200

    def test_put_organization_api_application(self):
        self._create_api_application([], [])

        data = {
            "allowedOrigins": ["https://www.sentry.io"],
            "redirectUris": ["https://www.sentry.io/authorized/"],
        }
        response = self.client.put(self.url, data=data)
        assert response.status_code == 202

        # Read our writes.
        response = self.client.get(self.url)
        assert response.status_code == 200
        response_json = response.json()
        assert len(response_json) == 3
        assert "id" in response_json
        assert response_json["allowedOrigins"] == ["https://www.sentry.io"]
        assert response_json["redirectUris"] == ["https://www.sentry.io/authorized/"]

    def test_put_organization_api_application_not_found(self):
        data = {
            "allowedOrigins": ["https://www.sentry.io"],
            "redirectUris": ["https://www.sentry.io/authorized/"],
        }
        response = self.client.put(self.url, data=data)
        assert response.status_code == 404

    def test_delete_organization_api_application(self):
        self._create_api_application([], [])
        response = self.client.delete(self.url)
        assert response.status_code == 204

        # Read our writes.
        response = self.client.get(self.url)
        assert response.status_code == 404

    def test_delete_organization_api_application_not_found(self):
        response = self.client.delete(self.url)
        assert response.status_code == 404

    def _create_api_application(self, origins, redirects):
        data = {
            "allowedOrigins": origins,
            "redirectUris": redirects,
        }
        response = self.client.post(self.url, data=data)
        assert response.status_code == 201
        return response
