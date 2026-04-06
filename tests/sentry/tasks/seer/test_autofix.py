from datetime import datetime, timedelta
from unittest.mock import MagicMock, patch

import pytest
from django.test import TestCase

from sentry.constants import SEER_AUTOMATED_RUN_STOPPING_POINT_DEFAULT
from sentry.models.repository import Repository
from sentry.seer.autofix.constants import AutofixStatus, SeerAutomationSource
from sentry.seer.autofix.utils import AutofixState, get_seer_seat_based_tier_cache_key
from sentry.seer.models import SeerApiError, SummarizeIssueResponse, SummarizeIssueScores
from sentry.seer.models.project_repository import SeerProjectRepository
from sentry.tasks.seer.autofix import (
    check_autofix_status,
    configure_seer_for_existing_org,
    generate_issue_summary_only,
)
from sentry.testutils.cases import TestCase as SentryTestCase
from sentry.utils.cache import cache


class TestCheckAutofixStatus(TestCase):
    @patch("sentry.tasks.seer.autofix.get_autofix_state")
    @patch("sentry.tasks.seer.autofix.logger.error")
    def test_check_autofix_status_processing_too_long(
        self, mock_logger: MagicMock, mock_get_autofix_state: MagicMock
    ) -> None:
        # Mock the get_autofix_state function to return a state that's been processing for too long
        mock_get_autofix_state.return_value = AutofixState(
            run_id=123,
            request={
                "project_id": 456,
                "organization_id": 789,
                "issue": {"id": 789, "title": "Test Issue"},
                "repos": [],
            },
            updated_at=datetime.now() - timedelta(minutes=10),  # Naive datetime
            status=AutofixStatus.PROCESSING,
        )

        # Call the task
        check_autofix_status(123, 789)

        # Check that the logger.error was called
        mock_logger.assert_called_once_with(
            "Autofix run has been processing for more than 5 minutes", extra={"run_id": 123}
        )

    @patch("sentry.tasks.seer.autofix.get_autofix_state")
    @patch("sentry.tasks.seer.autofix.logger.error")
    def test_check_autofix_status_processing_within_time_limit(
        self, mock_logger, mock_get_autofix_state
    ):
        # Mock the get_autofix_state function to return a state that's still within the time limit
        mock_get_autofix_state.return_value = AutofixState(
            run_id=123,
            request={
                "project_id": 456,
                "organization_id": 789,
                "issue": {"id": 789, "title": "Test Issue"},
                "repos": [],
            },
            updated_at=datetime.now() - timedelta(minutes=3),  # Naive datetime
            status=AutofixStatus.PROCESSING,
        )

        # Call the task
        check_autofix_status(123, 789)

        # Check that the logger.error was not called
        mock_logger.assert_not_called()

    @patch("sentry.tasks.seer.autofix.get_autofix_state")
    @patch("sentry.tasks.seer.autofix.logger.error")
    def test_check_autofix_status_completed(
        self, mock_logger: MagicMock, mock_get_autofix_state: MagicMock
    ) -> None:
        # Mock the get_autofix_state function to return a completed state
        mock_get_autofix_state.return_value = AutofixState(
            run_id=123,
            request={
                "project_id": 456,
                "organization_id": 789,
                "issue": {"id": 789, "title": "Test Issue"},
                "repos": [],
            },
            updated_at=datetime.now() - timedelta(minutes=10),  # Naive datetime
            status=AutofixStatus.COMPLETED,
        )

        # Call the task
        check_autofix_status(123, 789)

        # Check that the logger.error was not called
        mock_logger.assert_not_called()

    @patch("sentry.tasks.seer.autofix.get_autofix_state")
    @patch("sentry.tasks.seer.autofix.logger.error")
    def test_check_autofix_status_no_state(
        self, mock_logger: MagicMock, mock_get_autofix_state: MagicMock
    ) -> None:
        # Mock the get_autofix_state function to return None (no state found)
        mock_get_autofix_state.return_value = None

        # Call the task
        check_autofix_status(123, 789)

        # Check that the logger.error was not called
        mock_logger.assert_not_called()


class TestGenerateIssueSummaryOnly(SentryTestCase):
    @patch("sentry.seer.autofix.issue_summary._generate_fixability_score")
    @patch("sentry.seer.autofix.issue_summary.get_issue_summary")
    def test_generates_fixability_score_after_summary(
        self, mock_get_issue_summary: MagicMock, mock_generate_fixability: MagicMock
    ) -> None:
        """Test that fixability score is generated after issue summary is fetched."""
        group = self.create_group(project=self.project)

        mock_get_issue_summary.return_value = (
            {
                "groupId": str(group.id),
                "headline": "Test Headline",
                "whatsWrong": "Test whats wrong",
                "trace": "Test trace",
                "possibleCause": "Test cause",
            },
            200,
        )
        mock_generate_fixability.return_value = SummarizeIssueResponse(
            group_id=str(group.id),
            headline="Test",
            whats_wrong="Test",
            trace="Test",
            possible_cause="Test",
            scores=SummarizeIssueScores(fixability_score=0.75),
        )

        generate_issue_summary_only(group.id)

        mock_get_issue_summary.assert_called_once_with(
            group=group, source=SeerAutomationSource.POST_PROCESS, should_run_automation=False
        )
        mock_generate_fixability.assert_called_once()

        group.refresh_from_db()
        assert group.seer_fixability_score == 0.75


class TestConfigureSeerForExistingOrg(SentryTestCase):
    @patch("sentry.tasks.seer.autofix.bulk_set_project_preferences")
    @patch("sentry.tasks.seer.autofix.bulk_get_project_preferences")
    def test_configures_org_and_project_settings(
        self, mock_bulk_get: MagicMock, mock_bulk_set: MagicMock
    ) -> None:
        """Test that org and project settings are configured correctly."""
        project1 = self.create_project(organization=self.organization)
        project2 = self.create_project(organization=self.organization)
        # Set to non-off value so we can verify it gets changed to medium
        project1.update_option("sentry:autofix_automation_tuning", "low")
        project2.update_option("sentry:autofix_automation_tuning", "high")

        mock_bulk_get.return_value = {}

        configure_seer_for_existing_org(organization_id=self.organization.id)

        # Check org-level options
        assert self.organization.get_option("sentry:default_autofix_automation_tuning") == "medium"

        # Check project-level options
        assert project1.get_option("sentry:seer_scanner_automation") is True
        assert project1.get_option("sentry:autofix_automation_tuning") == "medium"
        assert project2.get_option("sentry:seer_scanner_automation") is True
        assert project2.get_option("sentry:autofix_automation_tuning") == "medium"

        mock_bulk_get.assert_called_once()
        mock_bulk_set.assert_called_once()

    @pytest.mark.skip("DO NOT override autofix automation tuning off")
    @patch("sentry.tasks.seer.autofix.bulk_set_project_preferences")
    @patch("sentry.tasks.seer.autofix.bulk_get_project_preferences")
    def test_overrides_autofix_off_to_medium(
        self, mock_bulk_get: MagicMock, mock_bulk_set: MagicMock
    ) -> None:
        """Test that projects with autofix set to off are migrated to medium."""
        project = self.create_project(organization=self.organization)
        project.update_option("sentry:autofix_automation_tuning", "off")

        mock_bulk_get.return_value = {}

        configure_seer_for_existing_org(organization_id=self.organization.id)

        # autofix_automation_tuning should be migrated to medium for new pricing
        assert project.get_option("sentry:autofix_automation_tuning") == "medium"
        # Scanner should be enabled
        assert project.get_option("sentry:seer_scanner_automation") is True

    @patch("sentry.tasks.seer.autofix.bulk_set_project_preferences")
    @patch("sentry.tasks.seer.autofix.bulk_get_project_preferences")
    def test_new_project_gets_stopping_point_and_no_handoff_from_org_defaults(
        self, mock_bulk_get: MagicMock, mock_bulk_set: MagicMock
    ) -> None:
        """Project with no existing prefs gets stopping point and no handoff (seer coding agent) from org defaults."""
        project = self.create_project(organization=self.organization)

        mock_bulk_get.return_value = {}

        configure_seer_for_existing_org(organization_id=self.organization.id)

        mock_bulk_set.assert_called_once()
        prefs = mock_bulk_set.call_args[0][1]
        prefs_by_project = {p["project_id"]: p for p in prefs}
        assert prefs_by_project[project.id]["automated_run_stopping_point"] == "code_changes"
        assert prefs_by_project[project.id]["automation_handoff"] is None

    @patch("sentry.tasks.seer.autofix.bulk_set_project_preferences")
    @patch("sentry.tasks.seer.autofix.bulk_get_project_preferences")
    def test_new_project_gets_stopping_point_and_handoff_from_org_defaults(
        self, mock_bulk_get: MagicMock, mock_bulk_set: MagicMock
    ) -> None:
        """Project with no existing prefs gets stopping point and external agent handoff from org defaults."""
        project = self.create_project(organization=self.organization)
        self.organization.update_option(
            "sentry:seer_default_coding_agent", "cursor_background_agent"
        )
        self.organization.update_option("sentry:seer_default_coding_agent_integration_id", 42)
        self.organization.update_option("sentry:auto_open_prs", True)

        mock_bulk_get.return_value = {}

        configure_seer_for_existing_org(organization_id=self.organization.id)

        mock_bulk_set.assert_called_once()
        prefs = mock_bulk_set.call_args[0][1]
        prefs_by_project = {p["project_id"]: p for p in prefs}
        assert prefs_by_project[project.id]["automation_handoff"] == {
            "handoff_point": "root_cause",
            "target": "cursor_background_agent",
            "integration_id": 42,
            "auto_create_pr": True,
        }
        # auto_open_prs should NOT override stopping point for external agents
        assert (
            prefs_by_project[project.id]["automated_run_stopping_point"]
            == SEER_AUTOMATED_RUN_STOPPING_POINT_DEFAULT
        )

    @patch("sentry.tasks.seer.autofix.bulk_set_project_preferences")
    @patch("sentry.tasks.seer.autofix.bulk_get_project_preferences")
    def test_skips_project_with_valid_stopping_point_and_no_default_handoff(
        self, mock_bulk_get: MagicMock, mock_bulk_set: MagicMock
    ) -> None:
        """Project is skipped when it has a valid stopping point and the org has no default handoff (seer agent)."""
        project = self.create_project(organization=self.organization)

        mock_bulk_get.return_value = {
            str(project.id): {"automated_run_stopping_point": "open_pr"},
        }

        configure_seer_for_existing_org(organization_id=self.organization.id)

        mock_bulk_set.assert_not_called()

    @patch("sentry.tasks.seer.autofix.bulk_set_project_preferences")
    @patch("sentry.tasks.seer.autofix.bulk_get_project_preferences")
    def test_skips_project_with_valid_stopping_point_and_existing_handoff(
        self, mock_bulk_get: MagicMock, mock_bulk_set: MagicMock
    ) -> None:
        """Project is skipped when it has a valid stopping point and an existing handoff configured."""
        project = self.create_project(organization=self.organization)
        self.organization.update_option(
            "sentry:seer_default_coding_agent", "cursor_background_agent"
        )
        self.organization.update_option("sentry:seer_default_coding_agent_integration_id", 42)

        mock_bulk_get.return_value = {
            str(project.id): {
                "automated_run_stopping_point": "code_changes",
                "automation_handoff": {
                    "handoff_point": "root_cause",
                    "target": "claude_code_agent",
                    "integration_id": 99,
                    "auto_create_pr": False,
                },
            },
        }

        configure_seer_for_existing_org(organization_id=self.organization.id)

        mock_bulk_set.assert_not_called()

    @patch("sentry.tasks.seer.autofix.bulk_set_project_preferences")
    @patch("sentry.tasks.seer.autofix.bulk_get_project_preferences")
    def test_project_with_valid_stopping_point_gets_handoff_from_org_defaults(
        self, mock_bulk_get: MagicMock, mock_bulk_set: MagicMock
    ) -> None:
        """Project with valid stopping point but no handoff gets org default handoff applied.
        Existing stopping point is preserved."""
        project = self.create_project(organization=self.organization)
        self.organization.update_option(
            "sentry:seer_default_coding_agent", "cursor_background_agent"
        )
        self.organization.update_option("sentry:seer_default_coding_agent_integration_id", 42)
        self.organization.update_option("sentry:auto_open_prs", True)

        mock_bulk_get.return_value = {
            str(project.id): {"automated_run_stopping_point": "open_pr"},
        }

        configure_seer_for_existing_org(organization_id=self.organization.id)

        mock_bulk_set.assert_called_once()
        prefs = mock_bulk_set.call_args[0][1]
        prefs_by_project = {p["project_id"]: p for p in prefs}
        assert prefs_by_project[project.id]["automated_run_stopping_point"] == "open_pr"
        assert prefs_by_project[project.id]["automation_handoff"] == {
            "handoff_point": "root_cause",
            "target": "cursor_background_agent",
            "integration_id": 42,
            "auto_create_pr": True,
        }

    @patch("sentry.tasks.seer.autofix.bulk_set_project_preferences")
    @patch("sentry.tasks.seer.autofix.bulk_get_project_preferences")
    def test_project_with_invalid_stopping_point_gets_org_default_stopping_point(
        self, mock_bulk_get: MagicMock, mock_bulk_set: MagicMock
    ) -> None:
        """Project with unrecognized stopping point gets org default stopping point applied.
        Existing handoff (if any) is preserved."""
        project = self.create_project(organization=self.organization)
        self.organization.update_option(
            "sentry:seer_default_coding_agent", "cursor_background_agent"
        )
        self.organization.update_option("sentry:seer_default_coding_agent_integration_id", 42)

        existing_handoff = {
            "handoff_point": "root_cause",
            "target": "claude_code_agent",
            "integration_id": 99,
            "auto_create_pr": False,
        }
        mock_bulk_get.return_value = {
            str(project.id): {
                "automated_run_stopping_point": "root_cause",
                "automation_handoff": existing_handoff,
            },
        }

        configure_seer_for_existing_org(organization_id=self.organization.id)

        mock_bulk_set.assert_called_once()
        prefs = mock_bulk_set.call_args[0][1]
        prefs_by_project = {p["project_id"]: p for p in prefs}
        assert (
            prefs_by_project[project.id]["automated_run_stopping_point"]
            == SEER_AUTOMATED_RUN_STOPPING_POINT_DEFAULT
        )
        assert prefs_by_project[project.id]["automation_handoff"] == existing_handoff

    @patch("sentry.tasks.seer.autofix.bulk_set_project_preferences")
    @patch("sentry.tasks.seer.autofix.bulk_get_project_preferences")
    def test_root_cause_stopping_point_preserved_when_valid(
        self, mock_bulk_get: MagicMock, mock_bulk_set: MagicMock
    ) -> None:
        """Project with root_cause stopping point is preserved when root-cause-stopping-point flag is enabled."""
        project = self.create_project(organization=self.organization)

        mock_bulk_get.return_value = {
            str(project.id): {
                "automated_run_stopping_point": "root_cause",
                "automation_handoff": None,
            },
        }

        with self.feature("organizations:root-cause-stopping-point"):
            configure_seer_for_existing_org(organization_id=self.organization.id)

        mock_bulk_set.assert_not_called()

    @patch("sentry.tasks.seer.autofix.bulk_get_project_preferences")
    def test_raises_on_bulk_get_api_failure(self, mock_bulk_get: MagicMock) -> None:
        """Test that task raises on bulk GET API failure to trigger retry."""
        project1 = self.create_project(organization=self.organization)
        project2 = self.create_project(organization=self.organization)

        mock_bulk_get.side_effect = SeerApiError("API error", 500)

        with pytest.raises(SeerApiError):
            configure_seer_for_existing_org(organization_id=self.organization.id)

        # Sentry DB options should still be set before the API call
        assert project1.get_option("sentry:seer_scanner_automation") is True
        assert project2.get_option("sentry:seer_scanner_automation") is True

    @patch("sentry.tasks.seer.autofix.bulk_set_project_preferences")
    @patch("sentry.tasks.seer.autofix.bulk_get_project_preferences")
    def test_raises_on_bulk_set_api_failure(
        self, mock_bulk_get: MagicMock, mock_bulk_set: MagicMock
    ) -> None:
        """Test that task raises on bulk SET API failure to trigger retry."""
        project1 = self.create_project(organization=self.organization)
        project2 = self.create_project(organization=self.organization)

        mock_bulk_get.return_value = {}
        mock_bulk_set.side_effect = SeerApiError("API error", 500)

        with pytest.raises(SeerApiError):
            configure_seer_for_existing_org(organization_id=self.organization.id)

        # Sentry DB options should still be set before the API call
        assert project1.get_option("sentry:seer_scanner_automation") is True
        assert project2.get_option("sentry:seer_scanner_automation") is True

    @patch("sentry.tasks.seer.autofix.bulk_set_project_preferences")
    @patch("sentry.tasks.seer.autofix.bulk_get_project_preferences")
    def test_sets_seat_based_tier_cache_to_true(
        self, mock_bulk_get: MagicMock, mock_bulk_set: MagicMock
    ) -> None:
        """Test that the seat-based tier cache is set to True after configuring org."""
        self.create_project(organization=self.organization)
        mock_bulk_get.return_value = {}

        # Set a cached value before running the task
        cache_key = get_seer_seat_based_tier_cache_key(self.organization.id)
        cache.set(cache_key, False, timeout=60 * 60 * 4)
        assert cache.get(cache_key) is False

        configure_seer_for_existing_org(organization_id=self.organization.id)

        # Cache should be set to True to prevent race conditions
        assert cache.get(cache_key) is True

    @patch("sentry.tasks.seer.autofix.get_autofix_repos_from_project_code_mappings")
    @patch("sentry.tasks.seer.autofix.bulk_set_project_preferences")
    @patch("sentry.tasks.seer.autofix.bulk_get_project_preferences")
    def test_uses_code_mappings_when_no_existing_preferences(
        self, mock_bulk_get: MagicMock, mock_bulk_set: MagicMock, mock_get_code_mappings: MagicMock
    ) -> None:
        """Test that code mappings are used as fallback when no preferences exist."""
        project = self.create_project(organization=self.organization)
        mock_bulk_get.return_value = {}
        mock_repos = [{"provider": "github", "owner": "test-org", "name": "test-repo"}]
        mock_get_code_mappings.return_value = mock_repos

        configure_seer_for_existing_org(organization_id=self.organization.id)

        mock_get_code_mappings.assert_called_once_with(project)
        preferences = mock_bulk_set.call_args[0][1]
        assert preferences[0]["repositories"] == mock_repos

    @patch("sentry.tasks.seer.autofix.get_autofix_repos_from_project_code_mappings")
    @patch("sentry.tasks.seer.autofix.bulk_set_project_preferences")
    @patch("sentry.tasks.seer.autofix.bulk_get_project_preferences")
    def test_preserves_existing_repositories_when_preferences_exist(
        self, mock_bulk_get: MagicMock, mock_bulk_set: MagicMock, mock_get_code_mappings: MagicMock
    ) -> None:
        """Test that existing repositories are preserved when preferences exist."""
        project = self.create_project(organization=self.organization)
        existing_repos = [{"provider": "github", "owner": "existing-org", "name": "existing-repo"}]
        mock_bulk_get.return_value = {str(project.id): {"repositories": existing_repos}}

        configure_seer_for_existing_org(organization_id=self.organization.id)

        mock_get_code_mappings.assert_not_called()
        preferences = mock_bulk_set.call_args[0][1]
        assert preferences[0]["repositories"] == existing_repos

    @patch("sentry.tasks.seer.autofix.bulk_set_project_preferences")
    @patch("sentry.tasks.seer.autofix.bulk_get_project_preferences")
    def test_creates_seer_project_repository(
        self, mock_bulk_get: MagicMock, mock_bulk_set: MagicMock
    ) -> None:
        """Test that SeerProjectRepository is created when feature flag is enabled."""
        project = self.create_project(organization=self.organization)
        repo = Repository.objects.create(
            organization_id=self.organization.id,
            name="test-org/test-repo",
            provider="github",
            external_id="ext123",
        )

        mock_bulk_get.return_value = {
            str(project.id): {
                "repositories": [
                    {
                        "provider": "github",
                        "owner": "test-org",
                        "name": "test-repo",
                        "external_id": "ext123",
                    }
                ],
                "automated_run_stopping_point": None,
            }
        }

        with self.feature("organizations:seer-project-settings-dual-write"):
            configure_seer_for_existing_org(organization_id=self.organization.id)

        seer_repo = SeerProjectRepository.objects.get(project=project)
        assert seer_repo.repository_id == repo.id
