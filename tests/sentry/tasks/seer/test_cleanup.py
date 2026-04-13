from __future__ import annotations

from unittest.mock import MagicMock, patch

import pytest

from sentry.seer.models import SeerApiError
from sentry.tasks.seer.cleanup import (
    bulk_cleanup_seer_repository_preferences,
    cleanup_seer_repository_preferences,
)
from sentry.testutils.cases import TestCase


class TestSeerRepositoryCleanup(TestCase):
    def setUp(self) -> None:
        self.organization = self.create_organization()
        self.project = self.create_project(organization=self.organization)
        self.repo_external_id = "12345"
        self.repo_provider = "github"

    @patch("sentry.tasks.seer.cleanup.make_remove_repository_request")
    def test_cleanup_seer_repository_preferences_success(self, mock_request: MagicMock) -> None:
        """Test successful cleanup of Seer repository preferences."""
        mock_request.return_value.status = 200

        cleanup_seer_repository_preferences(
            organization_id=self.organization.id,
            repo_external_id=self.repo_external_id,
            repo_provider=self.repo_provider,
        )

        mock_request.assert_called_once()
        body = mock_request.call_args[0][0]
        assert body == {
            "organization_id": self.organization.id,
            "repo_provider": self.repo_provider,
            "repo_external_id": self.repo_external_id,
        }

    @patch("sentry.tasks.seer.cleanup.make_remove_repository_request")
    def test_cleanup_seer_repository_preferences_api_error(self, mock_request: MagicMock) -> None:
        """Test handling of Seer API errors."""
        mock_request.return_value.status = 500

        with pytest.raises(SeerApiError):
            cleanup_seer_repository_preferences(
                organization_id=self.organization.id,
                repo_external_id=self.repo_external_id,
                repo_provider=self.repo_provider,
            )

    @patch("sentry.tasks.seer.cleanup.make_remove_repository_request")
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
        body = mock_request.call_args[0][0]
        assert body == {
            "organization_id": nonexistent_organization_id,
            "repo_provider": self.repo_provider,
            "repo_external_id": self.repo_external_id,
        }


class TestBulkSeerRepositoryCleanup(TestCase):
    def setUp(self) -> None:
        self.organization = self.create_organization()
        self.repos = [
            {"repo_external_id": "123", "repo_provider": "github"},
            {"repo_external_id": "456", "repo_provider": "github"},
        ]

    @patch("sentry.tasks.seer.cleanup.make_bulk_remove_repositories_request")
    def test_bulk_cleanup_success(self, mock_request: MagicMock) -> None:
        """Test successful bulk cleanup of Seer repository preferences."""
        mock_request.return_value.status = 200

        bulk_cleanup_seer_repository_preferences(
            organization_id=self.organization.id,
            repos=self.repos,
        )

        mock_request.assert_called_once()
        body = mock_request.call_args[0][0]
        assert body["organization_id"] == self.organization.id
        assert len(body["repositories"]) == 2
        assert body["repositories"][0] == {"repo_provider": "github", "repo_external_id": "123"}
        assert body["repositories"][1] == {"repo_provider": "github", "repo_external_id": "456"}

    @patch("sentry.tasks.seer.cleanup.make_bulk_remove_repositories_request")
    def test_bulk_cleanup_api_error(self, mock_request: MagicMock) -> None:
        """Test handling of Seer API errors."""
        mock_request.return_value.status = 500

        with pytest.raises(SeerApiError):
            bulk_cleanup_seer_repository_preferences(
                organization_id=self.organization.id,
                repos=self.repos,
            )
