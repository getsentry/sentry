from django.urls import reverse
from rest_framework import status

from sentry.testutils import APITestCase
from sentry.testutils.silo import no_silo_test


@no_silo_test
class AdminRelayProjectConfigsEndpointTest(APITestCase):
    def setUp(self):
        super().setUp()
        self.owner = self.create_user(
            email="example@example.com", is_superuser=False, is_staff=True, is_active=True
        )
        self.org = self.create_organization(owner=self.owner)
        self.first_team = self.create_team(organization=self.org)
        self.project_1 = self.create_project(
            name="project_1", organization=self.org, teams=[self.first_team]
        )
        self.superuser = self.create_user(
            "superuser@example.com", is_superuser=True, is_staff=True, is_active=True
        )
        self.path = "sentry-api-0-internal-check-am2-compatibility"

    def get_url(self, org_id):
        ret_val = reverse(self.path)
        ret_val += f"?orgId={org_id}"

        return ret_val

    def test_check_endpoint_results_with_superuser_permissions(self):
        self.login_as(self.superuser, superuser=True)

        url = self.get_url(self.org.id)
        response = self.client.get(url)

        assert "widgets" in response.data["results"]
        assert "alerts" in response.data["results"]
        assert "sdks" in response.data["results"]

    def test_check_endpoint_results_without_superuser_permissions(self):
        self.login_as(self.owner)

        url = self.get_url(self.org.id)
        response = self.client.get(url)

        assert response.status_code == status.HTTP_403_FORBIDDEN
