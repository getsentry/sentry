from __future__ import annotations

from unittest.mock import patch

import orjson
import pytest
import responses
from django.conf import settings

from sentry.seer.signed_seer_api import sign_with_seer_secret
from sentry.tasks.seer import cleanup_seer_repository_preferences
from sentry.testutils.cases import TestCase


class TestSeerRepositoryCleanup(TestCase):
    def setUp(self):
        self.organization = self.create_organization()
        self.project = self.create_project(organization=self.organization)
        self.repo_external_id = "12345"
        self.repo_provider = "github"
        self.repo_name = "test-repo"

    @responses.activate
    def test_cleanup_seer_repository_preferences_success(self):
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
            repo_name=self.repo_name,
        )

        # Verify the request was made with correct data
        assert len(responses.calls) == 1
        request = responses.calls[0].request

        expected_body = orjson.dumps(
            {
                "organization_id": self.organization.id,
                "repository": {
                    "provider": self.repo_provider,
                    "external_id": self.repo_external_id,
                    "name": self.repo_name,
                },
            }
        )

        assert request.body == expected_body
        assert request.headers["content-type"] == "application/json;charset=utf-8"

        # Verify the request was signed
        expected_headers = sign_with_seer_secret(expected_body)
        for header_name, header_value in expected_headers.items():
            assert request.headers[header_name] == header_value

    @responses.activate
    def test_cleanup_seer_repository_preferences_api_error(self):
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
                repo_name=self.repo_name,
            )

    @responses.activate
    def test_cleanup_seer_repository_preferences_organization_not_found(self):
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
            repo_name=self.repo_name,
        )

        # The API call should be made regardless of local organization existence
        assert len(responses.calls) == 1
        request = responses.calls[0].request

        expected_body = orjson.dumps(
            {
                "organization_id": nonexistent_organization_id,
                "repository": {
                    "provider": self.repo_provider,
                    "external_id": self.repo_external_id,
                    "name": self.repo_name,
                },
            }
        )

        assert request.body == expected_body

    @patch("sentry.tasks.seer.cleanup_seer_repository_preferences.delay")
    def test_repository_deletion_triggers_cleanup(self, mock_cleanup_task):
        """Test that repository deletion triggers Seer cleanup."""
        from sentry.models.repository import Repository, on_delete

        # Create a repository
        repo = Repository.objects.create(
            name=self.repo_name,
            provider=self.repo_provider,
            external_id=self.repo_external_id,
            organization_id=self.organization.id,
        )

        # Trigger the on_delete function directly
        on_delete(repo)

        # Verify the cleanup task was called
        mock_cleanup_task.assert_called_once_with(
            organization_id=self.organization.id,
            repo_external_id=self.repo_external_id,
            repo_provider=self.repo_provider,
            repo_name=self.repo_name,
        )
