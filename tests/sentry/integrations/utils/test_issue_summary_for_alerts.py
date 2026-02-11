from unittest.mock import MagicMock, patch

from sentry.grouping.grouptype import ErrorGroupType
from sentry.integrations.utils.issue_summary_for_alerts import fetch_issue_summary
from sentry.issues.grouptype import PerformanceNPlusOneGroupType
from sentry.testutils.cases import TestCase
from sentry.testutils.helpers.features import with_feature


class FetchIssueSummaryTest(TestCase):
    def setUp(self) -> None:
        super().setUp()
        self.organization = self.create_organization()
        self.project = self.create_project(organization=self.organization)
        # Create an error group with the proper type
        self.group = self.create_group(project=self.project, type=ErrorGroupType.type_id)

    def test_fetch_issue_summary_returns_none_for_non_error_groups(self) -> None:
        """Test that fetch_issue_summary returns None for non-error issue categories"""
        # Create a performance group for this test
        performance_group = self.create_group(
            project=self.project, type=PerformanceNPlusOneGroupType.type_id
        )

        result = fetch_issue_summary(performance_group)
        assert result is None

    @with_feature("organizations:gen-ai-features")
    @patch("sentry.integrations.utils.issue_summary_for_alerts.get_seer_org_acknowledgement")
    @patch("sentry.integrations.utils.issue_summary_for_alerts.is_seer_scanner_rate_limited")
    @patch("sentry.quotas.backend.check_seer_quota")
    def test_fetch_issue_summary_with_hide_ai_features_enabled(
        self, mock_has_budget, mock_rate_limited, mock_seer_ack
    ):
        """Test that fetch_issue_summary returns None when hideAiFeatures is True"""
        # Set up all the required conditions to pass except hideAiFeatures
        self.project.update_option("sentry:seer_scanner_automation", True)
        self.organization.update_option("sentry:hide_ai_features", True)
        mock_seer_ack.return_value = True
        mock_rate_limited.return_value = False
        mock_has_budget.return_value = True

        result = fetch_issue_summary(self.group)

        assert result is None
        # Verify that budget check wasn't called since we returned early
        mock_has_budget.assert_not_called()

    @with_feature("organizations:gen-ai-features")
    @patch("sentry.integrations.utils.issue_summary_for_alerts.get_issue_summary")
    @patch("sentry.integrations.utils.issue_summary_for_alerts.get_seer_org_acknowledgement")
    @patch("sentry.integrations.utils.issue_summary_for_alerts.is_seer_scanner_rate_limited")
    @patch("sentry.quotas.backend.check_seer_quota")
    def test_fetch_issue_summary_with_hide_ai_features_disabled(
        self, mock_has_budget, mock_rate_limited, mock_seer_ack, mock_get_issue_summary
    ):
        """Test that fetch_issue_summary proceeds normally when hideAiFeatures is False"""
        # Set up all the required conditions to pass
        self.project.update_option("sentry:seer_scanner_automation", True)
        self.organization.update_option("sentry:hide_ai_features", False)
        self.organization.update_option("sentry:enable_seer_enhanced_alerts", True)
        mock_seer_ack.return_value = True
        mock_rate_limited.return_value = False
        mock_has_budget.return_value = True

        # Mock successful summary response
        mock_summary = {
            "headline": "Test AI Summary",
            "whatsWrong": "Something went wrong",
            "possibleCause": "Test cause",
        }
        mock_get_issue_summary.return_value = (mock_summary, 200)

        result = fetch_issue_summary(self.group)

        assert result == mock_summary
        mock_get_issue_summary.assert_called_once()

    @with_feature("organizations:gen-ai-features")
    @patch("sentry.integrations.utils.issue_summary_for_alerts.get_seer_org_acknowledgement")
    def test_fetch_issue_summary_without_seer_scanner_automation(
        self, mock_seer_ack: MagicMock
    ) -> None:
        """Test that fetch_issue_summary returns None when seer_scanner_automation is disabled"""
        self.project.update_option("sentry:seer_scanner_automation", False)
        mock_seer_ack.return_value = True

        result = fetch_issue_summary(self.group)

        assert result is None

    @with_feature("organizations:gen-ai-features")
    @patch("sentry.integrations.utils.issue_summary_for_alerts.get_seer_org_acknowledgement")
    def test_fetch_issue_summary_without_org_acknowledgement(
        self, mock_seer_ack: MagicMock
    ) -> None:
        """Test that fetch_issue_summary returns None when org hasn't acknowledged Seer"""
        self.project.update_option("sentry:seer_scanner_automation", True)
        mock_seer_ack.return_value = False

        result = fetch_issue_summary(self.group)

        assert result is None

    @with_feature("organizations:gen-ai-features")
    @patch("sentry.integrations.utils.issue_summary_for_alerts.get_seer_org_acknowledgement")
    @patch("sentry.quotas.backend.check_seer_quota")
    def test_fetch_issue_summary_without_enable_seer_enhanced_alerts(
        self, mock_has_budget: MagicMock, mock_seer_ack: MagicMock
    ) -> None:
        """Test that fetch_issue_summary returns None when enable_seer_enhanced_alerts is disabled"""
        # Set up all the required conditions to pass except enable_seer_enhanced_alerts
        self.project.update_option("sentry:seer_scanner_automation", True)
        self.organization.update_option("sentry:hide_ai_features", False)
        self.organization.update_option("sentry:enable_seer_enhanced_alerts", False)
        mock_seer_ack.return_value = True

        result = fetch_issue_summary(self.group)

        assert result is None
        # Verify that budget check wasn't called since we returned early
        mock_has_budget.assert_not_called()

    def test_fetch_issue_summary_without_gen_ai_features(self) -> None:
        """Test that fetch_issue_summary returns None without gen-ai-features flag"""
        self.project.update_option("sentry:seer_scanner_automation", True)

        # No @with_feature decorator, so gen-ai-features is disabled
        result = fetch_issue_summary(self.group)

        assert result is None

    @with_feature("organizations:gen-ai-features")
    @patch("sentry.integrations.utils.issue_summary_for_alerts.get_seer_org_acknowledgement")
    @patch("sentry.integrations.utils.issue_summary_for_alerts.is_seer_scanner_rate_limited")
    def test_fetch_issue_summary_rate_limited(
        self, mock_rate_limited: MagicMock, mock_seer_ack: MagicMock
    ) -> None:
        """Test that fetch_issue_summary returns None when rate limited"""
        self.project.update_option("sentry:seer_scanner_automation", True)
        mock_seer_ack.return_value = True
        mock_rate_limited.return_value = True

        result = fetch_issue_summary(self.group)

        assert result is None

    @with_feature("organizations:gen-ai-features")
    @patch("sentry.integrations.utils.issue_summary_for_alerts.get_seer_org_acknowledgement")
    @patch("sentry.integrations.utils.issue_summary_for_alerts.is_seer_scanner_rate_limited")
    @patch("sentry.quotas.backend.check_seer_quota")
    def test_fetch_issue_summary_no_budget(
        self, mock_has_budget: MagicMock, mock_rate_limited: MagicMock, mock_seer_ack: MagicMock
    ) -> None:
        """Test that fetch_issue_summary returns None when no budget available"""
        self.project.update_option("sentry:seer_scanner_automation", True)
        mock_seer_ack.return_value = True
        mock_rate_limited.return_value = False
        mock_has_budget.return_value = False

        result = fetch_issue_summary(self.group)

        assert result is None

    @with_feature("organizations:gen-ai-features")
    @patch("sentry.integrations.utils.issue_summary_for_alerts.get_issue_summary")
    @patch("sentry.integrations.utils.issue_summary_for_alerts.get_seer_org_acknowledgement")
    @patch("sentry.integrations.utils.issue_summary_for_alerts.is_seer_scanner_rate_limited")
    @patch("sentry.quotas.backend.check_seer_quota")
    def test_fetch_issue_summary_timeout_error(
        self, mock_has_budget, mock_rate_limited, mock_seer_ack, mock_get_issue_summary
    ):
        """Test that fetch_issue_summary returns None when timeout occurs"""
        self.project.update_option("sentry:seer_scanner_automation", True)
        mock_seer_ack.return_value = True
        mock_rate_limited.return_value = False
        mock_has_budget.return_value = True

        # Mock timeout exception
        import concurrent.futures

        mock_get_issue_summary.side_effect = concurrent.futures.TimeoutError()

        result = fetch_issue_summary(self.group)

        assert result is None

    @with_feature("organizations:gen-ai-features")
    @patch("sentry.integrations.utils.issue_summary_for_alerts.get_issue_summary")
    @patch("sentry.integrations.utils.issue_summary_for_alerts.get_seer_org_acknowledgement")
    @patch("sentry.integrations.utils.issue_summary_for_alerts.is_seer_scanner_rate_limited")
    @patch("sentry.quotas.backend.check_seer_quota")
    def test_fetch_issue_summary_api_error(
        self, mock_has_budget, mock_rate_limited, mock_seer_ack, mock_get_issue_summary
    ):
        """Test that fetch_issue_summary returns None when API returns error status"""
        self.project.update_option("sentry:seer_scanner_automation", True)
        mock_seer_ack.return_value = True
        mock_rate_limited.return_value = False
        mock_has_budget.return_value = True

        # Mock error response
        mock_get_issue_summary.return_value = (None, 500)

        result = fetch_issue_summary(self.group)

        assert result is None
