from unittest.mock import call, patch

from django.conf import settings
from django.test import override_settings

from sentry.analytics.events.ai_autofix_pr_events import (
    AiAutofixPrClosedEvent,
    AiAutofixPrMergedEvent,
    AiAutofixPrOpenedEvent,
)
from sentry.models.pullrequest import (
    PullRequest,
    PullRequestAttribution,
    PullRequestAttributionSignalType,
    PullRequestAttributionSource,
)
from sentry.seer.agent.client_models import SeerRunState
from sentry.seer.autofix.webhooks import handle_github_pr_webhook_for_autofix
from sentry.testutils.cases import APITestCase
from sentry.testutils.helpers.analytics import (
    assert_last_analytics_event,
    assert_not_analytics_event,
)

PR_URL = "https://github.com/getsentry/sentry/pull/42"


class AutofixPrWebhookTest(APITestCase):
    def setUp(self) -> None:
        self.repo = self.create_repo(self.project, provider="integrations:github")

    @override_settings(SEER_AUTOFIX_GITHUB_APP_USER_ID="12345")
    @patch("sentry.seer.autofix.webhooks.get_agent_state_from_pr_id")
    @patch("sentry.seer.autofix.webhooks.analytics.record")
    @patch("sentry.seer.autofix.webhooks.metrics.incr")
    def test_opened(
        self, mock_metrics_incr, mock_analytics_record, mock_get_agent_state_from_pr_id
    ):
        group = self.create_group(project=self.project)
        mock_get_agent_state_from_pr_id.return_value = SeerRunState(
            run_id=1,
            blocks=[],
            status="processing",
            updated_at="2025-01-15T10:30:00Z",
            metadata={"group_id": group.id},
        )

        with self.feature("organizations:pr-metrics-attribution"):
            handle_github_pr_webhook_for_autofix(
                self.organization,
                "opened",
                {
                    "id": 1,
                    "number": 42,
                    "html_url": PR_URL,
                    "merged": False,
                    "created_at": "2025-01-15T10:30:00Z",
                    "updated_at": "2025-01-15T10:30:00Z",
                },
                {"id": settings.SEER_AUTOFIX_GITHUB_APP_USER_ID},
                self.repo.id,
            )

        mock_metrics_incr.assert_any_call("ai.autofix.pr.opened", tags={"mode": "explorer"})
        assert_last_analytics_event(
            mock_analytics_record,
            AiAutofixPrOpenedEvent(
                organization_id=self.organization.id,
                integration="github",
                project_id=group.project.id,
                group_id=group.id,
                run_id=1,
                github_app="seer",
                sent_at=1736937000000,
            ),
        )

        pull_request = PullRequest.objects.get(repository_id=self.repo.id, key="42")
        attribution = PullRequestAttribution.objects.get(pull_request=pull_request)
        assert attribution.signal_type == PullRequestAttributionSignalType.SENTRY_APP
        assert attribution.source == PullRequestAttributionSource.SEER_DATA
        assert attribution.signal_details == {
            "pr_url": PR_URL,
            "group_ids": [group.id],
            "run_id": 1,
        }

    @override_settings(SEER_AUTOFIX_GITHUB_APP_USER_ID="12345", SENTRY_GITHUB_APP_USER_ID="67890")
    @patch("sentry.seer.autofix.webhooks.get_agent_state_from_pr_id")
    @patch("sentry.seer.autofix.webhooks.analytics.record")
    @patch("sentry.seer.autofix.webhooks.metrics.incr")
    def test_opened_sentry_app(
        self, mock_metrics_incr, mock_analytics_record, mock_get_agent_state_from_pr_id
    ):
        group = self.create_group(project=self.project)
        mock_get_agent_state_from_pr_id.return_value = SeerRunState(
            run_id=1,
            blocks=[],
            status="processing",
            updated_at="2025-01-15T10:30:00Z",
            metadata={"group_id": group.id},
        )

        handle_github_pr_webhook_for_autofix(
            self.organization,
            "opened",
            {
                "id": 1,
                "number": 42,
                "html_url": PR_URL,
                "merged": False,
                "created_at": "2025-01-15T10:30:00Z",
                "updated_at": "2025-01-15T10:30:00Z",
            },
            {"id": settings.SENTRY_GITHUB_APP_USER_ID},
            self.repo.id,
        )

        mock_metrics_incr.assert_any_call("ai.autofix.pr.opened", tags={"mode": "explorer"})
        assert_last_analytics_event(
            mock_analytics_record,
            AiAutofixPrOpenedEvent(
                organization_id=self.organization.id,
                integration="github",
                project_id=group.project.id,
                group_id=group.id,
                run_id=1,
                github_app="sentry",
                sent_at=1736937000000,
            ),
        )

        # Feature flag defaults off — no attribution row without it.
        assert not PullRequestAttribution.objects.exists()

    @override_settings(SEER_AUTOFIX_GITHUB_APP_USER_ID="12345")
    @patch("sentry.seer.autofix.webhooks.get_agent_state_from_pr_id")
    @patch("sentry.seer.autofix.webhooks.analytics.record")
    @patch("sentry.seer.autofix.webhooks.metrics.incr")
    def test_closed(
        self, mock_metrics_incr, mock_analytics_record, mock_get_agent_state_from_pr_id
    ):
        group = self.create_group(project=self.project)
        mock_get_agent_state_from_pr_id.return_value = SeerRunState(
            run_id=1,
            blocks=[],
            status="processing",
            updated_at="2025-01-15T12:00:00Z",
            metadata={"group_id": group.id},
        )

        with self.feature("organizations:pr-metrics-attribution"):
            handle_github_pr_webhook_for_autofix(
                self.organization,
                "closed",
                {
                    "id": 1,
                    "number": 42,
                    "html_url": PR_URL,
                    "merged": False,
                    "closed_at": "2025-01-15T12:00:00Z",
                    "updated_at": "2025-01-15T12:00:00Z",
                },
                {"id": settings.SEER_AUTOFIX_GITHUB_APP_USER_ID},
                self.repo.id,
            )

        mock_metrics_incr.assert_any_call("ai.autofix.pr.closed", tags={"mode": "explorer"})
        assert_last_analytics_event(
            mock_analytics_record,
            AiAutofixPrClosedEvent(
                organization_id=self.organization.id,
                integration="github",
                project_id=group.project.id,
                group_id=group.id,
                run_id=1,
                github_app="seer",
                sent_at=1736942400000,
            ),
        )

        pull_request = PullRequest.objects.get(repository_id=self.repo.id, key="42")
        attribution = PullRequestAttribution.objects.get(pull_request=pull_request)
        assert attribution.source == PullRequestAttributionSource.SEER_DATA
        assert attribution.signal_details == {
            "pr_url": PR_URL,
            "group_ids": [group.id],
            "run_id": 1,
        }

    @override_settings(SEER_AUTOFIX_GITHUB_APP_USER_ID="12345")
    @patch("sentry.seer.autofix.webhooks.get_agent_state_from_pr_id")
    @patch("sentry.seer.autofix.webhooks.analytics.record")
    @patch("sentry.seer.autofix.webhooks.metrics.incr")
    def test_merged(
        self, mock_metrics_incr, mock_analytics_record, mock_get_agent_state_from_pr_id
    ):
        group = self.create_group(project=self.project)
        mock_get_agent_state_from_pr_id.return_value = SeerRunState(
            run_id=1,
            blocks=[],
            status="processing",
            updated_at="2025-01-15T14:00:00Z",
            metadata={"group_id": group.id},
        )

        with self.feature("organizations:pr-metrics-attribution"):
            handle_github_pr_webhook_for_autofix(
                self.organization,
                "closed",
                {
                    "id": 1,
                    "number": 42,
                    "html_url": PR_URL,
                    "merged": True,
                    "merged_at": "2025-01-15T14:00:00Z",
                    "updated_at": "2025-01-15T14:00:00Z",
                },
                {"id": settings.SEER_AUTOFIX_GITHUB_APP_USER_ID},
                self.repo.id,
            )
        mock_metrics_incr.assert_any_call("ai.autofix.pr.merged", tags={"mode": "explorer"})
        assert_last_analytics_event(
            mock_analytics_record,
            AiAutofixPrMergedEvent(
                organization_id=self.organization.id,
                integration="github",
                project_id=group.project.id,
                group_id=group.id,
                run_id=1,
                github_app="seer",
                sent_at=1736949600000,
            ),
        )

        pull_request = PullRequest.objects.get(repository_id=self.repo.id, key="42")
        assert PullRequestAttribution.objects.filter(pull_request=pull_request).exists()

    @override_settings(SEER_AUTOFIX_GITHUB_APP_USER_ID="12345")
    @patch("sentry.seer.autofix.webhooks.get_agent_state_from_pr_id")
    @patch("sentry.seer.autofix.webhooks.analytics.record")
    @patch("sentry.seer.autofix.webhooks.metrics.incr")
    def test_merges_with_existing_seer_created_attribution(
        self, mock_metrics_incr, mock_analytics_record, mock_get_agent_state_from_pr_id
    ):
        """The seer.pr_created flow may have already written a SEER_DATA/SENTRY_APP
        row (via ``attribute_seer_created_pull_requests``) for a different group_id
        than what the live RPC lookup resolves here — the two writes must merge
        rather than one clobbering the other.
        """
        group = self.create_group(project=self.project)
        other_group = self.create_group(project=self.project)
        pull_request = self.create_pull_request(
            organization_id=self.organization.id,
            repository_id=self.repo.id,
            key="42",
        )
        PullRequestAttribution.objects.create(
            pull_request=pull_request,
            signal_type=PullRequestAttributionSignalType.SENTRY_APP,
            source=PullRequestAttributionSource.SEER_DATA,
            is_valid=True,
            signal_details={
                "pr_url": PR_URL,
                "group_ids": [other_group.id],
                "run_id": 1,
            },
        )

        mock_get_agent_state_from_pr_id.return_value = SeerRunState(
            run_id=1,
            blocks=[],
            status="processing",
            updated_at="2025-01-15T12:00:00Z",
            metadata={"group_id": group.id},
        )

        with self.feature("organizations:pr-metrics-attribution"):
            handle_github_pr_webhook_for_autofix(
                self.organization,
                "closed",
                {
                    "id": 1,
                    "number": 42,
                    "html_url": PR_URL,
                    "merged": False,
                    "closed_at": "2025-01-15T12:00:00Z",
                    "updated_at": "2025-01-15T12:00:00Z",
                },
                {"id": settings.SEER_AUTOFIX_GITHUB_APP_USER_ID},
                self.repo.id,
            )

        assert PullRequestAttribution.objects.filter(pull_request=pull_request).count() == 1
        attribution = PullRequestAttribution.objects.get(pull_request=pull_request)
        assert attribution.signal_details == {
            "pr_url": PR_URL,
            "group_ids": sorted([group.id, other_group.id]),
            "run_id": 1,
        }

    @override_settings(SEER_AUTOFIX_GITHUB_APP_USER_ID="12345")
    @patch("sentry.seer.autofix.webhooks.get_agent_state_from_pr_id")
    @patch("sentry.seer.autofix.webhooks.analytics.record")
    @patch("sentry.seer.autofix.webhooks.metrics.incr")
    def test_skips_attribution_when_pr_number_missing(
        self, mock_metrics_incr, mock_analytics_record, mock_get_agent_state_from_pr_id
    ):
        group = self.create_group(project=self.project)
        mock_get_agent_state_from_pr_id.return_value = SeerRunState(
            run_id=1,
            blocks=[],
            status="processing",
            updated_at="2025-01-15T10:30:00Z",
            metadata={"group_id": group.id},
        )

        with self.feature("organizations:pr-metrics-attribution"):
            handle_github_pr_webhook_for_autofix(
                self.organization,
                "opened",
                {
                    "id": 1,
                    "html_url": PR_URL,
                    "merged": False,
                    "created_at": "2025-01-15T10:30:00Z",
                    "updated_at": "2025-01-15T10:30:00Z",
                },
                {"id": settings.SEER_AUTOFIX_GITHUB_APP_USER_ID},
                self.repo.id,
            )

        # Analytics still fire even though there's no PR number to attribute against.
        mock_metrics_incr.assert_any_call("ai.autofix.pr.opened", tags={"mode": "explorer"})
        assert_last_analytics_event(
            mock_analytics_record,
            AiAutofixPrOpenedEvent(
                organization_id=self.organization.id,
                integration="github",
                project_id=group.project.id,
                group_id=group.id,
                run_id=1,
                github_app="seer",
                sent_at=1736937000000,
            ),
        )
        assert not PullRequestAttribution.objects.exists()

    @override_settings(SEER_AUTOFIX_GITHUB_APP_USER_ID="12345")
    @patch("sentry.seer.autofix.webhooks.record_attribution_signal")
    @patch("sentry.seer.autofix.webhooks.get_agent_state_from_pr_id")
    @patch("sentry.seer.autofix.webhooks.analytics.record")
    @patch("sentry.seer.autofix.webhooks.metrics.incr")
    def test_attribution_failure_does_not_block_analytics(
        self,
        mock_metrics_incr,
        mock_analytics_record,
        mock_get_agent_state_from_pr_id,
        mock_record_attribution_signal,
    ):
        group = self.create_group(project=self.project)
        mock_get_agent_state_from_pr_id.return_value = SeerRunState(
            run_id=1,
            blocks=[],
            status="processing",
            updated_at="2025-01-15T10:30:00Z",
            metadata={"group_id": group.id},
        )
        mock_record_attribution_signal.side_effect = RuntimeError("boom")

        with self.feature("organizations:pr-metrics-attribution"):
            handle_github_pr_webhook_for_autofix(
                self.organization,
                "opened",
                {
                    "id": 1,
                    "number": 42,
                    "html_url": PR_URL,
                    "merged": False,
                    "created_at": "2025-01-15T10:30:00Z",
                    "updated_at": "2025-01-15T10:30:00Z",
                },
                {"id": settings.SEER_AUTOFIX_GITHUB_APP_USER_ID},
                self.repo.id,
            )

        # The analytics event already fired before the attribution write raised.
        mock_metrics_incr.assert_any_call("ai.autofix.pr.opened", tags={"mode": "explorer"})
        assert_last_analytics_event(
            mock_analytics_record,
            AiAutofixPrOpenedEvent(
                organization_id=self.organization.id,
                integration="github",
                project_id=group.project.id,
                group_id=group.id,
                run_id=1,
                github_app="seer",
                sent_at=1736937000000,
            ),
        )
        assert not PullRequestAttribution.objects.exists()

    @override_settings(SEER_AUTOFIX_GITHUB_APP_USER_ID="12345")
    @patch("sentry.seer.autofix.webhooks.get_agent_state_from_pr_id")
    @patch("sentry.seer.autofix.webhooks.analytics.record")
    @patch("sentry.seer.autofix.webhooks.metrics.incr")
    def test_no_run(
        self, mock_metrics_incr, mock_analytics_record, mock_get_agent_state_from_pr_id
    ):
        mock_get_agent_state_from_pr_id.return_value = None
        handle_github_pr_webhook_for_autofix(
            self.organization,
            "closed",
            {
                "id": 1,
                "number": 42,
                "html_url": PR_URL,
                "merged": True,
                "merged_at": "2025-01-15T14:00:00Z",
                "updated_at": "2025-01-15T14:00:00Z",
            },
            {"id": settings.SEER_AUTOFIX_GITHUB_APP_USER_ID},
            self.repo.id,
        )

        for key in ["ai.autofix.pr.merged", "ai.autofix.pr.closed", "ai.autofix.pr.opened"]:
            assert call(key) not in mock_metrics_incr.call_args_list

        assert_not_analytics_event(mock_analytics_record, AiAutofixPrClosedEvent)
        assert_not_analytics_event(mock_analytics_record, AiAutofixPrMergedEvent)
        assert_not_analytics_event(mock_analytics_record, AiAutofixPrOpenedEvent)
        assert not PullRequestAttribution.objects.exists()

    @override_settings(SEER_AUTOFIX_GITHUB_APP_USER_ID=None)
    @patch("sentry.seer.autofix.webhooks.get_agent_state_from_pr_id")
    @patch("sentry.seer.autofix.webhooks.analytics.record")
    @patch("sentry.seer.autofix.webhooks.metrics.incr")
    def test_no_settings_github_app_id_set(
        self, mock_metrics_incr, mock_analytics_record, mock_get_agent_state_from_pr_id
    ):
        mock_get_agent_state_from_pr_id.return_value = None
        handle_github_pr_webhook_for_autofix(
            self.organization,
            "closed",
            {
                "id": 1,
                "number": 42,
                "html_url": PR_URL,
                "merged": True,
                "merged_at": "2025-01-15T14:00:00Z",
                "updated_at": "2025-01-15T14:00:00Z",
            },
            {"id": "5655"},
            self.repo.id,
        )

        for key in ["ai.autofix.pr.merged", "ai.autofix.pr.closed", "ai.autofix.pr.opened"]:
            assert call(key) not in mock_metrics_incr.call_args_list
            assert call(key) not in mock_analytics_record.call_args_list

    @override_settings(SEER_AUTOFIX_GITHUB_APP_USER_ID="12345")
    @patch("sentry.seer.autofix.webhooks.get_agent_state_from_pr_id")
    @patch("sentry.seer.autofix.webhooks.analytics.record")
    @patch("sentry.seer.autofix.webhooks.metrics.incr")
    def test_no_different_github_app(
        self, mock_metrics_incr, mock_analytics_record, mock_get_agent_state_from_pr_id
    ):
        mock_get_agent_state_from_pr_id.return_value = None
        handle_github_pr_webhook_for_autofix(
            self.organization,
            "closed",
            {
                "id": 1,
                "number": 42,
                "html_url": PR_URL,
                "merged": True,
                "merged_at": "2025-01-15T14:00:00Z",
                "updated_at": "2025-01-15T14:00:00Z",
            },
            {"id": "321"},
            self.repo.id,
        )

        for key in ["ai.autofix.pr.merged", "ai.autofix.pr.closed", "ai.autofix.pr.opened"]:
            assert call(key) not in mock_metrics_incr.call_args_list
            assert call(key) not in mock_analytics_record.call_args_list
