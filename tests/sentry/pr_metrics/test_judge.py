from datetime import datetime, timezone
from typing import Any
from unittest.mock import patch

from sentry.analytics.events.pr_metrics_events import PrCloseMetricsEvent
from sentry.models.pullrequest import (
    PullRequestAttribution,
    PullRequestAttributionSignalType,
    PullRequestAttributionSource,
    PullRequestMetrics,
)
from sentry.pr_metrics.attribution import record_attribution_signal
from sentry.pr_metrics.judge import upsert_pr_metrics_summary
from sentry.testutils.cases import TestCase
from sentry.testutils.helpers.analytics import get_event_count
from sentry.testutils.silo import cell_silo_test

HEAD_SHA = "a" * 40
# Past year avoids the S015 future-date lint.
CLOSED_AT = datetime(2020, 6, 4, 10, 0, 0, tzinfo=timezone.utc)


def _last_row(mock_record: Any) -> PrCloseMetricsEvent:
    return mock_record.call_args_list[-1].args[0]


@cell_silo_test
class UpsertPrMetricsSummaryTest(TestCase):
    def setUp(self) -> None:
        self.repo = self.create_repo(
            self.project, name="getsentry/sentry", provider="integrations:github"
        )
        self.pull_request = self.create_pull_request(
            repository_id=self.repo.id, organization_id=self.organization.id, key="42"
        )
        # Persisted so the handler's re-fetch + emit see a terminal PR.
        self.pull_request.update(head_commit_sha=HEAD_SHA, closed_at=CLOSED_AT, merged_at=CLOSED_AT)

    def _track(self) -> None:
        # A valid attribution makes the PR "tracked" so emit isn't skipped.
        record_attribution_signal(
            pull_request=self.pull_request,
            signal_type=PullRequestAttributionSignalType.SENTRY_APP,
            source=PullRequestAttributionSource.WEBHOOK_DATA,
        )

    def _call(self, **kwargs: Any) -> dict[str, Any]:
        return upsert_pr_metrics_summary(
            pull_request_id=self.pull_request.id,
            organization_id=self.organization.id,
            repository_id=self.repo.id,
            **kwargs,
        )

    @patch("sentry.analytics.record")
    def test_persists_verdict_and_emits_enriched_row(self, mock_record: Any) -> None:
        self._track()
        result = self._call(verdict="merged_with_iteration")

        assert result == {"success": True}
        assert PullRequestMetrics.objects.get(pull_request=self.pull_request).verdict == (
            "merged_with_iteration"
        )
        assert get_event_count(mock_record, PrCloseMetricsEvent) == 1
        assert _last_row(mock_record).verdict == "merged_with_iteration"

    @patch("sentry.analytics.record")
    def test_records_seer_attributions(self, mock_record: Any) -> None:
        result = self._call(
            verdict="merged_unchanged",
            attributions=[
                {
                    "signal_type": "seer_delegated:claude_code",
                    "source": "seer_llm_judge",
                    "signal_details": {"confidence": 0.9},
                }
            ],
        )

        assert result == {"success": True}
        signal = PullRequestAttribution.objects.get(
            pull_request=self.pull_request, source=PullRequestAttributionSource.SEER_LLM_JUDGE
        )
        assert signal.signal_type == "seer_delegated:claude_code"
        assert signal.signal_details == {"confidence": 0.9}
        # The recorded signal makes the PR tracked, so the row emits.
        assert get_event_count(mock_record, PrCloseMetricsEvent) == 1

    @patch("sentry.analytics.record")
    def test_scopes_lookup_to_org_and_repo(self, mock_record: Any) -> None:
        self._track()
        other_org = self.create_organization()

        result = upsert_pr_metrics_summary(
            pull_request_id=self.pull_request.id,
            organization_id=other_org.id,
            repository_id=self.repo.id,
            verdict="merged_unchanged",
        )

        assert result == {"success": False, "error": "pull_request_not_found"}
        assert not PullRequestMetrics.objects.filter(pull_request=self.pull_request).exists()
        assert mock_record.call_count == 0

    @patch("sentry.analytics.record")
    def test_rejects_invalid_verdict(self, mock_record: Any) -> None:
        self._track()
        result = self._call(verdict="not_a_verdict")

        assert result == {"success": False, "error": "invalid_verdict"}
        assert not PullRequestMetrics.objects.filter(pull_request=self.pull_request).exists()
        assert mock_record.call_count == 0

    @patch("sentry.analytics.record")
    def test_rejects_invalid_attribution(self, mock_record: Any) -> None:
        self._track()
        result = self._call(
            verdict="merged_unchanged",
            attributions=[{"signal_type": "bogus", "source": "seer_llm_judge"}],
        )

        assert result == {"success": False, "error": "invalid_attribution"}
        # Rejected before any write — verdict not persisted.
        assert not PullRequestMetrics.objects.filter(pull_request=self.pull_request).exists()
        assert mock_record.call_count == 0

    @patch("sentry.analytics.record")
    def test_rejects_wrong_shape_attributions(self, mock_record: Any) -> None:
        self._track()
        # A single object instead of a list of objects: iterating it yields keys,
        # which must surface as invalid_attribution rather than a generic error.
        result = self._call(
            verdict="merged_unchanged",
            attributions={"signal_type": "seer_delegated:claude_code", "source": "seer_llm_judge"},
        )

        assert result == {"success": False, "error": "invalid_attribution"}
        assert not PullRequestMetrics.objects.filter(pull_request=self.pull_request).exists()
        assert mock_record.call_count == 0

    @patch("sentry.analytics.record")
    def test_does_not_clobber_webhook_counters(self, mock_record: Any) -> None:
        self._track()
        PullRequestMetrics.objects.create(
            pull_request=self.pull_request, additions=10, deletions=5, is_assigned=True
        )

        result = self._call(verdict="merged_unchanged")

        assert result == {"success": True}
        metrics = PullRequestMetrics.objects.get(pull_request=self.pull_request)
        assert metrics.verdict == "merged_unchanged"
        # Webhook-sourced counters survive the judge upsert.
        assert metrics.additions == 10
        assert metrics.deletions == 5
        assert metrics.is_assigned is True

    @patch("sentry.analytics.record")
    def test_rejects_missing_verdict(self, mock_record: Any) -> None:
        self._track()

        # The verdict is the judge result; a call without one is malformed input
        # and must not reach the upsert (which would otherwise store a null).
        result = self._call()

        assert result == {"success": False, "error": "invalid_verdict"}
        assert not PullRequestMetrics.objects.filter(pull_request=self.pull_request).exists()
        assert mock_record.call_count == 0

    @patch("sentry.analytics.record")
    def test_pull_request_not_found(self, mock_record: Any) -> None:
        result = upsert_pr_metrics_summary(
            pull_request_id=self.pull_request.id + 1000,
            organization_id=self.organization.id,
            repository_id=self.repo.id,
            verdict="merged_unchanged",
        )

        assert result == {"success": False, "error": "pull_request_not_found"}
        assert mock_record.call_count == 0

    @patch("sentry.analytics.record")
    def test_persists_but_skips_emit_for_untracked_pr(self, mock_record: Any) -> None:
        # No attribution anywhere: the verdict is still stored, but the row is not
        # emitted (untracked PRs are never emitted).
        result = self._call(verdict="closed_unmerged")

        assert result == {"success": True}
        assert PullRequestMetrics.objects.get(pull_request=self.pull_request).verdict == (
            "closed_unmerged"
        )
        assert mock_record.call_count == 0
