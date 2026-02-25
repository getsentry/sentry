from __future__ import annotations

from unittest.mock import MagicMock, patch

import orjson
import pytest

from sentry.seer.models import SeerApiError
from sentry.tasks.seer import cleanup_seer_repository_preferences
from sentry.testutils.cases import TestCase


class TestSeerRepositoryCleanup(TestCase):
    def setUp(self) -> None:
        self.organization = self.create_organization()
        self.project = self.create_project(organization=self.organization)
        self.repo_external_id = "12345"
        self.repo_provider = "github"

    @patch("sentry.tasks.seer.make_signed_seer_api_request")
    def test_cleanup_seer_repository_preferences_success(self, mock_request: MagicMock) -> None:
        """Test successful cleanup of Seer repository preferences."""
        mock_request.return_value.status = 200

        cleanup_seer_repository_preferences(
            organization_id=self.organization.id,
            repo_external_id=self.repo_external_id,
            repo_provider=self.repo_provider,
        )

        mock_request.assert_called_once()
        body = orjson.loads(mock_request.call_args[0][2])
        assert body == {
            "organization_id": self.organization.id,
            "repo_provider": self.repo_provider,
            "repo_external_id": self.repo_external_id,
        }

    @patch("sentry.tasks.seer.make_signed_seer_api_request")
    def test_cleanup_seer_repository_preferences_api_error(self, mock_request: MagicMock) -> None:
        """Test handling of Seer API errors."""
        mock_request.return_value.status = 500

        with pytest.raises(SeerApiError):
            cleanup_seer_repository_preferences(
                organization_id=self.organization.id,
                repo_external_id=self.repo_external_id,
                repo_provider=self.repo_provider,
            )

    @patch("sentry.tasks.seer.make_signed_seer_api_request")
    def test_cleanup_seer_repository_preferences_organization_not_found(
        self, mock_request: MagicMock
    ) -> None:
        """Test handling when organization doesn't exist."""
        mock_request.return_value.status = 200

        nonexistent_organization_id = 99999

        cleanup_seer_repository_preferences(
            organization_id=nonexistent_organization_id,
            repo_external_id=self.repo_external_id,
            repo_provider=self.repo_provider,
        )

        mock_request.assert_called_once()
        body = orjson.loads(mock_request.call_args[0][2])
        assert body == {
            "organization_id": nonexistent_organization_id,
            "repo_provider": self.repo_provider,
            "repo_external_id": self.repo_external_id,
        }
