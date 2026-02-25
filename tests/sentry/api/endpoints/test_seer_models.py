from unittest.mock import MagicMock, patch

from rest_framework import status

from sentry.seer.models import SeerApiError
from sentry.testutils.cases import APITestCase


class TestSeerModels(APITestCase):
    endpoint = "sentry-api-0-seer-models"

    def setUp(self) -> None:
        super().setUp()
        self.url = "/api/0/seer/models/"

    @patch("sentry.api.endpoints.seer_models.make_signed_seer_api_request")
    def test_get_models_successful(self, mock_request: MagicMock) -> None:
        """Test successful retrieval of models from Seer."""
        mock_request.return_value.status = 200
        mock_request.return_value.json.return_value = {
            "models": ["gpt-4", "claude-3", "gemini-pro"],
        }

        response = self.client.get(self.url)

        assert response.status_code == status.HTTP_200_OK
        assert response.data == {"models": ["gpt-4", "claude-3", "gemini-pro"]}
        mock_request.assert_called_once()

    @patch("sentry.api.endpoints.seer_models.make_signed_seer_api_request")
    def test_get_models_no_authentication_required(self, mock_request: MagicMock) -> None:
        """Test that the endpoint works without authentication."""
        mock_request.return_value.status = 200
        mock_request.return_value.json.return_value = {"models": ["gpt-4"]}

        response = self.client.get(self.url)

        assert response.status_code == status.HTTP_200_OK

    @patch("sentry.api.endpoints.seer_models.make_signed_seer_api_request")
    def test_get_models_timeout(self, mock_request: MagicMock) -> None:
        """Test handling of timeout errors."""
        mock_request.side_effect = TimeoutError("Request timed out")

        response = self.client.get(self.url)

        assert response.status_code == status.HTTP_504_GATEWAY_TIMEOUT
        assert response.data == {"detail": "Request to Seer timed out"}

    @patch("sentry.api.endpoints.seer_models.make_signed_seer_api_request")
    def test_get_models_request_exception(self, mock_request: MagicMock) -> None:
        """Test handling of request exceptions."""
        mock_request.side_effect = SeerApiError("Connection error", 500)

        response = self.client.get(self.url)

        assert response.status_code == status.HTTP_502_BAD_GATEWAY
        assert response.data == {"detail": "Failed to fetch models from Seer"}

    @patch("sentry.api.endpoints.seer_models.make_signed_seer_api_request")
    def test_get_models_http_error(self, mock_request: MagicMock) -> None:
        """Test handling of HTTP errors from Seer."""
        mock_request.return_value.status = 500

        response = self.client.get(self.url)

        assert response.status_code == status.HTTP_502_BAD_GATEWAY
        assert response.data == {"detail": "Failed to fetch models from Seer"}

    @patch("sentry.api.endpoints.seer_models.make_signed_seer_api_request")
    def test_get_models_empty_response(self, mock_request: MagicMock) -> None:
        """Test handling of empty models list."""
        mock_request.return_value.status = 200
        mock_request.return_value.json.return_value = {"models": []}

        response = self.client.get(self.url)

        assert response.status_code == status.HTTP_200_OK
        assert response.data == {"models": []}
