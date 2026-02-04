from __future__ import annotations

from django.urls import reverse
from rest_framework.test import APIClient

from sentry.testutils.cases import APITestCase


class OrganizationPreprodQuotaEndpointTest(APITestCase):
    endpoint = "sentry-api-0-organization-preprod-quota"

    def setUp(self) -> None:
        super().setUp()
        self.login_as(user=self.user)
        self.url = reverse(
            self.endpoint, kwargs={"organization_id_or_slug": self.organization.slug}
        )

    def test_get_quota_state(self) -> None:
        response = self.get_success_response(self.organization.slug)

        assert response.status_code == 200
        assert "hasSizeQuota" in response.data
        assert "hasDistributionQuota" in response.data
        assert isinstance(response.data["hasSizeQuota"], bool)
        assert isinstance(response.data["hasDistributionQuota"], bool)

    def test_get_quota_state_without_enforcement(self) -> None:
        response = self.get_success_response(self.organization.slug)

        assert response.status_code == 200
        assert response.data["hasSizeQuota"] is True
        assert response.data["hasDistributionQuota"] is True

    def test_get_requires_authentication(self) -> None:
        client = APIClient()
        response = client.get(self.url)
        assert response.status_code == 401
