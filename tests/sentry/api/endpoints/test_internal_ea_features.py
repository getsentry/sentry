from __future__ import annotations

from django.urls import reverse

from sentry.models.organization import Organization
from sentry.testutils.cases import APITestCase


class TestInternalEAFeaturesEndpoint(APITestCase):
    def test_simple(self):
        user = self.create_user(is_superuser=True)
        path = reverse("sentry-api-0-internal-ea-features")

        self.login_as(user=user, superuser=True)
        response = self.client.get(path)

        assert len(Organization.objects.all()) == 0
        assert response.status_code == 200
        assert response.data["ea_features"]
        assert "organizations:discover" not in response.data["ea_features"]
        assert response.data["missing_from_self_hosted"]
