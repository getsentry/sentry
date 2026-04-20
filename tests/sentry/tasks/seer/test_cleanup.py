from __future__ import annotations

from unittest.mock import MagicMock, patch

import pytest

from sentry.models.options.project_option import ProjectOption
from sentry.seer.models import SeerApiError
from sentry.seer.models.project_repository import SeerProjectRepository
from sentry.seer.models.seer_api_models import (
    AutofixHandoffPoint,
    SeerAutomationHandoffConfiguration,
    SeerProjectPreference,
)
from sentry.tasks.seer.cleanup import (
    bulk_cleanup_seer_repository_preferences,
    cleanup_seer_automation_handoff_for_integration,
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

    def _mock_preference(self, project, integration_id: int | None) -> SeerProjectPreference:
        handoff = (
            SeerAutomationHandoffConfiguration(
                handoff_point=AutofixHandoffPoint.ROOT_CAUSE,
                target="cursor_background_agent",
                integration_id=integration_id,
            )
            if integration_id is not None
            else None
        )
        return SeerProjectPreference(
            organization_id=project.organization_id,
            project_id=project.id,
            repositories=[],
            automation_handoff=handoff,
        )

    def _assert_handoff_options_count(self, project, count) -> None:
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

    @patch("sentry.tasks.seer.cleanup.bulk_set_project_preferences")
    @patch("sentry.tasks.seer.cleanup.bulk_read_preferences")
    def test_no_affected_projects_returns_early(
        self, mock_read: MagicMock, mock_set: MagicMock
    ) -> None:
        for read_from_sentry in (True, False):
            with self.subTest(read_from_sentry=read_from_sentry):
                mock_read.reset_mock()
                mock_set.reset_mock()
                mock_read.return_value = {self.project.id: None}

                with self.feature(
                    {"organizations:seer-project-settings-read-from-sentry": read_from_sentry}
                ):
                    cleanup_seer_automation_handoff_for_integration(
                        organization_id=self.organization.id,
                        integration_id=self.integration_id,
                    )

                mock_set.assert_not_called()

    @patch("sentry.tasks.seer.cleanup.bulk_set_project_preferences")
    @patch("sentry.tasks.seer.cleanup.bulk_read_preferences")
    def test_clears_handoff(self, mock_read: MagicMock, mock_set: MagicMock) -> None:
        for read_from_sentry in (True, False):
            with self.subTest(read_from_sentry=read_from_sentry):
                mock_read.reset_mock()
                mock_set.reset_mock()
                self._mock_handoff_options(self.project, self.integration_id)
                mock_read.return_value = {
                    self.project.id: self._mock_preference(self.project, self.integration_id),
                }

                with self.feature(
                    {
                        "organizations:seer-project-settings-read-from-sentry": read_from_sentry,
                        "organizations:seer-project-settings-dual-write": True,
                    }
                ):
                    cleanup_seer_automation_handoff_for_integration(
                        organization_id=self.organization.id,
                        integration_id=self.integration_id,
                    )

                mock_set.assert_called_once()
                updated_org_id, updated_preferences = mock_set.call_args[0]
                assert updated_org_id == self.organization.id
                assert len(updated_preferences) == 1
                assert updated_preferences[0]["project_id"] == self.project.id
                assert updated_preferences[0]["automation_handoff"] is None
                self._assert_handoff_options_count(self.project, 0)

    @patch("sentry.tasks.seer.cleanup.bulk_set_project_preferences")
    @patch("sentry.tasks.seer.cleanup.bulk_read_preferences")
    def test_only_affects_preferences_with_this_integration(
        self, mock_read: MagicMock, mock_set: MagicMock
    ) -> None:
        other_project = self.create_project(organization=self.organization)
        for read_from_sentry in (True, False):
            with self.subTest(read_from_sentry=read_from_sentry):
                mock_read.reset_mock()
                mock_set.reset_mock()
                self._mock_handoff_options(self.project, self.integration_id)
                self._mock_handoff_options(other_project, 999)
                mock_read.return_value = {
                    self.project.id: self._mock_preference(self.project, self.integration_id),
                    other_project.id: self._mock_preference(other_project, 999),
                }

                with self.feature(
                    {
                        "organizations:seer-project-settings-read-from-sentry": read_from_sentry,
                        "organizations:seer-project-settings-dual-write": True,
                    }
                ):
                    cleanup_seer_automation_handoff_for_integration(
                        organization_id=self.organization.id,
                        integration_id=self.integration_id,
                    )

                updated_preferences = mock_set.call_args[0][1]
                assert len(updated_preferences) == 1
                assert updated_preferences[0]["project_id"] == self.project.id
                self._assert_handoff_options_count(self.project, 0)
                self._assert_handoff_options_count(other_project, 4)

    @patch("sentry.tasks.seer.cleanup.bulk_set_project_preferences")
    @patch("sentry.tasks.seer.cleanup.bulk_read_preferences")
    def test_only_affects_projects_in_this_organization(
        self, mock_read: MagicMock, mock_set: MagicMock
    ) -> None:
        other_org = self.create_organization()
        other_org_project = self.create_project(organization=other_org)
        for read_from_sentry in (True, False):
            with self.subTest(read_from_sentry=read_from_sentry):
                mock_read.reset_mock()
                mock_set.reset_mock()
                self._mock_handoff_options(self.project, self.integration_id)
                self._mock_handoff_options(other_org_project, self.integration_id)
                mock_read.return_value = {
                    self.project.id: self._mock_preference(self.project, self.integration_id),
                }

                with self.feature(
                    {
                        "organizations:seer-project-settings-read-from-sentry": read_from_sentry,
                        "organizations:seer-project-settings-dual-write": True,
                    }
                ):
                    cleanup_seer_automation_handoff_for_integration(
                        organization_id=self.organization.id,
                        integration_id=self.integration_id,
                    )

                updated_preferences = mock_set.call_args[0][1]
                assert len(updated_preferences) == 1
                assert updated_preferences[0]["project_id"] == self.project.id
                self._assert_handoff_options_count(self.project, 0)
                self._assert_handoff_options_count(other_org_project, 4)

    @patch("sentry.tasks.seer.cleanup.bulk_set_project_preferences")
    @patch("sentry.tasks.seer.cleanup.bulk_read_preferences")
    def test_skips_projects_with_none_preference(
        self, mock_read: MagicMock, mock_set: MagicMock
    ) -> None:
        project_with_pref = self.create_project(organization=self.organization)
        mock_read.return_value = {
            self.project.id: None,
            project_with_pref.id: self._mock_preference(project_with_pref, self.integration_id),
        }

        with self.feature({"organizations:seer-project-settings-dual-write": True}):
            cleanup_seer_automation_handoff_for_integration(
                organization_id=self.organization.id,
                integration_id=self.integration_id,
            )

        updated_preferences = mock_set.call_args[0][1]
        assert len(updated_preferences) == 1
        assert updated_preferences[0]["project_id"] == project_with_pref.id

    @with_feature(["organizations:seer-project-settings-dual-write"])
    @patch("sentry.tasks.seer.cleanup.bulk_set_project_preferences")
    @patch("sentry.tasks.seer.cleanup.bulk_read_preferences")
    def test_seer_read_failure_raises_and_leaves_options(
        self, mock_read: MagicMock, mock_set: MagicMock
    ) -> None:
        self._mock_handoff_options(self.project, self.integration_id)
        mock_read.side_effect = SeerApiError("error", 500)

        with pytest.raises(SeerApiError):
            cleanup_seer_automation_handoff_for_integration(
                organization_id=self.organization.id,
                integration_id=self.integration_id,
            )

        mock_set.assert_not_called()
        self._assert_handoff_options_count(self.project, 4)

    @with_feature(["organizations:seer-project-settings-dual-write"])
    @patch("sentry.tasks.seer.cleanup.bulk_set_project_preferences")
    @patch("sentry.tasks.seer.cleanup.bulk_read_preferences")
    def test_seer_api_set_failure_raises_and_leaves_options(
        self, mock_read: MagicMock, mock_set: MagicMock
    ) -> None:
        self._mock_handoff_options(self.project, self.integration_id)
        mock_read.return_value = {
            self.project.id: self._mock_preference(self.project, self.integration_id),
        }
        mock_set.side_effect = SeerApiError("error", 500)

        with pytest.raises(SeerApiError):
            cleanup_seer_automation_handoff_for_integration(
                organization_id=self.organization.id,
                integration_id=self.integration_id,
            )

        self._assert_handoff_options_count(self.project, 4)
