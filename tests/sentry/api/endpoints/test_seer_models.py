from unittest.mock import MagicMock, patch

import requests
from django.conf import settings
from rest_framework import status

from sentry.seer.signed_seer_api import sign_with_seer_secret
from sentry.testutils.cases import APITestCase


class TestSeerModels(APITestCase):
    endpoint = "sentry-api-0-seer-models"

    def setUp(self) -> None:
        super().setUp()
        self.url = "/api/0/seer/models/"

    @patch("sentry.api.endpoints.seer_models.requests.get")
    def test_get_models_successful(self, mock_get: MagicMock) -> None:
        """Test successful retrieval of models from Seer."""
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.json.return_value = {
            "models": ["gpt-4", "claude-3", "gemini-pro"],
        }
        mock_get.return_value = mock_response

        response = self.client.get(self.url)

        assert response.status_code == status.HTTP_200_OK
        assert response.data == {"models": ["gpt-4", "claude-3", "gemini-pro"]}

        expected_url = f"{settings.SEER_AUTOFIX_URL}/v1/models"
        expected_headers = {
            "content-type": "application/json;charset=utf-8",
            **sign_with_seer_secret(b""),
        }
        mock_get.assert_called_once_with(
            expected_url,
            headers=expected_headers,
            timeout=5,
        )

    @patch("sentry.api.endpoints.seer_models.requests.get")
    def test_get_models_no_authentication_required(self, mock_get: MagicMock) -> None:
        """Test that the endpoint works without authentication."""
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.json.return_value = {"models": ["gpt-4"]}
        mock_get.return_value = mock_response

        response = self.client.get(self.url)

        assert response.status_code == status.HTTP_200_OK

    @patch("sentry.api.endpoints.seer_models.requests.get")
    def test_get_models_timeout(self, mock_get: MagicMock) -> None:
        """Test handling of timeout errors."""
        mock_get.side_effect = requests.exceptions.Timeout("Request timed out")

        response = self.client.get(self.url)

        assert response.status_code == status.HTTP_504_GATEWAY_TIMEOUT
        assert response.data == {"detail": "Request to Seer timed out"}

    @patch("sentry.api.endpoints.seer_models.requests.get")
    def test_get_models_request_exception(self, mock_get: MagicMock) -> None:
        """Test handling of request exceptions."""
        mock_get.side_effect = requests.exceptions.RequestException("Connection error")

        response = self.client.get(self.url)

        assert response.status_code == status.HTTP_502_BAD_GATEWAY
        assert response.data == {"detail": "Failed to fetch models from Seer"}

    @patch("sentry.api.endpoints.seer_models.requests.get")
    def test_get_models_http_error(self, mock_get: MagicMock) -> None:
        """Test handling of HTTP errors from Seer."""
        mock_response = MagicMock()
        mock_response.status_code = 500
        mock_response.raise_for_status.side_effect = requests.exceptions.HTTPError("Server error")
        mock_get.return_value = mock_response

        response = self.client.get(self.url)

        assert response.status_code == status.HTTP_502_BAD_GATEWAY
        assert response.data == {"detail": "Failed to fetch models from Seer"}

    @patch("sentry.api.endpoints.seer_models.requests.get")
    def test_get_models_empty_response(self, mock_get: MagicMock) -> None:
        """Test handling of empty models list."""
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.json.return_value = {"models": []}
        mock_get.return_value = mock_response

        response = self.client.get(self.url)

        assert response.status_code == status.HTTP_200_OK
        assert response.data == {"models": []}
