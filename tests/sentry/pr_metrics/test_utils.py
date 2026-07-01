from datetime import datetime, timedelta
from datetime import timezone as dt_timezone
from unittest.mock import Mock, patch

from django.utils import timezone

from sentry.constants import ObjectStatus
from sentry.models.pullrequest import (
    PullRequest,
    PullRequestAttribution,
    PullRequestAttributionSignalType,
    PullRequestAttributionSource,
    PullRequestLifecycleState,
    PullRequestMetrics,
    PullRequestVerdict,
)
from sentry.pr_metrics.utils import (
    is_activity_tracking_enabled,
    iso_or_none,
    org_has_coding_agent_for_provider,
)
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

    def test_closed_pr_returns_false_without_db_queries(self) -> None:
        pr = self._make_pr()
        pr.state = PullRequestLifecycleState.CLOSED
        pr.save()
        with self.feature("organizations:pr-metrics-activity"):
            assert not is_activity_tracking_enabled(self.organization, pr=pr)

    def test_merged_pr_returns_false_without_db_queries(self) -> None:
        pr = self._make_pr()
        pr.state = PullRequestLifecycleState.MERGED
        pr.save()
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


class IsoOrNoneTest(TestCase):
    def test_returns_iso_string_for_datetime(self) -> None:
        dt = datetime(2024, 1, 15, 12, 30, 45, tzinfo=dt_timezone.utc)
        assert iso_or_none(dt) == "2024-01-15T12:30:45+00:00"

    def test_returns_none_for_none(self) -> None:
        assert iso_or_none(None) is None


class OrgHasCodingAgentForProviderTest(TestCase):
    _mock_path = "sentry.pr_metrics.utils.integration_service.get_integrations"

    def test_returns_true_when_active_integration_exists(self) -> None:
        mock_integration = Mock()
        with patch(self._mock_path, return_value=[mock_integration]):
            assert org_has_coding_agent_for_provider(self.organization, "claude_code") is True

    def test_returns_false_when_no_integration_exists(self) -> None:
        with patch(self._mock_path, return_value=[]):
            assert org_has_coding_agent_for_provider(self.organization, "claude_code") is False

    def test_passes_provider_and_active_org_status_to_service(self) -> None:
        with patch(self._mock_path, return_value=[]) as mock_get:
            org_has_coding_agent_for_provider(self.organization, "github_copilot")
            mock_get.assert_called_once_with(
                organization_id=self.organization.id,
                providers=["github_copilot"],
                org_integration_status=ObjectStatus.ACTIVE,
            )
