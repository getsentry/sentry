from typing import int
from unittest.mock import patch

from django.urls import reverse

from sentry.testutils.cases import APITestCase


class FrontendVersionTest(APITestCase):
    def test_returns_frontend_commit_sha(self) -> None:
        url = reverse("sentry-api-0-internal-frontend-version")

        with patch("sentry.api.endpoints.frontend_version.get_frontend_commit_sha") as mock_get_sha:
            mock_get_sha.return_value = "abc123def456"

            response = self.client.get(url)

            assert response.status_code == 200
            assert response.data == {"version": "abc123def456"}
            mock_get_sha.assert_called_once()

    def test_returns_none_when_no_commit_sha(self) -> None:
        url = reverse("sentry-api-0-internal-frontend-version")

        with patch("sentry.api.endpoints.frontend_version.get_frontend_commit_sha") as mock_get_sha:
            mock_get_sha.return_value = None

            response = self.client.get(url)

            assert response.status_code == 200
            assert response.data == {"version": None}
            mock_get_sha.assert_called_once()
