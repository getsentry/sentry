from __future__ import annotations

from unittest.mock import patch

from django.urls import reverse
from rest_framework.test import APIClient

from sentry.constants import DataCategory
from sentry.testutils.cases import APITestCase


class OrganizationPreprodRetentionEndpointTest(APITestCase):
    endpoint = "sentry-api-0-organization-preprod-retention"

    def setUp(self) -> None:
        super().setUp()
        self.login_as(user=self.user)
        self.url = reverse(
            self.endpoint, kwargs={"organization_id_or_slug": self.organization.slug}
        )

    def test_get_default_retention(self) -> None:
        response = self.get_success_response(self.organization.slug)

        assert response.status_code == 200
        assert response.data["size"] == 90
        assert response.data["buildDistribution"] == 90
        assert response.data["snapshots"] == 396

    @patch("sentry.quotas.backend.get_event_retention")
    def test_get_custom_retention(self, mock_get_retention) -> None:
        mock_get_retention.side_effect = lambda organization, category: {
            DataCategory.SIZE_ANALYSIS: 30,
            DataCategory.INSTALLABLE_BUILD: 60,
        }.get(category)

        response = self.get_success_response(self.organization.slug)

        assert response.status_code == 200
        assert response.data["size"] == 30
        assert response.data["buildDistribution"] == 60
        assert response.data["snapshots"] == 396

    def test_get_requires_authentication(self) -> None:
        client = APIClient()
        response = client.get(self.url)
        assert response.status_code == 401
