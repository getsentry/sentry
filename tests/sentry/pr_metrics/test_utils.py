from datetime import timedelta

from django.utils import timezone

from sentry.constants import ObjectStatus
from sentry.integrations.claude_code.integration import PROVIDER_KEY as claude_provider_key
from sentry.integrations.github_copilot.integration import GithubCopilotIntegrationProvider

copilot_provider_key = GithubCopilotIntegrationProvider.key
from sentry.models.pullrequest import (
    PullRequest,
    PullRequestAttribution,
    PullRequestAttributionSignalType,
    PullRequestAttributionSource,
    PullRequestLifecycleState,
    PullRequestMetrics,
    PullRequestVerdict,
)
from sentry.pr_metrics.utils import is_activity_tracking_enabled, org_has_coding_agent_for_provider
from sentry.testutils.cases import TestCase
from sentry.testutils.helpers.datetime import freeze_time


class IsActivityTrackingEnabledTest(TestCase):
    def setUp(self) -> None:
        self.repo = self.create_repo(
            self.project, name="getsentry/sentry", provider="integrations:github"
        )

    def _make_pr(self) -> "PullRequest":
        return self.create_pull_request(
            organization_id=self.organization.id,
            repository_id=self.repo.id,
        )

    def test_feature_flag_disabled_returns_false(self) -> None:
        pr = self._make_pr()
        assert not is_activity_tracking_enabled(self.organization, pr=pr)

    def test_no_pr_returns_true_when_flag_enabled(self) -> None:
        with self.feature("organizations:pr-metrics-activity"):
            assert is_activity_tracking_enabled(self.organization)

    def test_within_buffer_no_attribution_returns_true(self) -> None:
        now = timezone.now()
        with freeze_time(now):
            pr = self._make_pr()
            with self.feature("organizations:pr-metrics-activity"):
                assert is_activity_tracking_enabled(self.organization, pr=pr)

    def test_within_buffer_with_attribution_returns_true(self) -> None:
        now = timezone.now()
        with freeze_time(now):
            pr = self._make_pr()
            PullRequestAttribution.objects.create(
                pull_request=pr,
                signal_type=PullRequestAttributionSignalType.SENTRY_APP,
                source=PullRequestAttributionSource.WEBHOOK_DATA,
                is_valid=True,
            )
            with self.feature("organizations:pr-metrics-activity"):
                assert is_activity_tracking_enabled(self.organization, pr=pr)

    def test_after_buffer_no_attribution_returns_false(self) -> None:
        past = timezone.now() - timedelta(hours=31)
        with freeze_time(past):
            pr = self._make_pr()

        with self.feature("organizations:pr-metrics-activity"):
            assert not is_activity_tracking_enabled(self.organization, pr=pr)

    def test_after_buffer_with_valid_attribution_returns_true(self) -> None:
        past = timezone.now() - timedelta(hours=31)
        with freeze_time(past):
            pr = self._make_pr()

        PullRequestAttribution.objects.create(
            pull_request=pr,
            signal_type=PullRequestAttributionSignalType.SENTRY_APP,
            source=PullRequestAttributionSource.WEBHOOK_DATA,
            is_valid=True,
        )
        with self.feature("organizations:pr-metrics-activity"):
            assert is_activity_tracking_enabled(self.organization, pr=pr)

    def test_after_buffer_only_invalid_attribution_returns_false(self) -> None:
        past = timezone.now() - timedelta(hours=31)
        with freeze_time(past):
            pr = self._make_pr()

        PullRequestAttribution.objects.create(
            pull_request=pr,
            signal_type=PullRequestAttributionSignalType.SENTRY_APP,
            source=PullRequestAttributionSource.WEBHOOK_DATA,
            is_valid=False,
        )
        with self.feature("organizations:pr-metrics-activity"):
            assert not is_activity_tracking_enabled(self.organization, pr=pr)

    def test_superseded_pr_returns_false_without_db_queries(self) -> None:
        pr = self._make_pr()
        pr.state = PullRequestLifecycleState.SUPERSEDED
        pr.save()
        with self.feature("organizations:pr-metrics-activity"):
            assert not is_activity_tracking_enabled(self.organization, pr=pr)

    def test_closed_pr_within_buffer_collects_activity_to_capture_closer(self) -> None:
        # CLOSED/MERGED are intentionally not short-circuited: the close webhook
        # stamps the terminal state before tracking runs, so the row recording the
        # closer must still be written. Within the buffer, no attribution is needed.
        pr = self._make_pr()
        pr.state = PullRequestLifecycleState.CLOSED
        pr.save()
        with self.feature("organizations:pr-metrics-activity"):
            assert is_activity_tracking_enabled(self.organization, pr=pr)

    def test_merged_pr_within_buffer_collects_activity_to_capture_closer(self) -> None:
        pr = self._make_pr()
        pr.state = PullRequestLifecycleState.MERGED
        pr.save()
        with self.feature("organizations:pr-metrics-activity"):
            assert is_activity_tracking_enabled(self.organization, pr=pr)

    def test_terminal_pr_blocked_once_verdict_claimed(self) -> None:
        # The verdict gate still stops activity on an already-settled terminal PR
        # (a redelivered or reopened-then-reclosed close), so it isn't unbounded.
        pr = self._make_pr()
        pr.state = PullRequestLifecycleState.MERGED
        pr.save()
        PullRequestMetrics.objects.create(
            pull_request=pr,
            verdict=PullRequestVerdict.MERGED_UNCHANGED,
        )
        with self.feature("organizations:pr-metrics-activity"):
            assert not is_activity_tracking_enabled(self.organization, pr=pr)

    def test_after_buffer_valid_attribution_but_verdict_set_returns_false(self) -> None:
        past = timezone.now() - timedelta(hours=31)
        with freeze_time(past):
            pr = self._make_pr()

        PullRequestAttribution.objects.create(
            pull_request=pr,
            signal_type=PullRequestAttributionSignalType.SENTRY_APP,
            source=PullRequestAttributionSource.WEBHOOK_DATA,
            is_valid=True,
        )
        PullRequestMetrics.objects.create(
            pull_request=pr,
            verdict=PullRequestVerdict.MERGED_UNCHANGED,
        )
        with self.feature("organizations:pr-metrics-activity"):
            assert not is_activity_tracking_enabled(self.organization, pr=pr)

    def test_open_pr_within_buffer_not_blocked_by_state_check(self) -> None:
        now = timezone.now()
        with freeze_time(now):
            pr = self._make_pr()
            pr.state = PullRequestLifecycleState.OPEN
            pr.save()
            with self.feature("organizations:pr-metrics-activity"):
                assert is_activity_tracking_enabled(self.organization, pr=pr)

    def test_for_terminal_event_bypasses_state_and_verdict_gates(self) -> None:
        pr = self._make_pr()
        pr.state = PullRequestLifecycleState.SUPERSEDED
        pr.save()
        PullRequestMetrics.objects.create(
            pull_request=pr, verdict=PullRequestVerdict.MERGED_UNCHANGED
        )
        with self.feature("organizations:pr-metrics-activity"):
            # The normal gate blocks (superseded state + claimed verdict)...
            assert not is_activity_tracking_enabled(self.organization, pr=pr)
            # ...but a terminal event bypasses both, subject only to the buffer gate.
            assert is_activity_tracking_enabled(self.organization, pr=pr, for_terminal_event=True)

    def test_for_terminal_event_still_requires_buffer_or_attribution(self) -> None:
        past = timezone.now() - timedelta(hours=31)
        with freeze_time(past):
            pr = self._make_pr()
        with self.feature("organizations:pr-metrics-activity"):
            # Outside the buffer with no attribution, even a terminal event is gated.
            assert not is_activity_tracking_enabled(
                self.organization, pr=pr, for_terminal_event=True
            )


class OrgHasCodingAgentForProviderTest(TestCase):
    def test_returns_true_when_active_integration_exists(self) -> None:
        self.create_integration(
            organization=self.organization,
            provider=claude_provider_key,
            name="Claude Code",
            external_id="claude_code:1",
        )
        assert org_has_coding_agent_for_provider(self.organization, claude_provider_key) is True

    def test_returns_false_when_no_integration_exists(self) -> None:
        assert org_has_coding_agent_for_provider(self.organization, claude_provider_key) is False

    def test_returns_false_for_different_provider(self) -> None:
        self.create_integration(
            organization=self.organization,
            provider=claude_provider_key,
            name="Claude Code",
            external_id="claude_code:1",
        )
        assert org_has_coding_agent_for_provider(self.organization, copilot_provider_key) is False

    def test_returns_false_when_org_integration_is_disabled(self) -> None:
        self.create_integration(
            organization=self.organization,
            provider=claude_provider_key,
            name="Claude Code",
            external_id="claude_code:1",
            oi_params={"status": ObjectStatus.DISABLED},
        )
        assert org_has_coding_agent_for_provider(self.organization, claude_provider_key) is False
