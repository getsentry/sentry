from __future__ import annotations

from unittest.mock import MagicMock, patch

import orjson
import pytest
import responses
from django.conf import settings

from sentry.constants import ObjectStatus
from sentry.integrations.services.repository import repository_service
from sentry.seer.signed_seer_api import sign_with_seer_secret
from sentry.tasks.seer import cleanup_seer_repository_preferences
from sentry.testutils.cases import TestCase


class TestSeerRepositoryCleanup(TestCase):
    def setUp(self) -> None:
        self.organization = self.create_organization()
        self.project = self.create_project(organization=self.organization)
        self.repo_external_id = "12345"
        self.repo_provider = "github"

    @responses.activate
    def test_cleanup_seer_repository_preferences_success(self) -> None:
        """Test successful cleanup of Seer repository preferences."""
        # Mock the Seer API response
        responses.add(
            responses.POST,
            f"{settings.SEER_AUTOFIX_URL}/v1/project-preference/remove-repository",
            status=200,
        )

        # Call the task
        cleanup_seer_repository_preferences(
            organization_id=self.organization.id,
            repo_external_id=self.repo_external_id,
            repo_provider=self.repo_provider,
        )

        # Verify the request was made with correct data
        assert len(responses.calls) == 1
        request = responses.calls[0].request

        expected_body = orjson.dumps(
            {
                "organization_id": self.organization.id,
                "repo_provider": self.repo_provider,
                "repo_external_id": self.repo_external_id,
            }
        )

        assert request.body == expected_body
        assert request.headers["content-type"] == "application/json;charset=utf-8"

        # Verify the request was signed
        expected_headers = sign_with_seer_secret(expected_body)
        for header_name, header_value in expected_headers.items():
            assert request.headers[header_name] == header_value

    @responses.activate
    def test_cleanup_seer_repository_preferences_api_error(self) -> None:
        """Test handling of Seer API errors."""
        # Mock the Seer API to return an error
        responses.add(
            responses.POST,
            f"{settings.SEER_AUTOFIX_URL}/v1/project-preference/remove-repository",
            status=500,
        )

        # Call the task and expect it to raise an exception
        with pytest.raises(Exception):
            cleanup_seer_repository_preferences(
                organization_id=self.organization.id,
                repo_external_id=self.repo_external_id,
                repo_provider=self.repo_provider,
            )

    @responses.activate
    def test_cleanup_seer_repository_preferences_organization_not_found(self) -> None:
        """Test handling when organization doesn't exist."""
        # Mock the Seer API response for non-existent organization
        responses.add(
            responses.POST,
            f"{settings.SEER_AUTOFIX_URL}/v1/project-preference/remove-repository",
            status=200,
        )

        # Use a non-existent organization ID
        nonexistent_organization_id = 99999

        # Call the task - it should still make the API call even if org doesn't exist locally
        cleanup_seer_repository_preferences(
            organization_id=nonexistent_organization_id,
            repo_external_id=self.repo_external_id,
            repo_provider=self.repo_provider,
        )

        # The API call should be made regardless of local organization existence
        assert len(responses.calls) == 1
        request = responses.calls[0].request

        expected_body = orjson.dumps(
            {
                "organization_id": nonexistent_organization_id,
                "repo_provider": self.repo_provider,
                "repo_external_id": self.repo_external_id,
            }
        )

        assert request.body == expected_body


class TestRepositoryServiceCleanup(TestCase):
    """Test that repository service triggers Seer cleanup when disabling repositories."""

    def setUp(self) -> None:
        self.organization = self.create_organization()
        self.integration = self.create_integration(
            organization=self.organization,
            provider="github",
            external_id="github-123",
        )

    @patch("sentry.tasks.seer.cleanup_seer_repository_preferences.apply_async")
    def test_disable_repositories_triggers_cleanup(self, mock_cleanup_task: MagicMock) -> None:
        """Test that disabling repositories for integration triggers cleanup task."""
        repo1 = self.create_repo(
            name="example/repo1",
            external_id="repo-1",
            provider="github",
            integration_id=self.integration.id,
        )
        repo2 = self.create_repo(
            name="example/repo2",
            external_id="repo-2",
            provider="github",
            integration_id=self.integration.id,
        )

        # Disable repositories for the integration
        repository_service.disable_repositories_for_integration(
            organization_id=self.organization.id,
            integration_id=self.integration.id,
            provider="github",
        )

        # Verify cleanup task was called for each repository
        assert mock_cleanup_task.call_count == 2

        # Check the calls were made with correct parameters
        call_kwargs_list = [call[1]["kwargs"] for call in mock_cleanup_task.call_args_list]

        expected_calls = [
            {
                "organization_id": self.organization.id,
                "repo_external_id": repo1.external_id,
                "repo_provider": repo1.provider,
            },
            {
                "organization_id": self.organization.id,
                "repo_external_id": repo2.external_id,
                "repo_provider": repo2.provider,
            },
        ]

        for expected in expected_calls:
            assert expected in call_kwargs_list

        # Verify repositories were disabled
        repo1.refresh_from_db()
        repo2.refresh_from_db()
        assert repo1.status == ObjectStatus.DISABLED
        assert repo2.status == ObjectStatus.DISABLED

    @patch("sentry.tasks.seer.cleanup_seer_repository_preferences.apply_async")
    def test_disable_repositories_skips_repos_without_external_id(
        self, mock_cleanup_task: MagicMock
    ) -> None:
        """Test that cleanup task is not called for repos without external_id."""
        self.create_repo(
            name="example/repo-no-external-id",
            external_id=None,
            provider="github",
            integration_id=self.integration.id,
        )

        repository_service.disable_repositories_for_integration(
            organization_id=self.organization.id,
            integration_id=self.integration.id,
            provider="github",
        )

        # Verify cleanup task was NOT called
        mock_cleanup_task.assert_not_called()
