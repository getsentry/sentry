from unittest.mock import Mock, patch

import orjson
import pytest

from sentry.constants import DataCategory
from sentry.seer.autofix.constants import AutofixStatus
from sentry.seer.autofix.utils import (
    AutofixState,
    AutofixTriggerSource,
    CodingAgentStatus,
    get_autofix_prompt,
    get_coding_agent_prompt,
    has_project_connected_repos,
    is_issue_eligible_for_seer_automation,
    is_seer_seat_based_tier_enabled,
    set_project_seer_preference,
)
from sentry.seer.models import SeerApiError, SeerProjectPreference
from sentry.testutils.cases import TestCase
from sentry.utils.cache import cache


class TestGetAutofixPrompt(TestCase):
    def setUp(self):
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
        assert "Include 'Fixes AIML-2301' in the pull request description" in result
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
    def test_autofix_state_validate_parses_nested_structures(self):
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

    def setUp(self):
        super().setUp()
        self.organization = self.create_organization(name="test-org")
        self.project = self.create_project(organization=self.organization)
        self.group = self.create_group(project=self.project)

    def test_returns_false_for_unsupported_issue_categories(self):
        """Test returns False for unsupported issue categories like REPLAY and FEEDBACK."""
        from sentry.issues.grouptype import FeedbackGroup, ReplayRageClickType

        # Create groups with unsupported categories
        replay_group = self.create_group(project=self.project, type=ReplayRageClickType.type_id)
        feedback_group = self.create_group(project=self.project, type=FeedbackGroup.type_id)

        assert is_issue_eligible_for_seer_automation(replay_group) is False
        assert is_issue_eligible_for_seer_automation(feedback_group) is False

    def test_returns_true_for_supported_issue_categories(self):
        """Test returns True for supported issue categories when all conditions are met."""
        with self.feature("organizations:gen-ai-features"):
            with patch(
                "sentry.seer.seer_setup.get_seer_org_acknowledgement_for_scanner"
            ) as mock_ack:
                with patch("sentry.quotas.backend.check_seer_quota") as mock_budget:
                    mock_ack.return_value = True
                    mock_budget.return_value = True
                    self.project.update_option("sentry:seer_scanner_automation", True)

                    # Test supported categories - using default error group
                    result = is_issue_eligible_for_seer_automation(self.group)

                    assert result is True

    def test_returns_false_when_gen_ai_features_not_enabled(self):
        """Test returns False when organizations:gen-ai-features feature flag is not enabled."""
        result = is_issue_eligible_for_seer_automation(self.group)
        assert result is False

    def test_returns_false_when_ai_features_hidden(self):
        """Test returns False when sentry:hide_ai_features option is enabled."""
        with self.feature("organizations:gen-ai-features"):
            self.organization.update_option("sentry:hide_ai_features", True)
            result = is_issue_eligible_for_seer_automation(self.group)
            assert result is False

    def test_returns_false_when_scanner_automation_disabled_and_not_always_trigger(self):
        """Test returns False when scanner automation is disabled and issue type doesn't always trigger."""
        with self.feature("organizations:gen-ai-features"):
            self.project.update_option("sentry:seer_scanner_automation", False)
            result = is_issue_eligible_for_seer_automation(self.group)
            assert result is False

    @patch("sentry.seer.seer_setup.get_seer_org_acknowledgement_for_scanner")
    def test_returns_false_when_org_not_acknowledged(self, mock_get_acknowledgement):
        """Test returns False when organization has not acknowledged Seer for scanner."""
        with self.feature("organizations:gen-ai-features"):
            self.project.update_option("sentry:seer_scanner_automation", True)
            mock_get_acknowledgement.return_value = False

            result = is_issue_eligible_for_seer_automation(self.group)

            assert result is False
            mock_get_acknowledgement.assert_called_once_with(self.organization)

    @patch("sentry.seer.seer_setup.get_seer_org_acknowledgement_for_scanner")
    @patch("sentry.quotas.backend.check_seer_quota")
    def test_returns_false_when_no_budget_available(
        self, mock_has_budget, mock_get_acknowledgement
    ):
        """Test returns False when organization has no available budget for scanner."""
        with self.feature("organizations:gen-ai-features"):
            self.project.update_option("sentry:seer_scanner_automation", True)
            mock_get_acknowledgement.return_value = True
            mock_has_budget.return_value = False

            result = is_issue_eligible_for_seer_automation(self.group)

            assert result is False
            mock_has_budget.assert_called_once_with(
                org_id=self.organization.id, data_category=DataCategory.SEER_SCANNER
            )

    @patch("sentry.seer.seer_setup.get_seer_org_acknowledgement_for_scanner")
    @patch("sentry.quotas.backend.check_seer_quota")
    def test_returns_true_when_all_conditions_met(self, mock_has_budget, mock_get_acknowledgement):
        """Test returns True when all eligibility conditions are met."""
        with self.feature("organizations:gen-ai-features"):
            self.project.update_option("sentry:seer_scanner_automation", True)
            mock_get_acknowledgement.return_value = True
            mock_has_budget.return_value = True

            result = is_issue_eligible_for_seer_automation(self.group)

            assert result is True
            mock_get_acknowledgement.assert_called_once_with(self.organization)
            mock_has_budget.assert_called_once_with(
                org_id=self.organization.id, data_category=DataCategory.SEER_SCANNER
            )

    @patch("sentry.seer.seer_setup.get_seer_org_acknowledgement_for_scanner")
    @patch("sentry.quotas.backend.check_seer_quota")
    def test_returns_true_when_issue_type_always_triggers(
        self, mock_has_budget, mock_get_acknowledgement
    ):
        """Test returns True when issue type has always_trigger_seer_automation even if scanner automation is disabled."""
        with self.feature("organizations:gen-ai-features"):
            # Disable scanner automation
            self.project.update_option("sentry:seer_scanner_automation", False)
            mock_get_acknowledgement.return_value = True
            mock_has_budget.return_value = True

            # Mock the group's issue_type to always trigger
            with patch.object(self.group.issue_type, "always_trigger_seer_automation", True):
                result = is_issue_eligible_for_seer_automation(self.group)

                assert result is True


class TestIsSeerSeatBasedTierEnabled(TestCase):
    """Test the is_seer_seat_based_tier_enabled function."""

    def setUp(self):
        super().setUp()
        self.organization = self.create_organization(name="test-org")

    def tearDown(self):
        super().tearDown()
        cache.delete(f"seer:seat-based-tier:{self.organization.id}")

    def test_returns_true_when_triage_signals_enabled(self):
        """Test returns True when triage-signals-v0-org feature flag is enabled."""
        with self.feature("organizations:triage-signals-v0-org"):
            result = is_seer_seat_based_tier_enabled(self.organization)
            assert result is True

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

    def test_returns_false_when_no_flags_enabled(self):
        """Test returns False when neither feature flag is enabled and caches the result."""
        result = is_seer_seat_based_tier_enabled(self.organization)
        assert result is False

        # Verify False was cached
        cache_key = f"seer:seat-based-tier:{self.organization.id}"
        assert cache.get(cache_key) is False

    def test_returns_cached_value(self):
        """Test returns cached value without checking feature flags."""
        cache_key = f"seer:seat-based-tier:{self.organization.id}"
        cache.set(cache_key, True, timeout=60)

        # Even without feature flags enabled, should return cached True
        result = is_seer_seat_based_tier_enabled(self.organization)
        assert result is True


class TestHasProjectConnectedRepos(TestCase):
    """Test the has_project_connected_repos function."""

    def setUp(self):
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

        result = has_project_connected_repos(self.organization.id, self.project.id)

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

        result = has_project_connected_repos(self.organization.id, self.project.id)

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

        result = has_project_connected_repos(self.organization.id, self.project.id)

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

        result = has_project_connected_repos(self.organization.id, self.project.id)

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

        result = has_project_connected_repos(self.organization.id, self.project.id)

        assert result is True
        mock_get_preferences.assert_not_called()
        mock_cache.set.assert_not_called()

    @patch("sentry.seer.autofix.utils.cache")
    @patch("sentry.seer.autofix.utils.get_project_seer_preferences")
    def test_returns_cached_value_false(self, mock_get_preferences, mock_cache):
        """Test returns cached False value without calling API."""
        mock_cache.get.return_value = False

        result = has_project_connected_repos(self.organization.id, self.project.id)

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

        result = has_project_connected_repos(self.organization.id, self.project.id, skip_cache=True)

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

        result = has_project_connected_repos(self.organization.id, self.project.id)

        assert result is True
        mock_get_code_mappings.assert_called_once()


class TestSetProjectSeerPreference(TestCase):
    """Test the set_project_seer_preference function."""

    def setUp(self):
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
