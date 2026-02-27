from datetime import datetime, timezone
from unittest.mock import MagicMock, Mock, patch

import orjson
import pytest

from sentry import ratelimits
from sentry.seer.autofix.constants import AutofixStatus
from sentry.seer.autofix.utils import (
    AUTOFIX_AUTOTRIGGED_RATE_LIMIT_OPTION_MULTIPLIERS,
    AutofixState,
    _get_autofix_rate_limit_config,
    get_autofix_repos_from_project_code_mappings,
    get_autofix_state,
    get_autofix_state_from_pr_id,
    is_seer_autotriggered_autofix_rate_limited,
    is_seer_autotriggered_autofix_rate_limited_and_increment,
    is_seer_scanner_rate_limited,
)
from sentry.seer.models import SeerPermissionError
from sentry.testutils.cases import TestCase
from sentry.testutils.helpers.options import override_options


class TestGetRepoFromCodeMappings(TestCase):
    def test_code_mappings_empty(self) -> None:
        project = self.create_project()
        repos = get_autofix_repos_from_project_code_mappings(project)
        assert repos == []

    def test_get_repos_from_project_code_mappings_with_data(self) -> None:
        project = self.create_project()
        repo = self.create_repo(
            name="getsentry/sentry", provider="github", external_id="123", integration_id=234
        )
        self.create_code_mapping(project=project, repo=repo)
        repos = get_autofix_repos_from_project_code_mappings(project)
        expected_repos = [
            {
                "integration_id": str(repo.integration_id),
                "organization_id": project.organization.id,
                "provider": repo.provider,
                "owner": "getsentry",
                "name": "sentry",
                "external_id": "123",
            }
        ]
        assert repos == expected_repos


class TestGetAutofixStateFromPrId(TestCase):
    @patch("sentry.seer.autofix.utils.make_signed_seer_api_request")
    def test_get_autofix_state_from_pr_id_success(self, mock_request: MagicMock) -> None:
        mock_response = Mock()
        mock_response.status = 200
        mock_response.json.return_value = {
            "state": {
                "run_id": 123,
                "request": {
                    "project_id": 456,
                    "organization_id": 999,
                    "issue": {"id": 789, "title": "Test Issue"},
                    "repos": [],
                },
                "updated_at": "2023-07-18T12:00:00Z",
                "status": "PROCESSING",
            }
        }
        mock_request.return_value = mock_response

        result = get_autofix_state_from_pr_id("github", 1)

        assert result is not None
        assert result.run_id == 123
        assert result.request == {
            "project_id": 456,
            "organization_id": 999,
            "issue": {"id": 789, "title": "Test Issue"},
            "repos": [],
        }
        assert result.updated_at == datetime(2023, 7, 18, 12, 0, tzinfo=timezone.utc)
        assert result.status == AutofixStatus.PROCESSING

        mock_request.assert_called_once()
        path = mock_request.call_args[0][1]
        assert path == "/v1/automation/autofix/state/pr"
        body = orjson.loads(mock_request.call_args[0][2])
        assert body == {"provider": "github", "pr_id": 1}

    @patch("sentry.seer.autofix.utils.make_signed_seer_api_request")
    def test_get_autofix_state_from_pr_id_no_state(self, mock_request: MagicMock) -> None:
        mock_response = Mock()
        mock_response.status = 200
        mock_response.json.return_value = {}
        mock_request.return_value = mock_response

        result = get_autofix_state_from_pr_id("github", 1)

        assert result is None

    @patch("sentry.seer.autofix.utils.make_signed_seer_api_request")
    def test_get_autofix_state_from_pr_id_http_error(self, mock_request: MagicMock) -> None:
        mock_response = Mock()
        mock_response.status = 500
        mock_request.return_value = mock_response

        with pytest.raises(Exception, match="Seer request failed with status 500"):
            get_autofix_state_from_pr_id("github", 1)


class TestGetAutofixState(TestCase):
    @patch("sentry.seer.autofix.utils.make_signed_seer_api_request")
    def test_get_autofix_state_success_with_group_id(self, mock_request: MagicMock) -> None:
        mock_response = Mock()
        mock_response.status = 200
        mock_response.json.return_value = {
            "group_id": 123,
            "state": {
                "run_id": 456,
                "request": {
                    "project_id": 789,
                    "organization_id": 999,
                    "issue": {"id": 123, "title": "Test Issue"},
                    "repos": [],
                },
                "updated_at": "2023-07-18T12:00:00Z",
                "status": "PROCESSING",
            },
        }
        mock_request.return_value = mock_response

        result = get_autofix_state(group_id=123, organization_id=999)

        assert isinstance(result, AutofixState)
        assert result.run_id == 456
        assert result.request == {
            "project_id": 789,
            "organization_id": 999,
            "issue": {"id": 123, "title": "Test Issue"},
            "repos": [],
        }
        assert result.updated_at == datetime(2023, 7, 18, 12, 0, tzinfo=timezone.utc)
        assert result.status == AutofixStatus.PROCESSING

        mock_request.assert_called_once()
        path = mock_request.call_args[0][1]
        assert path == "/v1/automation/autofix/state"
        body = orjson.loads(mock_request.call_args[0][2])
        assert body == {
            "group_id": 123,
            "run_id": None,
            "check_repo_access": False,
            "is_user_fetching": False,
        }

    @patch("sentry.seer.autofix.utils.make_signed_seer_api_request")
    def test_get_autofix_state_success_with_run_id(self, mock_request: MagicMock) -> None:
        mock_response = Mock()
        mock_response.status = 200
        mock_response.json.return_value = {
            "run_id": 456,
            "state": {
                "run_id": 456,
                "request": {
                    "project_id": 789,
                    "organization_id": 999,
                    "issue": {"id": 123, "title": "Test Issue"},
                    "repos": [],
                },
                "updated_at": "2023-07-18T12:00:00Z",
                "status": "COMPLETED",
            },
        }
        mock_request.return_value = mock_response

        result = get_autofix_state(run_id=456, organization_id=999)

        assert isinstance(result, AutofixState)
        assert result.run_id == 456
        assert result.request == {
            "project_id": 789,
            "organization_id": 999,
            "issue": {"id": 123, "title": "Test Issue"},
            "repos": [],
        }
        assert result.updated_at == datetime(2023, 7, 18, 12, 0, tzinfo=timezone.utc)
        assert result.status == AutofixStatus.COMPLETED

        mock_request.assert_called_once()
        path = mock_request.call_args[0][1]
        assert path == "/v1/automation/autofix/state"
        body = orjson.loads(mock_request.call_args[0][2])
        assert body == {
            "group_id": None,
            "run_id": 456,
            "check_repo_access": False,
            "is_user_fetching": False,
        }

    @patch("sentry.seer.autofix.utils.make_signed_seer_api_request")
    def test_get_autofix_state_no_result(self, mock_request: MagicMock) -> None:
        mock_response = Mock()
        mock_response.status = 200
        mock_response.json.return_value = {}
        mock_request.return_value = mock_response

        result = get_autofix_state(group_id=123, organization_id=999)

        assert result is None

    @patch("sentry.seer.autofix.utils.make_signed_seer_api_request")
    def test_get_autofix_state_http_error(self, mock_request: MagicMock) -> None:
        mock_response = Mock()
        mock_response.status = 500
        mock_request.return_value = mock_response

        with pytest.raises(Exception, match="Seer request failed with status 500"):
            get_autofix_state(group_id=123, organization_id=999)

    @patch("sentry.seer.autofix.utils.make_signed_seer_api_request")
    def test_get_autofix_state_raises_on_org_id_mismatch(self, mock_request: MagicMock) -> None:
        mock_response = Mock()
        mock_response.status = 200
        mock_response.json.return_value = {
            "group_id": 123,
            "state": {
                "run_id": 456,
                "request": {
                    "project_id": 789,
                    "organization_id": 111,  # mismatched org id
                    "issue": {"id": 123, "title": "Test Issue"},
                    "repos": [],
                },
                "updated_at": "2023-07-18T12:00:00Z",
                "status": "PROCESSING",
            },
        }
        mock_request.return_value = mock_response

        with pytest.raises(SeerPermissionError):
            get_autofix_state(group_id=123, organization_id=999)


class TestAutomationRateLimiting(TestCase):
    @patch("sentry.seer.autofix.utils.ratelimits.backend.is_limited_with_value")
    @patch("sentry.seer.autofix.utils.track_outcome")
    def test_scanner_rate_limited_logic(
        self, mock_track_outcome: MagicMock, mock_is_limited: MagicMock
    ) -> None:
        """Test scanner rate limiting logic"""
        project = self.create_project()
        organization = project.organization

        mock_is_limited.return_value = (True, 10, None)

        with self.options({"seer.max_num_scanner_autotriggered_per_ten_seconds": 15}):
            is_rate_limited = is_seer_scanner_rate_limited(project, organization)

        assert is_rate_limited is True
        mock_track_outcome.assert_called_once()

    @patch("sentry.seer.autofix.utils.ratelimits.backend.is_limited_with_value")
    @patch("sentry.seer.autofix.utils.track_outcome")
    def test_autofix_rate_limited_logic(
        self, mock_track_outcome: MagicMock, mock_is_limited: MagicMock
    ) -> None:
        """Test autofix rate limiting logic"""
        project = self.create_project()
        organization = project.organization

        project.update_option("sentry:autofix_automation_tuning", None)

        mock_is_limited.return_value = (True, 19, None)

        with self.options({"seer.max_num_autofix_autotriggered_per_hour": 20}):
            is_rate_limited = is_seer_autotriggered_autofix_rate_limited_and_increment(
                project, organization
            )

        assert is_rate_limited is True
        mock_track_outcome.assert_called_once()

    @patch("sentry.seer.autofix.utils.ratelimits.backend.is_limited_with_value")
    def test_autofix_rate_limit_multiplication_logic(self, mock_is_limited: MagicMock) -> None:
        """Test that the limit is multiplied correctly based on project option"""
        project = self.create_project()
        organization = project.organization
        mock_is_limited.return_value = (False, 0, None)

        base_limit = 20

        for option, multiplier in AUTOFIX_AUTOTRIGGED_RATE_LIMIT_OPTION_MULTIPLIERS.items():
            with self.options({"seer.max_num_autofix_autotriggered_per_hour": base_limit}):
                project.update_option("sentry:autofix_automation_tuning", option)
                is_seer_autotriggered_autofix_rate_limited_and_increment(project, organization)
                expected_limit = base_limit * multiplier
                mock_is_limited.assert_called_with(
                    project=project,
                    key="autofix.auto_triggered",
                    limit=expected_limit,
                    window=60 * 60,
                )

    @override_options({"seer.max_num_autofix_autotriggered_per_hour": 20})
    def test_rate_limit_read_only_check_does_not_increment_counter(self) -> None:
        project = self.create_project()
        organization = project.organization
        config = _get_autofix_rate_limit_config(project)

        # Check a few times to be safe
        for _ in range(5):
            is_seer_autotriggered_autofix_rate_limited(project)
        current = ratelimits.backend.current_value(
            key=config["key"], project=project, window=config["window"]
        )
        assert current == 0

        is_seer_autotriggered_autofix_rate_limited_and_increment(project, organization)
        current = ratelimits.backend.current_value(
            key=config["key"], project=project, window=config["window"]
        )
        assert current == 1
        ratelimits.backend.reset(key=config["key"], project=project, window=config["window"])
