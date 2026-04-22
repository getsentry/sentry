from __future__ import annotations

from unittest.mock import MagicMock, patch

import pytest

from sentry.models.options.project_option import ProjectOption
from sentry.seer.models import SeerApiError
from sentry.seer.models.project_repository import SeerProjectRepository
from sentry.tasks.seer.cleanup import (
    bulk_cleanup_seer_repository_preferences,
    cleanup_seer_automation_handoffs_for_integration,
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


class TestCleanupSeerAutomationHandoffForIntegration(TestCase):
    def setUp(self) -> None:
        self.organization = self.create_organization()
        self.project = self.create_project(organization=self.organization)
        self.integration_id = 42

    def _mock_handoff_options(self, project, integration_id: int) -> None:
        project.update_option("sentry:seer_automation_handoff_point", "root_cause")
        project.update_option("sentry:seer_automation_handoff_target", "cursor_background_agent")
        project.update_option("sentry:seer_automation_handoff_integration_id", integration_id)
        project.update_option("sentry:seer_automation_handoff_auto_create_pr", True)

    def _assert_handoff_options_count(self, project, count: int) -> None:
        assert (
            ProjectOption.objects.filter(
                project_id=project.id,
                key__in={
                    "sentry:seer_automation_handoff_integration_id",
                    "sentry:seer_automation_handoff_point",
                    "sentry:seer_automation_handoff_target",
                    "sentry:seer_automation_handoff_auto_create_pr",
                },
            ).count()
            == count
        )

    @with_feature("organizations:seer-project-settings-dual-write")
    @patch("sentry.tasks.seer.cleanup.make_remove_handoffs_for_integration_request")
    def test_clears_handoff(self, mock_request: MagicMock) -> None:
        mock_request.return_value.status = 200
        self._mock_handoff_options(self.project, self.integration_id)

        cleanup_seer_automation_handoffs_for_integration(
            organization_id=self.organization.id,
            integration_id=self.integration_id,
        )

        mock_request.assert_called_once()
        body = mock_request.call_args[0][0]
        assert body == {
            "organization_id": self.organization.id,
            "integration_id": self.integration_id,
        }
        self._assert_handoff_options_count(self.project, 0)

    @with_feature("organizations:seer-project-settings-dual-write")
    @patch("sentry.tasks.seer.cleanup.make_remove_handoffs_for_integration_request")
    def test_clears_options_for_matching_integration(self, mock_request: MagicMock) -> None:
        mock_request.return_value.status = 200
        other_project = self.create_project(organization=self.organization)
        self._mock_handoff_options(self.project, self.integration_id)
        self._mock_handoff_options(other_project, 999)

        cleanup_seer_automation_handoffs_for_integration(
            organization_id=self.organization.id,
            integration_id=self.integration_id,
        )

        self._assert_handoff_options_count(self.project, 0)
        self._assert_handoff_options_count(other_project, 4)

    @with_feature("organizations:seer-project-settings-dual-write")
    @patch("sentry.tasks.seer.cleanup.make_remove_handoffs_for_integration_request")
    def test_clears_options_in_matching_organization(self, mock_request: MagicMock) -> None:
        mock_request.return_value.status = 200
        other_org = self.create_organization()
        other_org_project = self.create_project(organization=other_org)
        self._mock_handoff_options(self.project, self.integration_id)
        self._mock_handoff_options(other_org_project, self.integration_id)

        cleanup_seer_automation_handoffs_for_integration(
            organization_id=self.organization.id,
            integration_id=self.integration_id,
        )

        self._assert_handoff_options_count(self.project, 0)
        self._assert_handoff_options_count(other_org_project, 4)

    @with_feature("organizations:seer-project-settings-dual-write")
    @patch("sentry.tasks.seer.cleanup.make_remove_handoffs_for_integration_request")
    def test_seer_failure_raises_and_skips_clearing_options(self, mock_request: MagicMock) -> None:
        mock_request.return_value.status = 500
        self._mock_handoff_options(self.project, self.integration_id)

        with pytest.raises(SeerApiError):
            cleanup_seer_automation_handoffs_for_integration(
                organization_id=self.organization.id,
                integration_id=self.integration_id,
            )

        self._assert_handoff_options_count(self.project, 4)

    @patch("sentry.tasks.seer.cleanup.make_remove_handoffs_for_integration_request")
    def test_organization_not_found_skips_clearing_options(self, mock_request: MagicMock) -> None:
        mock_request.return_value.status = 200

        cleanup_seer_automation_handoffs_for_integration(
            organization_id=99999,
            integration_id=self.integration_id,
        )

        mock_request.assert_called_once()
