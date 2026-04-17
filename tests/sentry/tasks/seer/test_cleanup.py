from __future__ import annotations

from unittest.mock import MagicMock, patch

import pytest

from sentry.models.options.project_option import ProjectOption
from sentry.seer.models import SeerApiError
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


class TestCleanupSeerAutomationHandoffForIntegration(TestCase):
    def setUp(self) -> None:
        self.organization = self.create_organization()
        self.project = self.create_project(organization=self.organization)
        self.integration_id = 42

    def _mock_db_preference(self, project, integration_id: int) -> None:
        project.update_option("sentry:seer_automation_handoff_point", "root_cause")
        project.update_option("sentry:seer_automation_handoff_target", "cursor_background_agent")
        project.update_option("sentry:seer_automation_handoff_integration_id", integration_id)
        project.update_option("sentry:seer_automation_handoff_auto_create_pr", True)

    def _mock_api_preference(self, project, integration_id: int | None) -> SeerProjectPreference:
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

    def _assert_handoff_options_count(self, project, count) -> int:
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
        cleanup_seer_automation_handoff_for_integration(
            organization_id=self.organization.id,
            integration_id=self.integration_id,
        )

        mock_read.assert_not_called()
        mock_set.assert_not_called()

    @with_feature("organizations:seer-project-settings-dual-write")
    @patch("sentry.tasks.seer.cleanup.bulk_set_project_preferences")
    @patch("sentry.tasks.seer.cleanup.bulk_read_preferences")
    def test_clears_and_pushes_to_seer_with_dual_write(
        self, mock_read: MagicMock, mock_set: MagicMock
    ) -> None:
        self._mock_db_preference(self.project, self.integration_id)
        mock_read.return_value = {
            self.project.id: self._mock_api_preference(self.project, self.integration_id)
        }

        cleanup_seer_automation_handoff_for_integration(
            organization_id=self.organization.id,
            integration_id=self.integration_id,
        )

        mock_set.assert_called_once()
        pushed_org_id, pushed_preferences = mock_set.call_args[0]
        assert pushed_org_id == self.organization.id
        assert len(pushed_preferences) == 1
        assert pushed_preferences[0]["automation_handoff"] is None
        self._assert_handoff_options_count(self.project, 0)

    @patch("sentry.tasks.seer.cleanup.bulk_set_project_preferences")
    @patch("sentry.tasks.seer.cleanup.bulk_read_preferences")
    def test_pushes_to_seer_but_leaves_options_without_dual_write(
        self, mock_read: MagicMock, mock_set: MagicMock
    ) -> None:
        self._mock_db_preference(self.project, self.integration_id)
        mock_read.return_value = {
            self.project.id: self._mock_api_preference(self.project, self.integration_id)
        }

        cleanup_seer_automation_handoff_for_integration(
            organization_id=self.organization.id,
            integration_id=self.integration_id,
        )

        mock_set.assert_called_once()
        self._assert_handoff_options_count(self.project, 4)

    @with_feature("organizations:seer-project-settings-dual-write")
    @patch("sentry.tasks.seer.cleanup.bulk_set_project_preferences")
    @patch("sentry.tasks.seer.cleanup.bulk_read_preferences")
    def test_only_affects_projects_referencing_this_integration(
        self, mock_read: MagicMock, mock_set: MagicMock
    ) -> None:
        other_project = self.create_project(organization=self.organization)
        self._mock_db_preference(self.project, self.integration_id)
        self._mock_db_preference(other_project, 999)
        mock_read.return_value = {
            self.project.id: self._mock_api_preference(self.project, self.integration_id)
        }

        cleanup_seer_automation_handoff_for_integration(
            organization_id=self.organization.id,
            integration_id=self.integration_id,
        )

        _, project_ids_read = mock_read.call_args[0]
        assert project_ids_read == [self.project.id]
        self._assert_handoff_options_count(self.project, 0)
        self._assert_handoff_options_count(other_project, 4)

    @with_feature("organizations:seer-project-settings-dual-write")
    @patch("sentry.tasks.seer.cleanup.bulk_set_project_preferences")
    @patch("sentry.tasks.seer.cleanup.bulk_read_preferences")
    def test_only_affects_projects_in_this_organization(
        self, mock_read: MagicMock, mock_set: MagicMock
    ) -> None:
        other_organization = self.create_organization()
        other_org_project = self.create_project(organization=other_organization)
        self._mock_db_preference(self.project, self.integration_id)
        self._mock_db_preference(other_org_project, self.integration_id)
        mock_read.return_value = {
            self.project.id: self._mock_api_preference(self.project, self.integration_id)
        }

        cleanup_seer_automation_handoff_for_integration(
            organization_id=self.organization.id,
            integration_id=self.integration_id,
        )

        _, project_ids_read = mock_read.call_args[0]
        assert project_ids_read == [self.project.id]
        self._assert_handoff_options_count(self.project, 0)
        self._assert_handoff_options_count(other_org_project, 4)

    @with_feature("organizations:seer-project-settings-dual-write")
    @patch("sentry.tasks.seer.cleanup.bulk_set_project_preferences")
    @patch("sentry.tasks.seer.cleanup.bulk_read_preferences")
    def test_skips_projects_with_none_preference(
        self, mock_read: MagicMock, mock_set: MagicMock
    ) -> None:
        project_with_pref = self.create_project(organization=self.organization)
        self._mock_db_preference(self.project, self.integration_id)
        self._mock_db_preference(project_with_pref, self.integration_id)
        mock_read.return_value = {
            self.project.id: None,
            project_with_pref.id: self._mock_api_preference(project_with_pref, self.integration_id),
        }

        cleanup_seer_automation_handoff_for_integration(
            organization_id=self.organization.id,
            integration_id=self.integration_id,
        )

        pushed_preferences = mock_set.call_args[0][1]
        assert len(pushed_preferences) == 1
        assert pushed_preferences[0]["project_id"] == project_with_pref.id

    @with_feature("organizations:seer-project-settings-dual-write")
    @patch("sentry.tasks.seer.cleanup.bulk_set_project_preferences")
    @patch("sentry.tasks.seer.cleanup.bulk_read_preferences")
    def test_seer_read_failure_raises_and_leaves_options(
        self, mock_read: MagicMock, mock_set: MagicMock
    ) -> None:
        self._mock_db_preference(self.project, self.integration_id)
        mock_read.side_effect = SeerApiError("boom", 500)

        with pytest.raises(SeerApiError):
            cleanup_seer_automation_handoff_for_integration(
                organization_id=self.organization.id,
                integration_id=self.integration_id,
            )

        mock_set.assert_not_called()
        self._assert_handoff_options_count(self.project, 4)

    @with_feature("organizations:seer-project-settings-dual-write")
    @patch("sentry.tasks.seer.cleanup.bulk_set_project_preferences")
    @patch("sentry.tasks.seer.cleanup.bulk_read_preferences")
    def test_seer_write_failure_raises_and_leaves_options(
        self, mock_read: MagicMock, mock_set: MagicMock
    ) -> None:
        self._mock_db_preference(self.project, self.integration_id)
        mock_read.return_value = {
            self.project.id: self._mock_api_preference(self.project, self.integration_id)
        }
        mock_set.side_effect = SeerApiError("boom", 500)

        with pytest.raises(SeerApiError):
            cleanup_seer_automation_handoff_for_integration(
                organization_id=self.organization.id,
                integration_id=self.integration_id,
            )

        self._assert_handoff_options_count(self.project, 4)
