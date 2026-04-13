from typing import Any
from unittest.mock import Mock, patch

import orjson
import pytest

from sentry.constants import SEER_AUTOMATED_RUN_STOPPING_POINT_DEFAULT, DataCategory
from sentry.seer.autofix.constants import AutofixStatus
from sentry.seer.autofix.trigger import is_issue_eligible_for_seer_automation
from sentry.seer.autofix.utils import (
    AutofixState,
    AutofixTriggerSource,
    CodingAgentStatus,
    bulk_read_preferences_from_sentry_db,
    bulk_write_preferences_to_sentry_db,
    deduplicate_repositories,
    get_autofix_prompt,
    get_coding_agent_prompt,
    get_org_default_seer_automation_handoff,
    has_project_connected_repos,
    is_seer_seat_based_tier_enabled,
    read_preference_from_sentry_db,
    resolve_repository_ids,
    set_project_seer_preference,
    write_preference_to_sentry_db,
)
from sentry.seer.models import (
    BranchOverride,
    SeerApiError,
    SeerAutomationHandoffConfiguration,
    SeerProjectPreference,
    SeerRepoDefinition,
)
from sentry.seer.models.project_repository import (
    SeerProjectRepository,
    SeerProjectRepositoryBranchOverride,
)
from sentry.testutils.cases import TestCase
from sentry.testutils.helpers.features import with_feature
from sentry.utils.cache import cache


class TestGetAutofixPrompt(TestCase):
    def setUp(self) -> None:
        super().setUp()
        self.run_id = 12345
        self.mock_response_data = {
            "run_id": self.run_id,
            "prompt": "Test prompt content",
            "has_root_cause": True,
            "has_solution": True,
        }

    @patch("sentry.seer.autofix.utils.make_signed_seer_api_request")
    def test_get_autofix_prompt_root_cause_params(self, mock_make_request):
        """Test get_autofix_prompt sends correct params for root cause."""
        mock_response = Mock()
        mock_response.status = 200
        mock_response.data = orjson.dumps(self.mock_response_data)
        mock_make_request.return_value = mock_response

        result = get_autofix_prompt(self.run_id, True, False)

        assert result == "Test prompt content"

        mock_make_request.assert_called_once()
        call = mock_make_request.call_args
        # Positional args: (connection_pool, path)
        assert call.args[0] is not None
        assert call.args[1] == "/v1/automation/autofix/prompt"

        # Keyword args
        expected_body = {
            "run_id": self.run_id,
            "include_root_cause": True,
            "include_solution": False,
        }
        actual_body = orjson.loads(call.kwargs["body"])  # bytes -> dict
        assert actual_body == expected_body
        assert call.kwargs["timeout"] == 15

    @patch("sentry.seer.autofix.utils.make_signed_seer_api_request")
    def test_get_autofix_prompt_solution_params(self, mock_make_request):
        """Test get_autofix_prompt sends correct params for solution."""
        mock_response = Mock()
        mock_response.status = 200
        mock_response.data = orjson.dumps(self.mock_response_data)
        mock_make_request.return_value = mock_response

        result = get_autofix_prompt(self.run_id, True, True)

        assert result == "Test prompt content"

        call = mock_make_request.call_args
        expected_body = {
            "run_id": self.run_id,
            "include_root_cause": True,
            "include_solution": True,
        }
        actual_body = orjson.loads(call.kwargs["body"])  # bytes -> dict
        assert actual_body == expected_body

    @patch("sentry.seer.autofix.utils.make_signed_seer_api_request")
    def test_get_autofix_prompt_http_error_raises(self, mock_make_request):
        """Test get_autofix_prompt raises on HTTP error status."""
        mock_response = Mock()
        mock_response.status = 404
        mock_response.data = orjson.dumps({})
        mock_make_request.return_value = mock_response

        with pytest.raises(SeerApiError):
            get_autofix_prompt(self.run_id, True, True)

    @patch("sentry.seer.autofix.utils.make_signed_seer_api_request")
    def test_get_autofix_prompt_timeout_error_raises(self, mock_make_request):
        """Test get_autofix_prompt propagates timeout errors."""
        mock_make_request.side_effect = Exception("Request timed out")

        with pytest.raises(Exception):
            get_autofix_prompt(self.run_id, True, True)

    @patch("sentry.seer.autofix.utils.make_signed_seer_api_request")
    def test_get_autofix_prompt_connection_error_raises(self, mock_make_request):
        """Test get_autofix_prompt propagates connection errors."""
        mock_make_request.side_effect = Exception("Connection failed")

        with pytest.raises(Exception):
            get_autofix_prompt(self.run_id, True, True)

    @patch("sentry.seer.autofix.utils.make_signed_seer_api_request")
    def test_get_autofix_prompt_json_decode_error_raises(self, mock_make_request):
        """Test get_autofix_prompt propagates JSON decode errors."""
        mock_response = Mock()
        mock_response.status = 200
        mock_response.data = b"invalid orjson"
        mock_make_request.return_value = mock_response

        with pytest.raises(Exception):
            get_autofix_prompt(self.run_id, True, True)


class TestGetCodingAgentPrompt(TestCase):
    @patch("sentry.seer.autofix.utils.get_autofix_prompt")
    def test_get_coding_agent_prompt_success(self, mock_get_autofix_prompt):
        """Test get_coding_agent_prompt with successful autofix prompt."""
        mock_get_autofix_prompt.return_value = "This is the autofix prompt"

        result = get_coding_agent_prompt(12345, AutofixTriggerSource.SOLUTION)

        expected = "Please fix the following issue. Ensure that your fix is fully working.\n\nThis is the autofix prompt"
        assert result == expected
        mock_get_autofix_prompt.assert_called_once_with(12345, True, True)

    @patch("sentry.seer.autofix.utils.get_autofix_prompt")
    def test_get_coding_agent_prompt_root_cause_trigger(self, mock_get_autofix_prompt):
        """Test get_coding_agent_prompt with root_cause trigger."""
        mock_get_autofix_prompt.return_value = "Root cause analysis prompt"

        result = get_coding_agent_prompt(12345, AutofixTriggerSource.ROOT_CAUSE)

        expected = "Please fix the following issue. Ensure that your fix is fully working.\n\nRoot cause analysis prompt"
        assert result == expected
        mock_get_autofix_prompt.assert_called_once_with(12345, True, False)

    @patch("sentry.seer.autofix.utils.get_autofix_prompt")
    def test_get_coding_agent_prompt_with_instruction(self, mock_get_autofix_prompt):
        """Test get_coding_agent_prompt with custom instruction."""
        mock_get_autofix_prompt.return_value = "This is the autofix prompt"

        result = get_coding_agent_prompt(
            12345, AutofixTriggerSource.SOLUTION, "Use TypeScript instead of JavaScript"
        )

        expected = "Please fix the following issue. Ensure that your fix is fully working.\n\nUse TypeScript instead of JavaScript\n\nThis is the autofix prompt"
        assert result == expected
        mock_get_autofix_prompt.assert_called_once_with(12345, True, True)

    @patch("sentry.seer.autofix.utils.get_autofix_prompt")
    def test_get_coding_agent_prompt_with_blank_instruction(self, mock_get_autofix_prompt):
        """Test get_coding_agent_prompt with blank instruction is ignored."""
        mock_get_autofix_prompt.return_value = "This is the autofix prompt"

        result = get_coding_agent_prompt(12345, AutofixTriggerSource.SOLUTION, "   ")

        expected = "Please fix the following issue. Ensure that your fix is fully working.\n\nThis is the autofix prompt"
        assert result == expected
        mock_get_autofix_prompt.assert_called_once_with(12345, True, True)

    @patch("sentry.seer.autofix.utils.get_autofix_prompt")
    def test_get_coding_agent_prompt_with_empty_instruction(self, mock_get_autofix_prompt):
        """Test get_coding_agent_prompt with empty instruction is ignored."""
        mock_get_autofix_prompt.return_value = "This is the autofix prompt"

        result = get_coding_agent_prompt(12345, AutofixTriggerSource.SOLUTION, "")

        expected = "Please fix the following issue. Ensure that your fix is fully working.\n\nThis is the autofix prompt"
        assert result == expected
        mock_get_autofix_prompt.assert_called_once_with(12345, True, True)

    @patch("sentry.seer.autofix.utils.get_autofix_prompt")
    def test_get_coding_agent_prompt_with_short_id(self, mock_get_autofix_prompt):
        """Test get_coding_agent_prompt includes Fixes line when short_id is provided."""
        mock_get_autofix_prompt.return_value = "This is the autofix prompt"

        result = get_coding_agent_prompt(
            12345, AutofixTriggerSource.SOLUTION, None, short_id="AIML-2301"
        )

        assert "Fixes AIML-2301" in result
        assert "Include 'Fixes AIML-2301' in the commit message" in result
        assert "Please fix the following issue" in result
        assert "This is the autofix prompt" in result

    @patch("sentry.seer.autofix.utils.get_autofix_prompt")
    def test_get_coding_agent_prompt_without_short_id(self, mock_get_autofix_prompt):
        """Test get_coding_agent_prompt does not include Fixes line when short_id is None."""
        mock_get_autofix_prompt.return_value = "This is the autofix prompt"

        result = get_coding_agent_prompt(12345, AutofixTriggerSource.SOLUTION, None, short_id=None)

        assert "Fixes" not in result
        assert "Please fix the following issue" in result
        assert "This is the autofix prompt" in result

    @patch("sentry.seer.autofix.utils.get_autofix_prompt")
    def test_get_coding_agent_prompt_with_short_id_and_instruction(self, mock_get_autofix_prompt):
        """Test get_coding_agent_prompt includes both Fixes line and instruction."""
        mock_get_autofix_prompt.return_value = "This is the autofix prompt"

        result = get_coding_agent_prompt(
            12345,
            AutofixTriggerSource.SOLUTION,
            "Be careful with backwards compatibility",
            short_id="PROJ-1234",
        )

        assert "Fixes PROJ-1234" in result
        assert "Be careful with backwards compatibility" in result
        assert "Please fix the following issue" in result
        assert "This is the autofix prompt" in result

    @patch("sentry.seer.autofix.utils.get_autofix_prompt")
    def test_get_coding_agent_prompt_with_empty_short_id(self, mock_get_autofix_prompt):
        """Test get_coding_agent_prompt does not include Fixes line when short_id is empty string."""
        mock_get_autofix_prompt.return_value = "This is the autofix prompt"

        result = get_coding_agent_prompt(12345, AutofixTriggerSource.SOLUTION, None, short_id="")

        assert "Fixes" not in result
        assert "Please fix the following issue" in result


class TestAutofixStateParsing(TestCase):
    def test_autofix_state_validate_parses_nested_structures(self) -> None:
        state_data = {
            "run_id": 1,
            "request": {
                "project_id": 42,
                "organization_id": 123,
                "issue": {"id": 999, "title": "Something broke"},
                "repos": [
                    {
                        "provider": "github",
                        "owner": "getsentry",
                        "name": "sentry",
                        "external_id": "123",
                    }
                ],
            },
            "updated_at": "2025-08-25T12:34:56.000Z",
            "status": "PROCESSING",
            "codebases": {
                "123": {
                    "repo_external_id": "123",
                    "file_changes": [],
                    "is_readable": True,
                    "is_writeable": False,
                }
            },
            "steps": [{"key": "root_cause_analysis", "id": "rca"}],
            "coding_agents": {
                "agent-1": {
                    "id": "agent-1",
                    "status": "completed",
                    "name": "Autofixer",
                    "provider": "cursor_background_agent",
                    "started_at": "2025-08-25T12:00:00.000Z",
                    "results": [],
                }
            },
        }

        state = AutofixState.validate(state_data)

        # Check that stuff is parsed
        assert state.run_id == 1
        assert state.status == AutofixStatus.PROCESSING

        codebase = state.codebases["123"]
        assert codebase.repo_external_id == "123"

        # Top-level coding_agents map is parsed with enum status
        assert state.coding_agents["agent-1"].status == CodingAgentStatus.COMPLETED


class TestIsIssueEligibleForSeerAutomation(TestCase):
    """Test the is_issue_eligible_for_seer_automation function."""

    def setUp(self) -> None:
        super().setUp()
        self.organization = self.create_organization(name="test-org")
        self.project = self.create_project(organization=self.organization)
        self.group = self.create_group(project=self.project)

    def test_returns_false_for_unsupported_issue_categories(self) -> None:
        """Test returns False for unsupported issue categories like REPLAY and FEEDBACK."""
        from sentry.issues.grouptype import FeedbackGroup, ReplayRageClickType

        # Create groups with unsupported categories
        replay_group = self.create_group(project=self.project, type=ReplayRageClickType.type_id)
        feedback_group = self.create_group(project=self.project, type=FeedbackGroup.type_id)

        assert is_issue_eligible_for_seer_automation(replay_group) is False
        assert is_issue_eligible_for_seer_automation(feedback_group) is False

    def test_returns_true_for_supported_issue_categories(self) -> None:
        """Test returns True for supported issue categories when all conditions are met."""
        with self.feature("organizations:gen-ai-features"):
            with patch("sentry.quotas.backend.check_seer_quota") as mock_budget:
                mock_budget.return_value = True
                self.project.update_option("sentry:seer_scanner_automation", True)

                # Test supported categories - using default error group
                result = is_issue_eligible_for_seer_automation(self.group)

                assert result is True

    def test_returns_false_when_gen_ai_features_not_enabled(self) -> None:
        """Test returns False when organizations:gen-ai-features feature flag is not enabled."""
        result = is_issue_eligible_for_seer_automation(self.group)
        assert result is False

    def test_returns_false_when_ai_features_hidden(self) -> None:
        """Test returns False when sentry:hide_ai_features option is enabled."""
        with self.feature("organizations:gen-ai-features"):
            self.organization.update_option("sentry:hide_ai_features", True)
            result = is_issue_eligible_for_seer_automation(self.group)
            assert result is False

    def test_returns_false_when_scanner_automation_disabled_and_not_always_trigger(self) -> None:
        """Test returns False when scanner automation is disabled and issue type doesn't always trigger."""
        with self.feature("organizations:gen-ai-features"):
            self.project.update_option("sentry:seer_scanner_automation", False)
            result = is_issue_eligible_for_seer_automation(self.group)
            assert result is False

    @patch("sentry.quotas.backend.check_seer_quota")
    def test_returns_false_when_no_budget_available(self, mock_has_budget):
        """Test returns False when organization has no available budget for scanner."""
        with self.feature("organizations:gen-ai-features"):
            self.project.update_option("sentry:seer_scanner_automation", True)
            mock_has_budget.return_value = False

            result = is_issue_eligible_for_seer_automation(self.group)

            assert result is False
            mock_has_budget.assert_called_once_with(
                org_id=self.organization.id, data_category=DataCategory.SEER_SCANNER
            )

    @patch("sentry.quotas.backend.check_seer_quota")
    def test_returns_true_when_all_conditions_met(self, mock_has_budget):
        """Test returns True when all eligibility conditions are met."""
        with self.feature("organizations:gen-ai-features"):
            self.project.update_option("sentry:seer_scanner_automation", True)

            mock_has_budget.return_value = True

            result = is_issue_eligible_for_seer_automation(self.group)

            assert result is True
            mock_has_budget.assert_called_once_with(
                org_id=self.organization.id, data_category=DataCategory.SEER_SCANNER
            )

    @patch("sentry.quotas.backend.check_seer_quota")
    def test_returns_true_when_issue_type_always_triggers(
        self,
        mock_has_budget,
    ):
        """Test returns True when issue type has always_trigger_seer_automation even if scanner automation is disabled."""
        with self.feature("organizations:gen-ai-features"):
            # Disable scanner automation
            self.project.update_option("sentry:seer_scanner_automation", False)

            mock_has_budget.return_value = True

            # Mock the group's issue_type to always trigger
            with patch.object(self.group.issue_type, "always_trigger_seer_automation", True):
                result = is_issue_eligible_for_seer_automation(self.group)

                assert result is True


class TestIsSeerSeatBasedTierEnabled(TestCase):
    """Test the is_seer_seat_based_tier_enabled function."""

    def setUp(self) -> None:
        super().setUp()
        self.organization = self.create_organization(name="test-org")

    def tearDown(self):
        super().tearDown()
        cache.delete(f"seer:seat-based-tier:{self.organization.id}")

    @patch("sentry.seer.autofix.utils.features.has")
    def test_returns_true_when_seat_based_seer_enabled(self, mock_features_has):
        """Test returns True when seat-based-seer-enabled feature flag is enabled and caches the result."""

        def features_side_effect(flag, org):
            if flag == "organizations:seat-based-seer-enabled":
                return True
            return False

        mock_features_has.side_effect = features_side_effect

        result = is_seer_seat_based_tier_enabled(self.organization)
        assert result is True

        # Verify it was cached
        cache_key = f"seer:seat-based-tier:{self.organization.id}"
        assert cache.get(cache_key) is True

    def test_returns_false_when_no_flags_enabled(self) -> None:
        """Test returns False when neither feature flag is enabled and caches the result."""
        result = is_seer_seat_based_tier_enabled(self.organization)
        assert result is False

        # Verify False was cached
        cache_key = f"seer:seat-based-tier:{self.organization.id}"
        assert cache.get(cache_key) is False

    def test_returns_cached_value(self) -> None:
        """Test returns cached value without checking feature flags."""
        cache_key = f"seer:seat-based-tier:{self.organization.id}"
        cache.set(cache_key, True, timeout=60)

        # Even without feature flags enabled, should return cached True
        result = is_seer_seat_based_tier_enabled(self.organization)
        assert result is True


class TestHasProjectConnectedRepos(TestCase):
    """Test the has_project_connected_repos function."""

    def setUp(self) -> None:
        super().setUp()
        self.organization = self.create_organization()
        self.project = self.create_project(organization=self.organization)

    @patch("sentry.seer.autofix.utils.cache")
    @patch("sentry.seer.autofix.utils.get_project_seer_preferences")
    def test_returns_true_when_repos_exist(self, mock_get_preferences, mock_cache):
        """Test returns True when project has connected repositories."""
        mock_cache.get.return_value = None
        mock_preference = Mock()
        mock_preference.repositories = [{"provider": "github", "owner": "test", "name": "repo"}]
        mock_response = Mock()
        mock_response.preference = mock_preference
        mock_get_preferences.return_value = mock_response

        result = has_project_connected_repos(self.organization, self.project)

        assert result is True
        mock_cache.set.assert_called_once_with(
            f"seer-project-has-repos:{self.organization.id}:{self.project.id}",
            True,
            timeout=60 * 15,
        )

    @patch("sentry.seer.autofix.utils.get_autofix_repos_from_project_code_mappings")
    @patch("sentry.seer.autofix.utils.cache")
    @patch("sentry.seer.autofix.utils.get_project_seer_preferences")
    def test_returns_false_when_no_repos(
        self, mock_get_preferences, mock_cache, mock_get_code_mappings
    ):
        """Test returns False when project has no connected repositories."""
        mock_cache.get.return_value = None
        mock_preference = Mock()
        mock_preference.repositories = []
        mock_response = Mock()
        mock_response.preference = mock_preference
        mock_get_preferences.return_value = mock_response
        mock_get_code_mappings.return_value = []

        result = has_project_connected_repos(self.organization, self.project)

        assert result is False
        mock_cache.set.assert_called_once_with(
            f"seer-project-has-repos:{self.organization.id}:{self.project.id}",
            False,
            timeout=60 * 15,
        )

    @patch("sentry.seer.autofix.utils.get_autofix_repos_from_project_code_mappings")
    @patch("sentry.seer.autofix.utils.cache")
    @patch("sentry.seer.autofix.utils.get_project_seer_preferences")
    def test_returns_false_when_preference_is_none_and_no_code_mappings(
        self, mock_get_preferences, mock_cache, mock_get_code_mappings
    ):
        """Test returns False when preference is None and no code mappings exist."""
        mock_cache.get.return_value = None
        mock_response = Mock()
        mock_response.preference = None
        mock_get_preferences.return_value = mock_response
        mock_get_code_mappings.return_value = []

        result = has_project_connected_repos(self.organization, self.project)

        assert result is False
        mock_cache.set.assert_called_once_with(
            f"seer-project-has-repos:{self.organization.id}:{self.project.id}",
            False,
            timeout=60 * 15,
        )

    @patch("sentry.seer.autofix.utils.get_autofix_repos_from_project_code_mappings")
    @patch("sentry.seer.autofix.utils.cache")
    @patch("sentry.seer.autofix.utils.get_project_seer_preferences")
    def test_falls_back_to_code_mappings_when_no_seer_preference(
        self, mock_get_preferences, mock_cache, mock_get_code_mappings
    ):
        """Test falls back to code mappings when Seer has no preference."""
        mock_cache.get.return_value = None
        mock_response = Mock()
        mock_response.preference = None
        mock_get_preferences.return_value = mock_response
        mock_get_code_mappings.return_value = [
            {"provider": "github", "owner": "test", "name": "repo"}
        ]

        result = has_project_connected_repos(self.organization, self.project)

        assert result is True
        mock_get_code_mappings.assert_called_once()
        mock_cache.set.assert_called_once_with(
            f"seer-project-has-repos:{self.organization.id}:{self.project.id}",
            True,
            timeout=60 * 15,
        )

    @patch("sentry.seer.autofix.utils.cache")
    @patch("sentry.seer.autofix.utils.get_project_seer_preferences")
    def test_returns_cached_value_true(self, mock_get_preferences, mock_cache):
        """Test returns cached True value without calling API."""
        mock_cache.get.return_value = True

        result = has_project_connected_repos(self.organization, self.project)

        assert result is True
        mock_get_preferences.assert_not_called()
        mock_cache.set.assert_not_called()

    @patch("sentry.seer.autofix.utils.cache")
    @patch("sentry.seer.autofix.utils.get_project_seer_preferences")
    def test_returns_cached_value_false(self, mock_get_preferences, mock_cache):
        """Test returns cached False value without calling API."""
        mock_cache.get.return_value = False

        result = has_project_connected_repos(self.organization, self.project)

        assert result is False
        mock_get_preferences.assert_not_called()
        mock_cache.set.assert_not_called()

    @patch("sentry.seer.autofix.utils.cache")
    @patch("sentry.seer.autofix.utils.get_project_seer_preferences")
    def test_skip_cache_bypasses_cached_value(self, mock_get_preferences, mock_cache):
        """Test skip_cache=True bypasses cache and calls API."""
        mock_cache.get.return_value = False  # Cache has False
        mock_preference = Mock()
        mock_preference.repositories = [{"provider": "github", "owner": "test", "name": "repo"}]
        mock_response = Mock()
        mock_response.preference = mock_preference
        mock_get_preferences.return_value = mock_response

        result = has_project_connected_repos(self.organization, self.project, skip_cache=True)

        assert result is True  # Fresh value from API, not cached False
        mock_cache.get.assert_not_called()  # Cache not checked
        mock_get_preferences.assert_called_once()  # API was called
        mock_cache.set.assert_called_once()  # Cache still updated

    @patch("sentry.seer.autofix.utils.get_autofix_repos_from_project_code_mappings")
    @patch("sentry.seer.autofix.utils.cache")
    @patch("sentry.seer.autofix.utils.get_project_seer_preferences")
    def test_falls_back_to_code_mappings_on_api_error(
        self, mock_get_preferences, mock_cache, mock_get_code_mappings
    ):
        """Test falls back to code mappings when Seer API fails."""
        mock_cache.get.return_value = None
        mock_get_preferences.side_effect = SeerApiError("API Error", 500)
        mock_get_code_mappings.return_value = [
            {"provider": "github", "owner": "test", "name": "repo"}
        ]

        result = has_project_connected_repos(self.organization, self.project)

        assert result is True
        mock_get_code_mappings.assert_called_once()

    @with_feature("organizations:seer-project-settings-read-from-sentry")
    @patch("sentry.seer.autofix.utils.read_preference_from_sentry_db")
    @patch("sentry.seer.autofix.utils.get_project_seer_preferences")
    @patch("sentry.seer.autofix.utils.cache")
    def test_reads_from_sentry_db(self, mock_cache, mock_get_prefs, mock_read_db):
        """When feature flag enabled, reads preferences from Sentry DB instead of Seer API."""
        mock_cache.get.return_value = None
        mock_read_db.return_value = SeerProjectPreference(
            organization_id=self.organization.id,
            project_id=self.project.id,
            repositories=[
                SeerRepoDefinition(provider="github", owner="owner", name="repo", external_id="123")
            ],
        )

        result = has_project_connected_repos(self.organization, self.project)

        assert result is True
        mock_get_prefs.assert_not_called()
        mock_read_db.assert_called_once()
        mock_cache.set.assert_called_once_with(
            f"seer-project-has-repos:{self.organization.id}:{self.project.id}",
            True,
            timeout=60 * 15,
        )


class TestSetProjectSeerPreference(TestCase):
    """Test the set_project_seer_preference function."""

    def setUp(self) -> None:
        super().setUp()
        self.organization = self.create_organization()
        self.project = self.create_project(organization=self.organization)

    @patch("sentry.seer.autofix.utils.make_signed_seer_api_request")
    def test_set_project_seer_preference_success(self, mock_make_request):
        """Test set_project_seer_preference sends correct request."""
        mock_response = Mock()
        mock_response.status = 200
        mock_make_request.return_value = mock_response

        preference = SeerProjectPreference(
            organization_id=self.organization.id,
            project_id=self.project.id,
            repositories=[],
            automated_run_stopping_point="code_changes",
        )

        set_project_seer_preference(preference)

        mock_make_request.assert_called_once()
        call = mock_make_request.call_args
        assert call.args[1] == "/v1/project-preference/set"

        actual_body = orjson.loads(call.kwargs["body"])
        assert actual_body["preference"]["organization_id"] == self.organization.id
        assert actual_body["preference"]["project_id"] == self.project.id
        assert actual_body["preference"]["repositories"] == []
        assert actual_body["preference"]["automated_run_stopping_point"] == "code_changes"
        assert call.kwargs["timeout"] == 15

    @patch("sentry.seer.autofix.utils.make_signed_seer_api_request")
    def test_set_project_seer_preference_with_open_pr_stopping_point(self, mock_make_request):
        """Test set_project_seer_preference with open_pr stopping point."""
        mock_response = Mock()
        mock_response.status = 200
        mock_make_request.return_value = mock_response

        preference = SeerProjectPreference(
            organization_id=self.organization.id,
            project_id=self.project.id,
            repositories=[],
            automated_run_stopping_point="open_pr",
        )

        set_project_seer_preference(preference)

        call = mock_make_request.call_args
        actual_body = orjson.loads(call.kwargs["body"])
        assert actual_body["preference"]["automated_run_stopping_point"] == "open_pr"

    @patch("sentry.seer.autofix.utils.make_signed_seer_api_request")
    def test_set_project_seer_preference_http_error_raises(self, mock_make_request):
        """Test set_project_seer_preference raises on HTTP error status."""
        mock_response = Mock()
        mock_response.status = 500
        mock_response.data = b"Internal Server Error"
        mock_make_request.return_value = mock_response

        preference = SeerProjectPreference(
            organization_id=self.organization.id,
            project_id=self.project.id,
            repositories=[],
        )

        with pytest.raises(SeerApiError):
            set_project_seer_preference(preference)


class TestResolveRepositoryIds(TestCase):
    def setUp(self) -> None:
        super().setUp()
        self.organization = self.create_organization()
        self.project = self.create_project(organization=self.organization)
        self.repo_bare_provider = self.create_repo(
            project=self.project,
            provider="github",
            external_id="ext123",
            name="test-org/test-repo",
        )
        self.repo_prefixed_provider = self.create_repo(
            project=self.project,
            provider="integrations:github",
            external_id="ext456",
            name="test-org/test-repo-2",
        )

    def test_resolves_when_input_and_stored_providers_are_bare(self) -> None:
        preferences = [
            SeerProjectPreference(
                organization_id=self.organization.id,
                project_id=self.project.id,
                repositories=[
                    SeerRepoDefinition(
                        provider="github", external_id="ext123", owner="test-org", name="test-repo"
                    )
                ],
            )
        ]

        result = resolve_repository_ids(self.organization.id, preferences)

        assert result[0].repositories[0].repository_id == self.repo_bare_provider.id

    def test_resolves_when_input_and_stored_providers_are_prefixed(self) -> None:
        preferences = [
            SeerProjectPreference(
                organization_id=self.organization.id,
                project_id=self.project.id,
                repositories=[
                    SeerRepoDefinition(
                        provider="integrations:github",
                        external_id="ext456",
                        owner="test-org",
                        name="test-repo-2",
                    )
                ],
            )
        ]

        result = resolve_repository_ids(self.organization.id, preferences)

        assert result[0].repositories[0].repository_id == self.repo_prefixed_provider.id

    def test_resolves_when_input_provider_is_bare_and_stored_provider_is_prefixed(self) -> None:
        preferences = [
            SeerProjectPreference(
                organization_id=self.organization.id,
                project_id=self.project.id,
                repositories=[
                    SeerRepoDefinition(
                        provider="github",
                        external_id="ext456",
                        owner="test-org",
                        name="test-repo-2",
                    )
                ],
            )
        ]

        result = resolve_repository_ids(self.organization.id, preferences)

        assert result[0].repositories[0].repository_id == self.repo_prefixed_provider.id

    def test_resolves_when_input_provider_is_prefixed_and_stored_provider_is_bare(self) -> None:
        preferences = [
            SeerProjectPreference(
                organization_id=self.organization.id,
                project_id=self.project.id,
                repositories=[
                    SeerRepoDefinition(
                        provider="integrations:github",
                        external_id="ext123",
                        owner="test-org",
                        name="test-repo",
                    )
                ],
            ),
        ]

        result = resolve_repository_ids(self.organization.id, preferences)

        assert result[0].repositories[0].repository_id == self.repo_bare_provider.id

    def test_skips_unresolvable_repos(self) -> None:
        """Repos with empty provider, empty external_id, existing repository_id, or inactive status are skipped."""
        from sentry.constants import ObjectStatus

        inactive_repo = self.create_repo(
            project=self.project,
            provider="integrations:github",
            external_id="ext_inactive",
            name="test-org/inactive-repo",
        )
        inactive_repo.status = ObjectStatus.HIDDEN
        inactive_repo.save()

        preferences = [
            SeerProjectPreference(
                organization_id=self.organization.id,
                project_id=self.project.id,
                repositories=[
                    SeerRepoDefinition(
                        provider="github",
                        external_id="ext123",
                        owner="test-org",
                        name="test-repo",
                        repository_id=999,
                    ),
                    SeerRepoDefinition(
                        provider="github",
                        external_id="ext_inactive",
                        owner="test-org",
                        name="inactive-repo",
                    ),
                    SeerRepoDefinition(
                        provider="github", external_id="nonexistent", owner="test-org", name="nope"
                    ),
                ],
            )
        ]

        result = resolve_repository_ids(self.organization.id, preferences)

        repos = result[0].repositories
        assert repos[0].repository_id == 999  # existing id preserved
        assert repos[1].repository_id is None  # inactive repo
        assert repos[2].repository_id is None  # nonexistent external_id


class TestDeduplicateRepositories(TestCase):
    def test_keys_by_provider_and_external_id(self) -> None:
        repositories: list[dict[str, Any]] = [
            {
                "provider": "github",
                "owner": "test-org",
                "name": "test-repo",
                "external_id": "ext123",
                "organization_id": None,
            },
            {
                "provider": "github",
                "owner": "test-org",
                "name": "test-repo",
                "external_id": "ext123",
                "organization_id": 42,
            },
        ]

        result = deduplicate_repositories(repositories)

        assert result == [
            {
                "provider": "github",
                "owner": "test-org",
                "name": "test-repo",
                "external_id": "ext123",
                "organization_id": None,
            }
        ]

    def test_also_keys_by_org_id(self) -> None:
        repositories: list[dict[str, Any]] = [
            {
                "provider": "github",
                "owner": "test-org",
                "name": "test-repo",
                "external_id": "ext123",
                "organization_id": None,
            },
            {
                "provider": "github",
                "owner": "test-org",
                "name": "test-repo",
                "external_id": "ext123",
                "organization_id": 42,
            },
        ]

        result = deduplicate_repositories(repositories, key_by_org_id=True)

        assert result == [
            {
                "provider": "github",
                "owner": "test-org",
                "name": "test-repo",
                "external_id": "ext123",
                "organization_id": None,
            },
            {
                "provider": "github",
                "owner": "test-org",
                "name": "test-repo",
                "external_id": "ext123",
                "organization_id": 42,
            },
        ]

    def test_normalizes_provider_alias_in_key(self) -> None:
        repositories: list[dict[str, Any]] = [
            {
                "provider": "github",
                "owner": "test-org",
                "name": "test-repo",
                "external_id": "ext123",
            },
            {
                "provider": "integrations:github",
                "owner": "test-org",
                "name": "test-repo",
                "external_id": "ext123",
            },
        ]

        result = deduplicate_repositories(repositories)

        assert result == [
            {
                "provider": "github",
                "owner": "test-org",
                "name": "test-repo",
                "external_id": "ext123",
            }
        ]


class TestWritePreferencesToSentryDb(TestCase):
    """Tests for _write_preferences_to_sentry_db via write_preference_to_sentry_db
    and bulk_write_preferences_to_sentry_db."""

    def setUp(self) -> None:
        super().setUp()
        self.organization = self.create_organization()
        self.project = self.create_project(organization=self.organization)
        self.repo = self.create_repo(
            project=self.project,
            provider="integrations:github",
            external_id="ext123",
            name="test-org/test-repo",
        )

    def test_writes_project_options(self) -> None:
        preference = SeerProjectPreference(
            organization_id=self.organization.id,
            project_id=self.project.id,
            repositories=[],
            automated_run_stopping_point="open_pr",
            automation_handoff=SeerAutomationHandoffConfiguration(
                handoff_point="root_cause",
                target="cursor_background_agent",
                integration_id=42,
                auto_create_pr=True,
            ),
        )

        write_preference_to_sentry_db(self.project, preference)

        assert self.project.get_option("sentry:seer_automated_run_stopping_point") == "open_pr"
        assert self.project.get_option("sentry:seer_automation_handoff_point") == "root_cause"
        assert (
            self.project.get_option("sentry:seer_automation_handoff_target")
            == "cursor_background_agent"
        )
        assert self.project.get_option("sentry:seer_automation_handoff_integration_id") == 42
        assert self.project.get_option("sentry:seer_automation_handoff_auto_create_pr") is True
        assert SeerProjectRepository.objects.filter(project=self.project).count() == 0

    def test_deletes_project_options_when_defaults(self) -> None:
        preference = SeerProjectPreference(
            organization_id=self.organization.id, project_id=self.project.id, repositories=[]
        )

        write_preference_to_sentry_db(self.project, preference)

        assert self.project.get_option("sentry:seer_automated_run_stopping_point") == "code_changes"
        assert self.project.get_option("sentry:seer_automation_handoff_point") is None
        assert self.project.get_option("sentry:seer_automation_handoff_target") is None
        assert self.project.get_option("sentry:seer_automation_handoff_integration_id") is None
        assert self.project.get_option("sentry:seer_automation_handoff_auto_create_pr") is False

    def test_creates_seer_project_repository_with_branch_overrides(self) -> None:
        preference = SeerProjectPreference(
            organization_id=self.organization.id,
            project_id=self.project.id,
            repositories=[
                SeerRepoDefinition(
                    repository_id=self.repo.id,
                    provider="github",
                    owner="test-org",
                    name="test-repo",
                    external_id="ext123",
                    branch_name="develop",
                    instructions="Use conventional commits",
                    branch_overrides=[
                        BranchOverride(
                            tag_name="environment",
                            tag_value="production",
                            branch_name="main",
                        ),
                        BranchOverride(
                            tag_name="environment",
                            tag_value="staging",
                            branch_name="staging",
                        ),
                    ],
                ),
            ],
        )

        write_preference_to_sentry_db(self.project, preference)

        seer_repo = SeerProjectRepository.objects.get(project=self.project)
        assert seer_repo.repository_id == self.repo.id
        assert seer_repo.branch_name == "develop"
        assert seer_repo.instructions == "Use conventional commits"

        overrides = SeerProjectRepositoryBranchOverride.objects.filter(
            seer_project_repository=seer_repo
        ).order_by("tag_value")
        assert len(overrides) == 2
        assert overrides[0].tag_name == "environment"
        assert overrides[0].tag_value == "production"
        assert overrides[0].branch_name == "main"
        assert overrides[1].tag_name == "environment"
        assert overrides[1].tag_value == "staging"
        assert overrides[1].branch_name == "staging"

    def test_replaces_existing_preference_on_write(self) -> None:
        preference_to_replace = SeerProjectPreference(
            organization_id=self.organization.id,
            project_id=self.project.id,
            repositories=[
                SeerRepoDefinition(
                    repository_id=self.repo.id,
                    provider="github",
                    owner="test-org",
                    name="test-repo",
                    external_id="ext123",
                    branch_overrides=[
                        BranchOverride(
                            tag_name="environment",
                            tag_value="production",
                            branch_name="main",
                        ),
                    ],
                ),
            ],
        )
        write_preference_to_sentry_db(self.project, preference_to_replace)

        assert SeerProjectRepository.objects.filter(project=self.project).count() == 1
        assert (
            SeerProjectRepositoryBranchOverride.objects.filter(
                seer_project_repository__project=self.project
            ).count()
            == 1
        )

        # Replace with a different repo, no overrides
        repo2 = self.create_repo(
            project=self.project,
            provider="integrations:github",
            external_id="ext456",
            name="test-org/other-repo",
        )
        new_preference = SeerProjectPreference(
            organization_id=self.organization.id,
            project_id=self.project.id,
            repositories=[
                SeerRepoDefinition(
                    repository_id=repo2.id,
                    provider="github",
                    owner="test-org",
                    name="other-repo",
                    external_id="ext456",
                ),
            ],
        )
        write_preference_to_sentry_db(self.project, new_preference)

        repos = SeerProjectRepository.objects.filter(project=self.project)
        assert len(repos) == 1
        assert repos[0].repository_id == repo2.id
        assert (
            SeerProjectRepositoryBranchOverride.objects.filter(
                seer_project_repository__project=self.project
            ).count()
            == 0
        )

    def test_multiple_repos_for_one_project(self) -> None:
        repo2 = self.create_repo(
            project=self.project,
            provider="integrations:github",
            external_id="ext456",
            name="test-org/other-repo",
        )

        preference = SeerProjectPreference(
            organization_id=self.organization.id,
            project_id=self.project.id,
            repositories=[
                SeerRepoDefinition(
                    repository_id=self.repo.id,
                    provider="github",
                    owner="test-org",
                    name="test-repo",
                    external_id="ext123",
                    branch_name="develop",
                ),
                SeerRepoDefinition(
                    repository_id=repo2.id,
                    provider="github",
                    owner="test-org",
                    name="other-repo",
                    external_id="ext456",
                    instructions="Deploy carefully",
                ),
            ],
        )

        write_preference_to_sentry_db(self.project, preference)

        repos = SeerProjectRepository.objects.filter(project=self.project).order_by("repository_id")
        assert len(repos) == 2
        assert repos[0].repository_id == self.repo.id
        assert repos[0].branch_name == "develop"
        assert repos[1].repository_id == repo2.id
        assert repos[1].instructions == "Deploy carefully"

    def test_bulk_write_multiple_projects(self) -> None:
        project2 = self.create_project(organization=self.organization)
        repo2 = self.create_repo(
            project=project2,
            provider="integrations:github",
            external_id="ext456",
            name="test-org/other-repo",
        )

        preferences = [
            SeerProjectPreference(
                organization_id=self.organization.id,
                project_id=self.project.id,
                repositories=[
                    SeerRepoDefinition(
                        repository_id=self.repo.id,
                        provider="github",
                        owner="test-org",
                        name="test-repo",
                        external_id="ext123",
                        branch_name="develop",
                    ),
                ],
                automated_run_stopping_point="open_pr",
            ),
            SeerProjectPreference(
                organization_id=self.organization.id,
                project_id=project2.id,
                repositories=[
                    SeerRepoDefinition(
                        repository_id=repo2.id,
                        provider="github",
                        owner="test-org",
                        name="other-repo",
                        external_id="ext456",
                        instructions="Be careful",
                    ),
                ],
                automated_run_stopping_point="code_changes",
            ),
        ]

        bulk_write_preferences_to_sentry_db([self.project, project2], preferences)

        p1_repos = SeerProjectRepository.objects.filter(project=self.project)
        assert len(p1_repos) == 1
        assert p1_repos[0].repository_id == self.repo.id
        assert p1_repos[0].branch_name == "develop"
        assert self.project.get_option("sentry:seer_automated_run_stopping_point") == "open_pr"

        p2_repos = SeerProjectRepository.objects.filter(project=project2)
        assert len(p2_repos) == 1
        assert p2_repos[0].repository_id == repo2.id
        assert p2_repos[0].instructions == "Be careful"
        assert project2.get_option("sentry:seer_automated_run_stopping_point") == "code_changes"

    def test_bulk_write_replaces_per_project(self) -> None:
        project2 = self.create_project(organization=self.organization)
        repo2 = self.create_repo(
            project=project2,
            provider="integrations:github",
            external_id="ext456",
            name="test-org/other-repo",
        )

        SeerProjectRepository.objects.create(
            project=self.project, repository_id=self.repo.id, branch_name="project-1-branch"
        )
        SeerProjectRepository.objects.create(
            project=project2, repository_id=repo2.id, branch_name="project-2-branch"
        )

        bulk_write_preferences_to_sentry_db(
            [self.project, project2],
            [
                SeerProjectPreference(
                    organization_id=self.organization.id,
                    project_id=self.project.id,
                    repositories=[
                        SeerRepoDefinition(
                            repository_id=self.repo.id,
                            provider="github",
                            owner="test-org",
                            name="test-repo",
                            external_id="ext123",
                            branch_name="new-branch",
                        ),
                    ],
                ),
            ],
        )

        # When bulk writing, existing repos for included projects are replaced,
        # but repos for projects NOT in the preferences list are untouched.
        p1_repo = SeerProjectRepository.objects.get(project=self.project)
        assert p1_repo.branch_name == "new-branch"
        p2_repo = SeerProjectRepository.objects.get(project=project2)
        assert p2_repo.branch_name == "project-2-branch"


class TestReadPreferenceFromSentryDb(TestCase):
    def setUp(self):
        super().setUp()
        self.organization = self.create_organization()
        self.project = self.create_project(organization=self.organization)
        self.repo = self.create_repo(
            project=self.project,
            provider="integrations:github",
            external_id="ext123",
            name="test-org/test-repo",
        )
        self.repo2 = self.create_repo(
            project=self.project,
            provider="integrations:github",
            external_id="ext456",
            name="test-org/other-repo",
        )

    def test_unconfigured_project_returns_none(self):
        result = read_preference_from_sentry_db(self.project)
        assert result is None

    def test_project_with_repos_only(self):
        spr = SeerProjectRepository.objects.create(
            project=self.project,
            repository=self.repo,
            branch_name="main",
            instructions="Be helpful",
        )
        SeerProjectRepositoryBranchOverride.objects.create(
            seer_project_repository=spr,
            tag_name="environment",
            tag_value="production",
            branch_name="release",
        )
        SeerProjectRepository.objects.create(
            project=self.project,
            repository=self.repo2,
            branch_name="develop",
        )

        result = read_preference_from_sentry_db(self.project)
        assert result is not None
        assert result.project_id == self.project.id
        assert result.organization_id == self.organization.id
        assert len(result.repositories) == 2
        repo_by_name = {r.name: r for r in result.repositories}
        assert repo_by_name["test-repo"].owner == "test-org"
        assert repo_by_name["test-repo"].branch_name == "main"
        assert repo_by_name["test-repo"].instructions == "Be helpful"
        assert len(repo_by_name["test-repo"].branch_overrides) == 1
        assert repo_by_name["test-repo"].branch_overrides[0].tag_name == "environment"
        assert repo_by_name["test-repo"].branch_overrides[0].tag_value == "production"
        assert repo_by_name["test-repo"].branch_overrides[0].branch_name == "release"
        assert repo_by_name["other-repo"].owner == "test-org"
        assert repo_by_name["other-repo"].branch_name == "develop"
        assert repo_by_name["other-repo"].instructions is None
        assert repo_by_name["other-repo"].branch_overrides == []
        assert result.automated_run_stopping_point == "code_changes"
        assert result.automation_handoff is None

    def test_project_with_stopping_point_only(self):
        self.project.update_option("sentry:seer_automated_run_stopping_point", "open_pr")

        result = read_preference_from_sentry_db(self.project)
        assert result is not None
        assert result.automated_run_stopping_point == "open_pr"
        assert result.repositories == []
        assert result.automation_handoff is None

    def test_project_with_handoff_only(self):
        self.project.update_option("sentry:seer_automation_handoff_point", "root_cause")
        self.project.update_option(
            "sentry:seer_automation_handoff_target", "cursor_background_agent"
        )
        self.project.update_option("sentry:seer_automation_handoff_integration_id", 42)
        self.project.update_option("sentry:seer_automation_handoff_auto_create_pr", True)

        result = read_preference_from_sentry_db(self.project)
        assert result is not None
        assert result.automation_handoff is not None
        assert result.automation_handoff.handoff_point == "root_cause"
        assert result.automation_handoff.target == "cursor_background_agent"
        assert result.automation_handoff.integration_id == 42
        assert result.automation_handoff.auto_create_pr is True

    def test_project_with_repos_and_options(self):
        SeerProjectRepository.objects.create(
            project=self.project,
            repository=self.repo,
            branch_name="main",
        )
        SeerProjectRepository.objects.create(
            project=self.project,
            repository=self.repo2,
            branch_name="develop",
        )
        self.project.update_option("sentry:seer_automated_run_stopping_point", "open_pr")
        self.project.update_option("sentry:seer_automation_handoff_point", "root_cause")
        self.project.update_option(
            "sentry:seer_automation_handoff_target", "cursor_background_agent"
        )
        self.project.update_option("sentry:seer_automation_handoff_integration_id", 42)

        result = read_preference_from_sentry_db(self.project)
        assert result is not None
        assert len(result.repositories) == 2
        assert result.automated_run_stopping_point == "open_pr"
        assert result.automation_handoff is not None
        assert result.automation_handoff.handoff_point == "root_cause"
        assert result.automation_handoff.target == "cursor_background_agent"
        assert result.automation_handoff.integration_id == 42
        assert result.automation_handoff.auto_create_pr is False

    def test_excludes_other_projects_data(self):
        other_project = self.create_project(organization=self.organization)
        other_repo = self.create_repo(
            project=other_project,
            provider="integrations:github",
            external_id="ext789",
            name="test-org/other-project-repo",
        )
        SeerProjectRepository.objects.create(
            project=other_project, repository=other_repo, branch_name="main"
        )
        other_project.update_option("sentry:seer_automated_run_stopping_point", "open_pr")

        SeerProjectRepository.objects.create(
            project=self.project, repository=self.repo, branch_name="develop"
        )
        self.project.update_option("sentry:seer_automated_run_stopping_point", "root_cause")

        result = read_preference_from_sentry_db(self.project)
        assert result is not None
        assert len(result.repositories) == 1
        assert result.repositories[0].name == "test-repo"
        assert result.automated_run_stopping_point == "root_cause"

    def test_partial_handoff_returns_none_handoff(self):
        self.project.update_option("sentry:seer_automation_handoff_point", "root_cause")

        result = read_preference_from_sentry_db(self.project)
        assert result is not None
        assert result.automation_handoff is None

    def test_invalid_repo_name_is_skipped(self):
        bad_repo = self.create_repo(
            project=self.project,
            provider="integrations:github",
            external_id="ext_bad",
            name="no-slash-repo",
        )
        SeerProjectRepository.objects.create(
            project=self.project, repository=bad_repo, branch_name="main"
        )
        SeerProjectRepository.objects.create(
            project=self.project, repository=self.repo, branch_name="main"
        )

        result = read_preference_from_sentry_db(self.project)
        assert result is not None
        assert len(result.repositories) == 1
        assert result.repositories[0].name == "test-repo"


class TestBulkReadPreferencesFromSentryDb(TestCase):
    def setUp(self):
        super().setUp()
        self.organization = self.create_organization()
        self.project1 = self.create_project(organization=self.organization)
        self.project2 = self.create_project(organization=self.organization)
        self.project3 = self.create_project(organization=self.organization)
        self.repo = self.create_repo(
            project=self.project1,
            provider="integrations:github",
            external_id="ext123",
            name="test-org/test-repo",
        )
        self.repo2 = self.create_repo(
            project=self.project1,
            provider="integrations:github",
            external_id="ext456",
            name="test-org/other-repo",
        )

    def test_empty_project_ids_returns_empty(self):
        result = bulk_read_preferences_from_sentry_db(self.organization.id, [])
        assert result == {}

    def test_unconfigured_project_returns_none(self):
        result = bulk_read_preferences_from_sentry_db(self.organization.id, [self.project1.id])
        assert result == {self.project1.id: None}

    def test_bulk_returns_correct_preferences(self):
        SeerProjectRepository.objects.create(
            project=self.project1, repository=self.repo, branch_name="main"
        )
        SeerProjectRepository.objects.create(
            project=self.project1, repository=self.repo2, branch_name="develop"
        )
        self.project2.update_option("sentry:seer_automated_run_stopping_point", "open_pr")
        self.project2.update_option("sentry:seer_automation_handoff_point", "root_cause")
        self.project2.update_option(
            "sentry:seer_automation_handoff_target", "cursor_background_agent"
        )
        self.project2.update_option("sentry:seer_automation_handoff_integration_id", 99)

        result = bulk_read_preferences_from_sentry_db(
            self.organization.id,
            [self.project1.id, self.project2.id],
        )

        pref1 = result[self.project1.id]
        assert pref1 is not None
        assert len(pref1.repositories) == 2
        assert {r.branch_name for r in pref1.repositories} == {"main", "develop"}
        assert pref1.automated_run_stopping_point == "code_changes"
        assert pref1.automation_handoff is None

        pref2 = result[self.project2.id]
        assert pref2 is not None
        assert pref2.repositories == []
        assert pref2.automated_run_stopping_point == "open_pr"
        assert pref2.automation_handoff is not None
        assert pref2.automation_handoff.handoff_point == "root_cause"
        assert pref2.automation_handoff.target == "cursor_background_agent"
        assert pref2.automation_handoff.integration_id == 99
        assert pref2.automation_handoff.auto_create_pr is False

    def test_wrong_organization_excluded(self):
        other_org = self.create_organization()
        SeerProjectRepository.objects.create(
            project=self.project1, repository=self.repo, branch_name="main"
        )

        result = bulk_read_preferences_from_sentry_db(other_org.id, [self.project1.id])
        assert result == {}


class TestGetOrgDefaultSeerAutomationHandoff(TestCase):
    def test_defaults(self):
        stopping_point, handoff = get_org_default_seer_automation_handoff(self.organization)
        assert stopping_point == "code_changes"
        assert handoff is None

    def test_respects_org_stopping_point_option(self):
        self.organization.update_option("sentry:default_automated_run_stopping_point", "open_pr")
        self.organization.update_option("sentry:auto_open_prs", True)

        stopping_point, handoff = get_org_default_seer_automation_handoff(self.organization)
        assert stopping_point == "open_pr"
        assert handoff is None

    def test_seer_agent_auto_open_prs_forces_open_pr(self):
        self.organization.update_option(
            "sentry:default_automated_run_stopping_point", "code_changes"
        )
        self.organization.update_option("sentry:auto_open_prs", True)

        stopping_point, handoff = get_org_default_seer_automation_handoff(self.organization)
        assert stopping_point == "open_pr"
        assert handoff is None

    def test_seer_agent_no_auto_open_prs_caps_open_pr_to_code_changes(self):
        self.organization.update_option("sentry:default_automated_run_stopping_point", "open_pr")

        stopping_point, handoff = get_org_default_seer_automation_handoff(self.organization)
        assert stopping_point == "code_changes"
        assert handoff is None

    def test_external_agent_returns_handoff_config(self):
        self.organization.update_option(
            "sentry:seer_default_coding_agent", "cursor_background_agent"
        )
        self.organization.update_option("sentry:seer_default_coding_agent_integration_id", 42)

        stopping_point, handoff = get_org_default_seer_automation_handoff(self.organization)
        assert stopping_point == "code_changes"
        assert handoff is not None
        assert handoff.handoff_point == "root_cause"
        assert handoff.target == "cursor_background_agent"
        assert handoff.integration_id == 42
        assert handoff.auto_create_pr is False

    def test_external_agent_auto_open_prs_sets_auto_create_pr(self):
        self.organization.update_option("sentry:seer_default_coding_agent", "claude_code_agent")
        self.organization.update_option("sentry:seer_default_coding_agent_integration_id", 99)
        self.organization.update_option("sentry:auto_open_prs", True)

        stopping_point, handoff = get_org_default_seer_automation_handoff(self.organization)
        assert handoff is not None
        assert handoff.auto_create_pr is True

    def test_external_agent_auto_open_prs_does_not_override_stopping_point(self):
        self.organization.update_option(
            "sentry:default_automated_run_stopping_point", "code_changes"
        )
        self.organization.update_option("sentry:auto_open_prs", True)
        self.organization.update_option(
            "sentry:seer_default_coding_agent", "cursor_background_agent"
        )
        self.organization.update_option("sentry:seer_default_coding_agent_integration_id", 42)

        stopping_point, handoff = get_org_default_seer_automation_handoff(self.organization)
        assert stopping_point == "code_changes"
        assert handoff is not None

    def test_external_agent_without_integration_id_falls_back_to_seer(self):
        self.organization.update_option(
            "sentry:seer_default_coding_agent", "cursor_background_agent"
        )
        self.organization.update_option("sentry:auto_open_prs", True)

        stopping_point, handoff = get_org_default_seer_automation_handoff(self.organization)
        assert stopping_point == "open_pr"
        assert handoff is None

    def test_seer_coding_agent_treated_as_no_external_agent(self):
        self.organization.update_option("sentry:seer_default_coding_agent", "seer")
        self.organization.update_option("sentry:seer_default_coding_agent_integration_id", 42)
        self.organization.update_option("sentry:auto_open_prs", True)

        stopping_point, handoff = get_org_default_seer_automation_handoff(self.organization)
        assert stopping_point == "open_pr"
        assert handoff is None

    def test_invalid_stopping_point_falls_back_to_default(self):
        self.organization.update_option(
            "sentry:default_automated_run_stopping_point", "invalid_point"
        )
        stopping_point, _ = get_org_default_seer_automation_handoff(self.organization)
        assert stopping_point == SEER_AUTOMATED_RUN_STOPPING_POINT_DEFAULT
