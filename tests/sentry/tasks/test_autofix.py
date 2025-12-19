from datetime import datetime, timedelta
from unittest.mock import MagicMock, patch

import pytest
from django.test import TestCase

from sentry.seer.autofix.constants import AutofixStatus, SeerAutomationSource
from sentry.seer.autofix.utils import AutofixState, get_seer_seat_based_tier_cache_key
from sentry.seer.models import SeerApiError, SummarizeIssueResponse, SummarizeIssueScores
from sentry.tasks.autofix import (
    check_autofix_status,
    configure_seer_for_existing_org,
    generate_issue_summary_only,
)
from sentry.testutils.cases import TestCase as SentryTestCase
from sentry.utils.cache import cache


class TestCheckAutofixStatus(TestCase):
    @patch("sentry.tasks.autofix.get_autofix_state")
    @patch("sentry.tasks.autofix.logger.error")
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

    @patch("sentry.tasks.autofix.get_autofix_state")
    @patch("sentry.tasks.autofix.logger.error")
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

    @patch("sentry.tasks.autofix.get_autofix_state")
    @patch("sentry.tasks.autofix.logger.error")
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

    @patch("sentry.tasks.autofix.get_autofix_state")
    @patch("sentry.tasks.autofix.logger.error")
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
    def test_generates_fixability_score(
        self, mock_get_issue_summary: MagicMock, mock_generate_fixability: MagicMock
    ) -> None:
        """Test that fixability score is generated and saved to the group."""
        group = self.create_group(project=self.project)

        mock_generate_fixability.return_value = SummarizeIssueResponse(
            group_id=str(group.id),
            headline="Test",
            whats_wrong="Test",
            trace="Test",
            possible_cause="Test",
            scores=SummarizeIssueScores(fixability_score=0.75, actionability_score=0.85),
        )

        generate_issue_summary_only(group.id)

        mock_get_issue_summary.assert_called_once_with(
            group=group, source=SeerAutomationSource.POST_PROCESS, should_run_automation=False
        )
        mock_generate_fixability.assert_called_once_with(group)

        group.refresh_from_db()
        assert group.seer_fixability_score == 0.75


class TestConfigureSeerForExistingOrg(SentryTestCase):
    @patch("sentry.tasks.autofix.bulk_set_project_preferences")
    @patch("sentry.tasks.autofix.bulk_get_project_preferences")
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
        assert self.organization.get_option("sentry:enable_seer_coding") is True
        assert self.organization.get_option("sentry:default_autofix_automation_tuning") == "medium"

        # Check project-level options
        assert project1.get_option("sentry:seer_scanner_automation") is True
        assert project1.get_option("sentry:autofix_automation_tuning") == "medium"
        assert project2.get_option("sentry:seer_scanner_automation") is True
        assert project2.get_option("sentry:autofix_automation_tuning") == "medium"

        mock_bulk_get.assert_called_once()
        mock_bulk_set.assert_called_once()

    @patch("sentry.tasks.autofix.bulk_set_project_preferences")
    @patch("sentry.tasks.autofix.bulk_get_project_preferences")
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

    @patch("sentry.tasks.autofix.bulk_set_project_preferences")
    @patch("sentry.tasks.autofix.bulk_get_project_preferences")
    def test_skips_projects_with_existing_stopping_point(
        self, mock_bulk_get: MagicMock, mock_bulk_set: MagicMock
    ) -> None:
        """Test that projects with open_pr or code_changes stopping point are skipped."""
        project1 = self.create_project(organization=self.organization)
        project2 = self.create_project(organization=self.organization)

        mock_bulk_get.return_value = {
            str(project1.id): {"automated_run_stopping_point": "open_pr"},
            str(project2.id): {"automated_run_stopping_point": "code_changes"},
        }

        configure_seer_for_existing_org(organization_id=self.organization.id)

        # bulk_set should not be called since both projects are skipped
        mock_bulk_set.assert_not_called()

    @patch("sentry.tasks.autofix.bulk_get_project_preferences")
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

    @patch("sentry.tasks.autofix.bulk_set_project_preferences")
    @patch("sentry.tasks.autofix.bulk_get_project_preferences")
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

    @patch("sentry.tasks.autofix.bulk_set_project_preferences")
    @patch("sentry.tasks.autofix.bulk_get_project_preferences")
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

    @patch("sentry.tasks.autofix.get_autofix_repos_from_project_code_mappings")
    @patch("sentry.tasks.autofix.bulk_set_project_preferences")
    @patch("sentry.tasks.autofix.bulk_get_project_preferences")
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

    @patch("sentry.tasks.autofix.get_autofix_repos_from_project_code_mappings")
    @patch("sentry.tasks.autofix.bulk_set_project_preferences")
    @patch("sentry.tasks.autofix.bulk_get_project_preferences")
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
