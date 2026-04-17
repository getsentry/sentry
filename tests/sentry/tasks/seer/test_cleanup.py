from __future__ import annotations

from unittest.mock import MagicMock, patch

import pytest

from sentry.seer.models import SeerApiError
from sentry.seer.models.project_repository import SeerProjectRepository
from sentry.tasks.seer.cleanup import (
    bulk_cleanup_seer_repository_preferences,
    cleanup_seer_repository_preferences,
)
from sentry.testutils.cases import TestCase
from sentry.testutils.helpers.features import with_feature


class TestSeerRepositoryCleanup(TestCase):
    def setUp(self) -> None:
        self.organization = self.create_organization()
        self.project = self.create_project(organization=self.organization)
        self.repo = self.create_repo(project=self.project, provider="github", external_id="12345")

    @with_feature("organizations:seer-project-settings-dual-write")
    @patch("sentry.tasks.seer.cleanup.make_remove_repository_request")
    def test_cleanup_seer_repository_preferences_success(self, mock_request: MagicMock) -> None:
        """Test successful cleanup of Seer repository preferences."""
        mock_request.return_value.status = 200
        SeerProjectRepository.objects.create(project=self.project, repository_id=self.repo.id)

        cleanup_seer_repository_preferences(
            organization_id=self.organization.id,
            repo_id=self.repo.id,
            repo_external_id=self.repo.external_id,
            repo_provider=self.repo.provider,
        )

        mock_request.assert_called_once()
        body = mock_request.call_args[0][0]
        assert body == {
            "organization_id": self.organization.id,
            "repo_provider": self.repo.provider,
            "repo_external_id": self.repo.external_id,
        }
        assert not SeerProjectRepository.objects.filter(repository_id=self.repo.id).exists()

    @with_feature("organizations:seer-project-settings-dual-write")
    @patch("sentry.tasks.seer.cleanup.make_remove_repository_request")
    def test_cleanup_seer_repository_preferences_api_error(self, mock_request: MagicMock) -> None:
        """Test handling of Seer API errors."""
        mock_request.return_value.status = 500
        SeerProjectRepository.objects.create(project=self.project, repository_id=self.repo.id)

        with pytest.raises(SeerApiError):
            cleanup_seer_repository_preferences(
                organization_id=self.organization.id,
                repo_id=self.repo.id,
                repo_external_id=self.repo.external_id,
                repo_provider=self.repo.provider,
            )

        assert SeerProjectRepository.objects.filter(repository_id=self.repo.id).exists()

    @patch("sentry.tasks.seer.cleanup.make_remove_repository_request")
    def test_cleanup_seer_repository_preferences_organization_not_found(
        self, mock_request: MagicMock
    ) -> None:
        """Test handling when organization doesn't exist."""
        mock_request.return_value.status = 200

        nonexistent_organization_id = 99999

        cleanup_seer_repository_preferences(
            organization_id=nonexistent_organization_id,
            repo_id=self.repo.id,
            repo_external_id=self.repo.external_id,
            repo_provider=self.repo.provider,
        )

        mock_request.assert_called_once()
        body = mock_request.call_args[0][0]
        assert body == {
            "organization_id": nonexistent_organization_id,
            "repo_provider": self.repo.provider,
            "repo_external_id": self.repo.external_id,
        }


class TestBulkSeerRepositoryCleanup(TestCase):
    def setUp(self) -> None:
        self.organization = self.create_organization()
        self.project = self.create_project(organization=self.organization)
        self.repo1 = self.create_repo(project=self.project, provider="github", external_id="123")
        self.repo2 = self.create_repo(project=self.project, provider="github", external_id="456")

    @with_feature("organizations:seer-project-settings-dual-write")
    @patch("sentry.tasks.seer.cleanup.make_bulk_remove_repositories_request")
    def test_bulk_cleanup_success(self, mock_request: MagicMock) -> None:
        """Test successful bulk cleanup of Seer repository preferences."""
        mock_request.return_value.status = 200
        SeerProjectRepository.objects.create(project=self.project, repository_id=self.repo1.id)
        SeerProjectRepository.objects.create(project=self.project, repository_id=self.repo2.id)

        bulk_cleanup_seer_repository_preferences(
            organization_id=self.organization.id,
            repos=[
                {
                    "repo_id": self.repo1.id,
                    "repo_external_id": self.repo1.external_id,
                    "repo_provider": self.repo1.provider,
                },
                {
                    "repo_id": self.repo2.id,
                    "repo_external_id": self.repo2.external_id,
                    "repo_provider": self.repo2.provider,
                },
            ],
        )

        mock_request.assert_called_once()
        body = mock_request.call_args[0][0]
        assert body["organization_id"] == self.organization.id
        assert len(body["repositories"]) == 2
        assert body["repositories"][0] == {"repo_provider": "github", "repo_external_id": "123"}
        assert body["repositories"][1] == {"repo_provider": "github", "repo_external_id": "456"}
        assert not SeerProjectRepository.objects.filter(
            repository_id__in=[self.repo1.id, self.repo2.id]
        ).exists()

    @with_feature("organizations:seer-project-settings-dual-write")
    @patch("sentry.tasks.seer.cleanup.make_bulk_remove_repositories_request")
    def test_bulk_cleanup_api_error(self, mock_request: MagicMock) -> None:
        """Test handling of Seer API errors."""
        mock_request.return_value.status = 500
        SeerProjectRepository.objects.create(project=self.project, repository_id=self.repo1.id)
        SeerProjectRepository.objects.create(project=self.project, repository_id=self.repo2.id)

        with pytest.raises(SeerApiError):
            bulk_cleanup_seer_repository_preferences(
                organization_id=self.organization.id,
                repos=[
                    {
                        "repo_id": self.repo1.id,
                        "repo_external_id": self.repo1.external_id,
                        "repo_provider": self.repo1.provider,
                    },
                    {
                        "repo_id": self.repo2.id,
                        "repo_external_id": self.repo2.external_id,
                        "repo_provider": self.repo2.provider,
                    },
                ],
            )

        assert (
            SeerProjectRepository.objects.filter(
                repository_id__in=[self.repo1.id, self.repo2.id]
            ).count()
            == 2
        )
