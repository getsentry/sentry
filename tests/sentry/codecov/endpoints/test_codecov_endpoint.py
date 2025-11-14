from typing import int
from django.urls import reverse
from rest_framework import status

from sentry.testutils.cases import APITestCase
from sentry.testutils.factories import Factories


class CodecovEndpointPermissionTest(APITestCase):
    def setUp(self) -> None:
        super().setUp()
        self.user = Factories.create_user(email="user@example.com")
        self.organization = Factories.create_organization(owner=self.user)
        self.owner_slug = "testowner"
        self.endpoint_url = reverse(
            "sentry-api-0-test-results",  # One of the endpoints that inherits the CodecovEndpoint
            kwargs={
                "organization_id_or_slug": self.organization.slug,
                "owner": self.owner_slug,
                "repository": "testrepo",
            },
        )

    def test_unauthenticated_user_denied(self) -> None:
        response = self.client.get(self.endpoint_url)
        assert response.status_code in (status.HTTP_401_UNAUTHORIZED, status.HTTP_403_FORBIDDEN)

    def test_user_not_in_org_denied(self) -> None:
        other_user = Factories.create_user(email="other@example.com")
        self.login_as(other_user)
        response = self.client.get(self.endpoint_url)
        assert response.status_code in (status.HTTP_403_FORBIDDEN, status.HTTP_404_NOT_FOUND)

    def test_user_in_org_no_integration_denied(self) -> None:
        self.login_as(self.user)
        response = self.client.get(self.endpoint_url)
        assert response.status_code == status.HTTP_404_NOT_FOUND

    def test_integration_not_in_org_denied(self) -> None:
        # Create a different organization and integration
        other_user = Factories.create_user(email="other2@example.com")
        other_org = Factories.create_organization(owner=other_user)
        other_integration = Factories.create_integration(
            organization=other_org,
            external_id="9999",
            name=self.owner_slug,
            provider="github",
        )
        # Log in as a user in the original org
        self.login_as(self.user)
        # Use the integration id from the other org in the URL
        endpoint_url = reverse(
            "sentry-api-0-test-results",
            kwargs={
                "organization_id_or_slug": self.organization.slug,
                "owner": other_integration.id,
                "repository": "testrepo",
            },
        )
        response = self.client.get(endpoint_url)
        assert response.status_code in (status.HTTP_403_FORBIDDEN, status.HTTP_404_NOT_FOUND)

    def test_auth_token_denied(self) -> None:
        token = Factories.create_user_auth_token(self.user, scope_list=["org:read"])
        response = self.client.get(self.endpoint_url, HTTP_AUTHORIZATION=f"Bearer {token.token}")
        assert response.status_code in (
            status.HTTP_401_UNAUTHORIZED,
            status.HTTP_403_FORBIDDEN,
            status.HTTP_404_NOT_FOUND,
        )
