from typing import int
from datetime import datetime, timezone
from unittest.mock import call, patch

from django.conf import settings
from django.test import override_settings

from sentry.analytics.events.ai_autofix_pr_events import (
    AiAutofixPrClosedEvent,
    AiAutofixPrMergedEvent,
    AiAutofixPrOpenedEvent,
)
from sentry.seer.autofix.constants import AutofixStatus
from sentry.seer.autofix.utils import AutofixState
from sentry.seer.autofix.webhooks import handle_github_pr_webhook_for_autofix
from sentry.testutils.cases import APITestCase
from sentry.testutils.helpers.analytics import (
    assert_last_analytics_event,
    assert_not_analytics_event,
)


class AutofixPrWebhookTest(APITestCase):
    @override_settings(SEER_AUTOFIX_GITHUB_APP_USER_ID="12345")
    @patch(
        "sentry.seer.autofix.webhooks.get_autofix_state_from_pr_id",
        return_value=AutofixState(
            run_id=1,
            request={
                "project_id": 2,
                "organization_id": 4,
                "issue": {"id": 3, "title": "Test issue"},
                "repos": [
                    {"provider": "github", "owner": "test", "name": "test", "external_id": "123"}
                ],
            },
            updated_at=datetime.now(timezone.utc),
            status=AutofixStatus.PROCESSING,
            steps=[],
        ),
    )
    @patch("sentry.seer.autofix.webhooks.analytics.record")
    @patch("sentry.seer.autofix.webhooks.metrics.incr")
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
        assert_last_analytics_event(
            mock_analytics_record,
            AiAutofixPrOpenedEvent(
                organization_id=self.organization.id,
                integration="github",
                project_id=2,
                group_id=3,
                run_id=1,
            ),
        )

    @override_settings(SEER_AUTOFIX_GITHUB_APP_USER_ID="12345")
    @patch(
        "sentry.seer.autofix.webhooks.get_autofix_state_from_pr_id",
        return_value=AutofixState(
            run_id=1,
            request={
                "project_id": 2,
                "organization_id": 4,
                "issue": {"id": 3, "title": "Test issue"},
                "repos": [
                    {"provider": "github", "owner": "test", "name": "test", "external_id": "123"}
                ],
            },
            updated_at=datetime.now(timezone.utc),
            status=AutofixStatus.PROCESSING,
            steps=[],
        ),
    )
    @patch("sentry.seer.autofix.webhooks.analytics.record")
    @patch("sentry.seer.autofix.webhooks.metrics.incr")
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
        assert_last_analytics_event(
            mock_analytics_record,
            AiAutofixPrClosedEvent(
                organization_id=self.organization.id,
                integration="github",
                project_id=2,
                group_id=3,
                run_id=1,
            ),
        )

    @override_settings(SEER_AUTOFIX_GITHUB_APP_USER_ID="12345")
    @patch(
        "sentry.seer.autofix.webhooks.get_autofix_state_from_pr_id",
        return_value=AutofixState(
            run_id=1,
            request={
                "project_id": 2,
                "organization_id": 4,
                "issue": {"id": 3, "title": "Test issue"},
                "repos": [
                    {"provider": "github", "owner": "test", "name": "test", "external_id": "123"}
                ],
            },
            updated_at=datetime.now(timezone.utc),
            status=AutofixStatus.PROCESSING,
            steps=[],
        ),
    )
    @patch("sentry.seer.autofix.webhooks.analytics.record")
    @patch("sentry.seer.autofix.webhooks.metrics.incr")
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
        assert_last_analytics_event(
            mock_analytics_record,
            AiAutofixPrMergedEvent(
                organization_id=self.organization.id,
                integration="github",
                project_id=2,
                group_id=3,
                run_id=1,
            ),
        )

    @override_settings(SEER_AUTOFIX_GITHUB_APP_USER_ID="12345")
    @patch(
        "sentry.seer.autofix.webhooks.get_autofix_state_from_pr_id",
        return_value=None,
    )
    @patch("sentry.seer.autofix.webhooks.analytics.record")
    @patch("sentry.seer.autofix.webhooks.metrics.incr")
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

        assert_not_analytics_event(mock_analytics_record, AiAutofixPrClosedEvent)
        assert_not_analytics_event(mock_analytics_record, AiAutofixPrMergedEvent)
        assert_not_analytics_event(mock_analytics_record, AiAutofixPrOpenedEvent)

    @override_settings(SEER_AUTOFIX_GITHUB_APP_USER_ID=None)
    @patch(
        "sentry.seer.autofix.webhooks.get_autofix_state_from_pr_id",
        return_value=None,
    )
    @patch("sentry.seer.autofix.webhooks.analytics.record")
    @patch("sentry.seer.autofix.webhooks.metrics.incr")
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
        "sentry.seer.autofix.webhooks.get_autofix_state_from_pr_id",
        return_value=None,
    )
    @patch("sentry.seer.autofix.webhooks.analytics.record")
    @patch("sentry.seer.autofix.webhooks.metrics.incr")
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
