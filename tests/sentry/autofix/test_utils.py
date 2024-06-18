from unittest.mock import patch

import pytest
from django.conf import settings

from sentry.autofix.utils import (
    get_autofix_repos_from_project_code_mappings,
    get_autofix_state_from_pr_id,
)
from sentry.testutils.cases import TestCase
from sentry.utils import json


class TestGetRepoFromCodeMappings(TestCase):
    def test_code_mappings_empty(self):
        project = self.create_project()
        repos = get_autofix_repos_from_project_code_mappings(project)
        assert repos == []

    def test_get_repos_from_project_code_mappings_with_data(self):
        project = self.create_project()
        repo = self.create_repo(name="getsentry/sentry", provider="github", external_id="123")
        self.create_code_mapping(project=project, repo=repo)
        repos = get_autofix_repos_from_project_code_mappings(project)
        expected_repos = [
            {
                "provider": repo.provider,
                "owner": "getsentry",
                "name": "sentry",
                "external_id": "123",
            }
        ]
        assert repos == expected_repos


class TestGetAutofixStateFromPrId(TestCase):
    @patch("requests.post")
    def test_get_autofix_state_from_pr_id_success(self, mock_post):
        # Setup mock response
        mock_response = mock_post.return_value
        mock_response.raise_for_status = lambda: None
        mock_response.json.return_value = {
            "state": {"run_id": 123, "request": {"project_id": 456, "issue": {"id": 789}}}
        }

        # Call the function
        result = get_autofix_state_from_pr_id("github", 1)

        # Assertions
        assert result is not None
        assert result == {"run_id": 123, "request": {"project_id": 456, "issue": {"id": 789}}}

        mock_post.assert_called_once_with(
            f"{settings.SEER_AUTOFIX_URL}/v1/automation/autofix/state/pr",
            data=json.dumps({"provider": "github", "pr_id": 1}).encode("utf-8"),
            headers={"content-type": "application/json;charset=utf-8"},
        )

    @patch("requests.post")
    def test_get_autofix_state_from_pr_id_no_state(self, mock_post):
        # Setup mock response
        mock_response = mock_post.return_value
        mock_response.raise_for_status = lambda: None
        mock_response.json.return_value = {}

        # Call the function
        result = get_autofix_state_from_pr_id("github", 1)

        # Assertions
        assert result is None

    @patch("requests.post")
    def test_get_autofix_state_from_pr_id_http_error(self, mock_post):
        # Setup mock response to raise HTTP error
        mock_response = mock_post.return_value
        mock_response.raise_for_status.side_effect = Exception("HTTP Error")

        # Call the function and expect an exception
        with pytest.raises(Exception) as context:
            get_autofix_state_from_pr_id("github", 1)

        # Assertions
        assert "HTTP Error" in str(context.value)
