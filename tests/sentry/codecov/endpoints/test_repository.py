from typing import int, Any
from unittest.mock import MagicMock, Mock, patch

from django.urls import reverse

from sentry.codecov.endpoints.repository.serializers import RepositorySerializer
from sentry.constants import ObjectStatus
from sentry.testutils.cases import APITestCase

mock_graphql_response_success: dict[str, Any] = {
    "data": {
        "owner": {
            "repository": {
                "uploadToken": "token123",
                "testAnalyticsEnabled": True,
            }
        }
    }
}

mock_graphql_response_not_found: dict[str, Any] = {
    "data": {
        "owner": {
            "repository": {
                "__typename": "NotFoundError",
                "message": "Repository not found",
            }
        }
    }
}

mock_graphql_response_owner_not_activated: dict[str, Any] = {
    "data": {
        "owner": {
            "repository": {
                "__typename": "OwnerNotActivatedError",
                "message": "Owner not activated",
            }
        }
    }
}

mock_graphql_response_no_repository: dict[str, Any] = {"data": {"owner": {"repository": None}}}


class RepositoryEndpointTest(APITestCase):
    endpoint_name = "sentry-api-0-repository"

    def setUp(self) -> None:
        super().setUp()
        self.organization = self.create_organization(owner=self.user)
        self.integration = self.create_integration(
            organization=self.organization,
            external_id="1234",
            name="testowner",
            provider="github",
            status=ObjectStatus.ACTIVE,
        )
        self.login_as(user=self.user)

    def reverse_url(self, owner="testowner", repository="testrepo"):
        """Custom reverse URL method to handle required URL parameters"""
        return reverse(
            self.endpoint_name,
            kwargs={
                "organization_id_or_slug": self.organization.slug,
                "owner": self.integration.id,
                "repository": repository,
            },
        )

    @patch("sentry.codecov.endpoints.repository.repository.CodecovApiClient")
    def test_get_returns_successful_repository_data(
        self, mock_codecov_client_class: MagicMock
    ) -> None:
        mock_codecov_client_instance = Mock()
        mock_response = Mock()
        mock_response.json.return_value = mock_graphql_response_success
        mock_codecov_client_instance.query.return_value = mock_response
        mock_codecov_client_class.return_value = mock_codecov_client_instance

        url = self.reverse_url()
        response = self.client.get(url)

        mock_codecov_client_class.assert_called_once_with(git_provider_org="testowner")

        expected_variables = {
            "owner": "testowner",
            "repo": "testrepo",
        }

        mock_codecov_client_instance.query.assert_called_once()
        call_args = mock_codecov_client_instance.query.call_args
        assert call_args[1]["variables"] == expected_variables

        assert response.status_code == 200
        assert response.data["uploadToken"] == "token123"
        assert response.data["testAnalyticsEnabled"] is True

        serializer_fields = set(RepositorySerializer().fields.keys())
        response_keys = set(response.data.keys())
        assert response_keys == serializer_fields

    @patch("sentry.codecov.endpoints.repository.repository.CodecovApiClient")
    def test_get_repository_not_found_error(self, mock_codecov_client_class: MagicMock) -> None:
        mock_codecov_client_instance = Mock()
        mock_response = Mock()
        mock_response.json.return_value = mock_graphql_response_not_found
        mock_codecov_client_instance.query.return_value = mock_response
        mock_codecov_client_class.return_value = mock_codecov_client_instance

        url = self.reverse_url()
        response = self.client.get(url)

        assert response.status_code == 404
        assert response.data == {"details": "Repository not found"}

    @patch("sentry.codecov.endpoints.repository.repository.CodecovApiClient")
    def test_get_owner_not_activated_error(self, mock_codecov_client_class: MagicMock) -> None:
        mock_codecov_client_instance = Mock()
        mock_response = Mock()
        mock_response.json.return_value = mock_graphql_response_owner_not_activated
        mock_codecov_client_instance.query.return_value = mock_response
        mock_codecov_client_class.return_value = mock_codecov_client_instance

        url = self.reverse_url()
        response = self.client.get(url)

        assert response.status_code == 404
        assert response.data == {"details": "Owner not activated"}

    @patch("sentry.codecov.endpoints.repository.repository.CodecovApiClient")
    def test_get_repository_none_returns_not_found(
        self, mock_codecov_client_class: MagicMock
    ) -> None:
        mock_codecov_client_instance = Mock()
        mock_response = Mock()
        mock_response.json.return_value = mock_graphql_response_no_repository
        mock_codecov_client_instance.query.return_value = mock_response
        mock_codecov_client_class.return_value = mock_codecov_client_instance

        url = self.reverse_url()
        response = self.client.get(url)

        assert response.status_code == 404
        assert response.data == {"details": "Repository 'testrepo' not found"}

    def test_user_not_in_org_denied(self) -> None:
        other_user = self.create_user(email="other@example.com")
        self.login_as(other_user)
        url = self.reverse_url()
        response = self.client.get(url)
        assert response.status_code == 403

    def test_integration_not_in_org_denied(self) -> None:
        # Creating a different organization and integration
        other_org = self.create_organization(owner=self.user)
        other_integration = self.create_integration(
            organization=other_org,
            external_id="5678",
            name="otherowner",
            provider="github",
            status=ObjectStatus.ACTIVE,
        )

        url = reverse(
            self.endpoint_name,
            kwargs={
                "organization_id_or_slug": self.organization.slug,
                "owner": other_integration.id,
                "repository": "testrepo",
            },
        )
        response = self.client.get(url)
        assert response.status_code == 404

    def test_invalid_owner_id_returns_not_found(self) -> None:
        url = reverse(
            self.endpoint_name,
            kwargs={
                "organization_id_or_slug": self.organization.slug,
                "owner": "non-numeric-value",
                "repository": "testrepo",
            },
        )
        response = self.client.get(url)
        assert response.status_code == 404
