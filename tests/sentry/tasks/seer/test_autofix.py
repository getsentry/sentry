from unittest.mock import MagicMock, patch

import pytest

from sentry.seer.autofix.constants import SeerAutomationSource
from sentry.seer.autofix.utils import get_seer_seat_based_tier_cache_key
from sentry.seer.models import (
    SummarizeIssueResponse,
    SummarizeIssueScores,
)
from sentry.tasks.seer.autofix import (
    configure_seer_for_existing_org,
    generate_issue_summary_only,
)
from sentry.testutils.cases import TestCase as SentryTestCase
from sentry.utils.cache import cache


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
    def test_configures_org_and_project_settings(self) -> None:
        """Test that org and project settings are configured correctly."""
        project1 = self.create_project(organization=self.organization)
        project2 = self.create_project(organization=self.organization)
        # Set to non-off value so we can verify it gets changed to medium
        project1.update_option("sentry:autofix_automation_tuning", "low")
        project2.update_option("sentry:autofix_automation_tuning", "high")

        configure_seer_for_existing_org(organization_id=self.organization.id)

        # Check org-level options
        assert self.organization.get_option("sentry:default_autofix_automation_tuning") == "medium"

        # Check project-level options
        assert project1.get_option("sentry:seer_scanner_automation") is True
        assert project1.get_option("sentry:autofix_automation_tuning") == "medium"
        assert project2.get_option("sentry:seer_scanner_automation") is True
        assert project2.get_option("sentry:autofix_automation_tuning") == "medium"
        # Check Seer project preferences (valid stopping point + no org-default handoff means no change)
        assert project1.get_option("sentry:seer_automation_handoff_point") is None
        assert project1.get_option("sentry:seer_automation_handoff_target") is None
        assert project2.get_option("sentry:seer_automation_handoff_point") is None
        assert project2.get_option("sentry:seer_automation_handoff_target") is None

    @pytest.mark.skip("DO NOT override autofix automation tuning off")
    def test_overrides_autofix_off_to_medium(self) -> None:
        """Test that projects with autofix set to off are migrated to medium."""
        project = self.create_project(organization=self.organization)
        project.update_option("sentry:autofix_automation_tuning", "off")

        configure_seer_for_existing_org(organization_id=self.organization.id)

        # autofix_automation_tuning should be migrated to medium for new pricing
        assert project.get_option("sentry:autofix_automation_tuning") == "medium"
        # Scanner should be enabled
        assert project.get_option("sentry:seer_scanner_automation") is True

    def test_skips_project_with_valid_stopping_point_and_no_default_handoff(self) -> None:
        """Project is skipped when it has a valid stopping point and the org has no default handoff (seer agent)."""
        project = self.create_project(organization=self.organization)
        project.update_option("sentry:seer_automated_run_stopping_point", "open_pr")

        configure_seer_for_existing_org(organization_id=self.organization.id)

        # Existing stopping point is unchanged and no handoff is written.
        assert project.get_option("sentry:seer_automated_run_stopping_point") == "open_pr"
        assert project.get_option("sentry:seer_automation_handoff_point") is None

    def test_skips_project_with_valid_stopping_point_and_existing_handoff(self) -> None:
        """Project is skipped when it has a valid stopping point and an existing handoff configured."""
        project = self.create_project(organization=self.organization)
        self.organization.update_option(
            "sentry:seer_default_coding_agent", "cursor_background_agent"
        )
        self.organization.update_option("sentry:seer_default_coding_agent_integration_id", 42)

        project.update_option("sentry:seer_automated_run_stopping_point", "code_changes")
        project.update_option("sentry:seer_automation_handoff_point", "root_cause")
        project.update_option("sentry:seer_automation_handoff_target", "claude_code_agent")
        project.update_option("sentry:seer_automation_handoff_integration_id", 99)
        project.update_option("sentry:seer_automation_handoff_auto_create_pr", False)

        configure_seer_for_existing_org(organization_id=self.organization.id)

        # Existing stopping point and handoff preserved instead of being backfilled from org defaults.
        assert project.get_option("sentry:seer_automated_run_stopping_point") == "code_changes"
        assert project.get_option("sentry:seer_automation_handoff_point") == "root_cause"
        assert project.get_option("sentry:seer_automation_handoff_target") == "claude_code_agent"
        assert project.get_option("sentry:seer_automation_handoff_integration_id") == 99
        assert project.get_option("sentry:seer_automation_handoff_auto_create_pr") is False

    def test_project_with_valid_stopping_point_gets_handoff_from_org_defaults(self) -> None:
        """Project with valid stopping point but no handoff gets org default handoff applied.
        Existing stopping point is preserved, and auto_open_prs does not override it for external agents."""
        project = self.create_project(organization=self.organization)
        self.organization.update_option(
            "sentry:seer_default_coding_agent", "cursor_background_agent"
        )
        self.organization.update_option("sentry:seer_default_coding_agent_integration_id", 42)
        self.organization.update_option("sentry:auto_open_prs", True)

        project.update_option("sentry:seer_automated_run_stopping_point", "open_pr")

        configure_seer_for_existing_org(organization_id=self.organization.id)

        # Stopping point preserved.
        assert project.get_option("sentry:seer_automated_run_stopping_point") == "open_pr"
        # New handoff from org defaults.
        assert project.get_option("sentry:seer_automation_handoff_point") == "root_cause"
        assert (
            project.get_option("sentry:seer_automation_handoff_target") == "cursor_background_agent"
        )
        assert project.get_option("sentry:seer_automation_handoff_integration_id") == 42
        assert project.get_option("sentry:seer_automation_handoff_auto_create_pr") is True

    def test_project_with_invalid_stopping_point_gets_org_default_stopping_point(self) -> None:
        """Project with unrecognized stopping point gets org default stopping point applied.
        Existing handoff (if any) is preserved."""
        project = self.create_project(organization=self.organization)
        self.organization.update_option(
            "sentry:seer_default_coding_agent", "cursor_background_agent"
        )
        self.organization.update_option("sentry:seer_default_coding_agent_integration_id", 42)
        self.organization.update_option("sentry:default_automated_run_stopping_point", "open_pr")

        # "solution" is not in the valid set for seat-based orgs.
        project.update_option("sentry:seer_automated_run_stopping_point", "solution")
        project.update_option("sentry:seer_automation_handoff_point", "root_cause")
        project.update_option("sentry:seer_automation_handoff_target", "claude_code_agent")
        project.update_option("sentry:seer_automation_handoff_integration_id", 99)
        project.update_option("sentry:seer_automation_handoff_auto_create_pr", False)

        configure_seer_for_existing_org(organization_id=self.organization.id)

        # Stopping point changed to org default.
        assert project.get_option("sentry:seer_automated_run_stopping_point") == "open_pr"
        # Existing handoff preserved.
        assert project.get_option("sentry:seer_automation_handoff_target") == "claude_code_agent"
        assert project.get_option("sentry:seer_automation_handoff_integration_id") == 99

    def test_sets_seat_based_tier_cache_to_true(self) -> None:
        """Test that the seat-based tier cache is set to True after configuring org."""
        self.create_project(organization=self.organization)

        # Set a cached value before running the task
        cache_key = get_seer_seat_based_tier_cache_key(self.organization.id)
        cache.set(cache_key, False, timeout=60 * 60 * 4)
        assert cache.get(cache_key) is False

        configure_seer_for_existing_org(organization_id=self.organization.id)

        # Cache should be set to True to prevent race conditions
        assert cache.get(cache_key) is True
