from datetime import timedelta

from django.utils import timezone

from sentry.models.pullrequest import (
    PullRequestAttribution,
    PullRequestAttributionSignalType,
    PullRequestAttributionSource,
)
from sentry.pr_metrics.utils import is_activity_tracking_enabled
from sentry.testutils.cases import TestCase
from sentry.testutils.helpers.datetime import freeze_time


class IsActivityTrackingEnabledTest(TestCase):
    def setUp(self) -> None:
        self.repo = self.create_repo(
            self.project, name="getsentry/sentry", provider="integrations:github"
        )

    def _make_pr(self):
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
        past = timezone.now() - timedelta(hours=5)
        with freeze_time(past):
            pr = self._make_pr()

        with self.feature("organizations:pr-metrics-activity"):
            assert not is_activity_tracking_enabled(self.organization, pr=pr)

    def test_after_buffer_with_valid_attribution_returns_true(self) -> None:
        past = timezone.now() - timedelta(hours=5)
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
        past = timezone.now() - timedelta(hours=5)
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
