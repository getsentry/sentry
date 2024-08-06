from datetime import datetime, timezone
from unittest.mock import call, patch

from django.conf import settings
from django.test import override_settings

from sentry.autofix.utils import AutofixState, AutofixStatus
from sentry.autofix.webhooks import handle_github_pr_webhook_for_autofix
from sentry.testutils.cases import APITestCase


class AutofixPrWebhookTest(APITestCase):
    @override_settings(SEER_AUTOFIX_GITHUB_APP_USER_ID="12345")
    @patch(
        "sentry.autofix.webhooks.get_autofix_state_from_pr_id",
        return_value=AutofixState(
            run_id=1,
            request={"project_id": 2, "issue": {"id": 3}},
            updated_at=datetime.now(timezone.utc),
            status=AutofixStatus.PROCESSING,
        ),
    )
    @patch("sentry.autofix.webhooks.analytics.record")
    @patch("sentry.autofix.webhooks.metrics.incr")
    def test_opened(
        self, mock_metrics_incr, mock_analytics_record, mock_get_autofix_state_from_pr_id
    ):
        handle_github_pr_webhook_for_autofix(
            self.organization,
            "opened",
            {"id": 1, "merged": False},
            {"id": settings.SEER_AUTOFIX_GITHUB_APP_USER_ID},
        )

        mock_metrics_incr.assert_called_with("ai.autofix.pr.opened")
        mock_analytics_record.assert_called_with(
            "ai.autofix.pr.opened",
            organization_id=self.organization.id,
            integration="github",
            project_id=2,
            group_id=3,
            run_id=1,
        )

    @override_settings(SEER_AUTOFIX_GITHUB_APP_USER_ID="12345")
    @patch(
        "sentry.autofix.webhooks.get_autofix_state_from_pr_id",
        return_value=AutofixState(
            run_id=1,
            request={"project_id": 2, "issue": {"id": 3}},
            updated_at=datetime.now(timezone.utc),
            status=AutofixStatus.PROCESSING,
        ),
    )
    @patch("sentry.autofix.webhooks.analytics.record")
    @patch("sentry.autofix.webhooks.metrics.incr")
    def test_closed(
        self, mock_metrics_incr, mock_analytics_record, mock_get_autofix_state_from_pr_id
    ):
        handle_github_pr_webhook_for_autofix(
            self.organization,
            "closed",
            {"id": 1, "merged": False},
            {"id": settings.SEER_AUTOFIX_GITHUB_APP_USER_ID},
        )

        mock_metrics_incr.assert_called_with("ai.autofix.pr.closed")
        mock_analytics_record.assert_called_with(
            "ai.autofix.pr.closed",
            organization_id=self.organization.id,
            integration="github",
            project_id=2,
            group_id=3,
            run_id=1,
        )

    @override_settings(SEER_AUTOFIX_GITHUB_APP_USER_ID="12345")
    @patch(
        "sentry.autofix.webhooks.get_autofix_state_from_pr_id",
        return_value=AutofixState(
            run_id=1,
            request={"project_id": 2, "issue": {"id": 3}},
            updated_at=datetime.now(timezone.utc),
            status=AutofixStatus.PROCESSING,
        ),
    )
    @patch("sentry.autofix.webhooks.analytics.record")
    @patch("sentry.autofix.webhooks.metrics.incr")
    def test_merged(
        self, mock_metrics_incr, mock_analytics_record, mock_get_autofix_state_from_pr_id
    ):
        handle_github_pr_webhook_for_autofix(
            self.organization,
            "closed",
            {"id": 1, "merged": True},
            {"id": settings.SEER_AUTOFIX_GITHUB_APP_USER_ID},
        )
        mock_metrics_incr.assert_called_with("ai.autofix.pr.merged")
        mock_analytics_record.assert_called_with(
            "ai.autofix.pr.merged",
            organization_id=self.organization.id,
            integration="github",
            project_id=2,
            group_id=3,
            run_id=1,
        )

    @override_settings(SEER_AUTOFIX_GITHUB_APP_USER_ID="12345")
    @patch(
        "sentry.autofix.webhooks.get_autofix_state_from_pr_id",
        return_value=None,
    )
    @patch("sentry.autofix.webhooks.analytics.record")
    @patch("sentry.autofix.webhooks.metrics.incr")
    def test_no_run(
        self, mock_metrics_incr, mock_analytics_record, mock_get_autofix_state_from_pr_id
    ):
        handle_github_pr_webhook_for_autofix(
            self.organization,
            "closed",
            {"id": 1, "merged": True},
            {"id": settings.SEER_AUTOFIX_GITHUB_APP_USER_ID},
        )

        for key in ["ai.autofix.pr.merged", "ai.autofix.pr.closed", "ai.autofix.pr.opened"]:
            assert call(key) not in mock_metrics_incr.call_args_list
            assert call(key) not in mock_analytics_record.call_args_list

    @override_settings(SEER_AUTOFIX_GITHUB_APP_USER_ID=None)
    @patch(
        "sentry.autofix.webhooks.get_autofix_state_from_pr_id",
        return_value=None,
    )
    @patch("sentry.autofix.webhooks.analytics.record")
    @patch("sentry.autofix.webhooks.metrics.incr")
    def test_no_settings_github_app_id_set(
        self, mock_metrics_incr, mock_analytics_record, mock_get_autofix_state_from_pr_id
    ):
        handle_github_pr_webhook_for_autofix(
            self.organization,
            "closed",
            {"id": 1, "merged": True},
            {"id": "5655"},
        )

        for key in ["ai.autofix.pr.merged", "ai.autofix.pr.closed", "ai.autofix.pr.opened"]:
            assert call(key) not in mock_metrics_incr.call_args_list
            assert call(key) not in mock_analytics_record.call_args_list

    @override_settings(SEER_AUTOFIX_GITHUB_APP_USER_ID="12345")
    @patch(
        "sentry.autofix.webhooks.get_autofix_state_from_pr_id",
        return_value=None,
    )
    @patch("sentry.autofix.webhooks.analytics.record")
    @patch("sentry.autofix.webhooks.metrics.incr")
    def test_no_different_github_app(
        self, mock_metrics_incr, mock_analytics_record, mock_get_autofix_state_from_pr_id
    ):
        handle_github_pr_webhook_for_autofix(
            self.organization,
            "closed",
            {"id": 1, "merged": True},
            {"id": "321"},
        )

        for key in ["ai.autofix.pr.merged", "ai.autofix.pr.closed", "ai.autofix.pr.opened"]:
            assert call(key) not in mock_metrics_incr.call_args_list
            assert call(key) not in mock_analytics_record.call_args_list
