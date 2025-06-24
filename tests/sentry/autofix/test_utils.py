from datetime import datetime, timezone
from unittest.mock import patch

import pytest
from django.conf import settings

from sentry.autofix.utils import (
    AutofixState,
    AutofixStatus,
    get_autofix_repos_from_project_code_mappings,
    get_autofix_state,
    get_autofix_state_from_pr_id,
    is_seer_autotriggered_autofix_rate_limited,
    is_seer_scanner_rate_limited,
)
from sentry.testutils.cases import TestCase
from sentry.testutils.helpers import with_feature
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
            "state": {
                "run_id": 123,
                "request": {"project_id": 456, "issue": {"id": 789}},
                "updated_at": "2023-07-18T12:00:00Z",
                "status": "PROCESSING",
            }
        }

        # Call the function
        result = get_autofix_state_from_pr_id("github", 1)

        # Assertions
        assert result is not None
        assert result.run_id == 123
        assert result.request == {"project_id": 456, "issue": {"id": 789}}
        assert result.updated_at == datetime(2023, 7, 18, 12, 0, tzinfo=timezone.utc)
        assert result.status == AutofixStatus.PROCESSING

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


class TestGetAutofixState(TestCase):
    @patch("requests.post")
    def test_get_autofix_state_success_with_group_id(self, mock_post):
        # Setup mock response
        mock_response = mock_post.return_value
        mock_response.raise_for_status = lambda: None
        mock_response.json.return_value = {
            "group_id": 123,
            "state": {
                "run_id": 456,
                "request": {"project_id": 789, "issue": {"id": 123}},
                "updated_at": "2023-07-18T12:00:00Z",
                "status": "PROCESSING",
            },
        }

        # Call the function
        result = get_autofix_state(group_id=123)

        # Assertions
        assert isinstance(result, AutofixState)
        assert result.run_id == 456
        assert result.request == {"project_id": 789, "issue": {"id": 123}}
        assert result.updated_at == datetime(2023, 7, 18, 12, 0, tzinfo=timezone.utc)
        assert result.status == AutofixStatus.PROCESSING

        mock_post.assert_called_once_with(
            f"{settings.SEER_AUTOFIX_URL}/v1/automation/autofix/state",
            data=b'{"group_id":123,"run_id":null,"check_repo_access":false,"is_user_fetching":false}',
            headers={"content-type": "application/json;charset=utf-8"},
        )

    @patch("requests.post")
    def test_get_autofix_state_success_with_run_id(self, mock_post):
        # Setup mock response
        mock_response = mock_post.return_value
        mock_response.raise_for_status = lambda: None
        mock_response.json.return_value = {
            "run_id": 456,
            "state": {
                "run_id": 456,
                "request": {"project_id": 789, "issue": {"id": 123}},
                "updated_at": "2023-07-18T12:00:00Z",
                "status": "COMPLETED",
            },
        }

        # Call the function
        result = get_autofix_state(run_id=456)

        # Assertions
        assert isinstance(result, AutofixState)
        assert result.run_id == 456
        assert result.request == {"project_id": 789, "issue": {"id": 123}}
        assert result.updated_at == datetime(2023, 7, 18, 12, 0, tzinfo=timezone.utc)
        assert result.status == AutofixStatus.COMPLETED

        mock_post.assert_called_once_with(
            f"{settings.SEER_AUTOFIX_URL}/v1/automation/autofix/state",
            data=b'{"group_id":null,"run_id":456,"check_repo_access":false,"is_user_fetching":false}',
            headers={"content-type": "application/json;charset=utf-8"},
        )

    @patch("requests.post")
    def test_get_autofix_state_no_result(self, mock_post):
        # Setup mock response
        mock_response = mock_post.return_value
        mock_response.raise_for_status = lambda: None
        mock_response.json.return_value = {}

        # Call the function
        result = get_autofix_state(group_id=123)

        # Assertions
        assert result is None

    @patch("requests.post")
    def test_get_autofix_state_http_error(self, mock_post):
        # Setup mock response to raise HTTP error
        mock_response = mock_post.return_value
        mock_response.raise_for_status.side_effect = Exception("HTTP Error")

        # Call the function and expect an exception
        with pytest.raises(Exception) as context:
            get_autofix_state(group_id=123)

        # Assertions
        assert "HTTP Error" in str(context.value)


class TestAutomationRateLimiting(TestCase):
    @with_feature("organizations:unlimited-auto-triggered-autofix-runs")
    def test_scanner_rate_limited_with_unlimited_flag(self):
        """Test scanner rate limiting bypassed with unlimited feature flag"""
        project = self.create_project()
        organization = project.organization

        is_rate_limited, current, limit = is_seer_scanner_rate_limited(project, organization)

        assert is_rate_limited is False
        assert current == 0
        assert limit == 0

    @patch("sentry.autofix.utils.ratelimits.backend.is_limited_with_value")
    def test_scanner_rate_limited_logic(self, mock_is_limited):
        """Test scanner rate limiting logic"""
        project = self.create_project()
        organization = project.organization

        mock_is_limited.return_value = (True, 45, None)

        with self.options({"seer.max_num_scanner_autotriggered_per_minute": 50}):
            is_rate_limited, current, limit = is_seer_scanner_rate_limited(project, organization)

        assert is_rate_limited is True
        assert current == 45
        assert limit == 50

    @with_feature("organizations:unlimited-auto-triggered-autofix-runs")
    def test_autofix_rate_limited_with_unlimited_flag(self):
        """Test autofix rate limiting bypassed with unlimited feature flag"""
        project = self.create_project()
        organization = project.organization

        is_rate_limited, current, limit = is_seer_autotriggered_autofix_rate_limited(
            project, organization
        )

        assert is_rate_limited is False
        assert current == 0
        assert limit == 0

    @patch("sentry.autofix.utils.ratelimits.backend.is_limited_with_value")
    def test_autofix_rate_limited_logic(self, mock_is_limited):
        """Test autofix rate limiting logic"""
        project = self.create_project()
        organization = project.organization

        mock_is_limited.return_value = (True, 19, None)

        with self.options({"seer.max_num_autofix_autotriggered_per_hour": 20}):
            is_rate_limited, current, limit = is_seer_autotriggered_autofix_rate_limited(
                project, organization
            )

        assert is_rate_limited is True
        assert current == 19
        assert limit == 20
