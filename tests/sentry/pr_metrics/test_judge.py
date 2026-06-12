from datetime import datetime, timezone
from typing import Any
from unittest.mock import Mock, patch

import orjson
import pytest
from urllib3.exceptions import HTTPError

from sentry.analytics.events.pr_metrics_events import PrCloseMetricsEvent
from sentry.models.pullrequest import (
    PullRequestAttribution,
    PullRequestAttributionSignalType,
    PullRequestAttributionSource,
    PullRequestMetrics,
    PullRequestVerdict,
)
from sentry.pr_metrics.attribution import record_attribution_signal
from sentry.pr_metrics.judge import forward_pr_to_seer_judge, update_pr_metrics
from sentry.testutils.cases import TestCase
from sentry.testutils.helpers.analytics import get_event_count
from sentry.testutils.silo import cell_silo_test

HEAD_SHA = "a" * 40
MERGE_SHA = "b" * 40
# Past year avoids the S015 future-date lint.
OPENED_AT = datetime(2020, 6, 4, 9, 0, 0, tzinfo=timezone.utc)
CLOSED_AT = datetime(2020, 6, 4, 10, 0, 0, tzinfo=timezone.utc)


def _last_row(mock_record: Any) -> PrCloseMetricsEvent:
    return mock_record.call_args_list[-1].args[0]


@cell_silo_test
class UpdatePrMetricsTest(TestCase):
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
        return update_pr_metrics(
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

        result = update_pr_metrics(
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
    def test_rejects_non_object_signal_details(self, mock_record: Any) -> None:
        self._track()
        # signal_details must be an object; a scalar would raise in
        # record_attribution_signal, so it must be caught as invalid_attribution.
        result = self._call(
            verdict="merged_unchanged",
            attributions=[
                {
                    "signal_type": "seer_delegated:claude_code",
                    "source": "seer_llm_judge",
                    "signal_details": "not-an-object",
                }
            ],
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
        result = update_pr_metrics(
            pull_request_id=self.pull_request.id + 1000,
            organization_id=self.organization.id,
            repository_id=self.repo.id,
            verdict="merged_unchanged",
        )

        assert result == {"success": False, "error": "pull_request_not_found"}
        assert mock_record.call_count == 0

    @patch("sentry.analytics.record")
    def test_rejects_non_terminal_pr(self, mock_record: Any) -> None:
        self._track()
        # A PR that never reached a terminal state can't build a row. Reject up
        # front so we don't commit the verdict and then fail in emit.
        self.pull_request.update(closed_at=None, head_commit_sha=None)

        result = self._call(verdict="merged_unchanged")

        assert result == {"success": False, "error": "pull_request_not_terminal"}
        assert not PullRequestMetrics.objects.filter(pull_request=self.pull_request).exists()
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

    @patch("sentry.analytics.record")
    def test_rejects_sentinel_verdict(self, mock_record: Any) -> None:
        # JUDGE_IN_PROGRESS is Sentry's internal forward sentinel, never a judge
        # result — Seer echoing it back is malformed input.
        self._track()
        result = self._call(verdict="judge_in_progress")

        assert result == {"success": False, "error": "invalid_verdict"}
        assert not PullRequestMetrics.objects.filter(pull_request=self.pull_request).exists()
        assert mock_record.call_count == 0

    @patch("sentry.analytics.record")
    def test_settles_row_claimed_for_judge(self, mock_record: Any) -> None:
        # The real flow: the forward path claimed JUDGE_IN_PROGRESS, and the callback
        # transitions it to the judged verdict and emits.
        self._track()
        PullRequestMetrics.objects.create(
            pull_request=self.pull_request, verdict=PullRequestVerdict.JUDGE_IN_PROGRESS
        )
        result = self._call(verdict="merged_with_iteration")

        assert result == {"success": True}
        assert PullRequestMetrics.objects.get(pull_request=self.pull_request).verdict == (
            "merged_with_iteration"
        )
        assert get_event_count(mock_record, PrCloseMetricsEvent) == 1

    @patch("sentry.analytics.record")
    def test_retried_callback_does_not_re_emit(self, mock_record: Any) -> None:
        # A retried Seer callback finds the row already settled — single-emit holds.
        self._track()
        self._call(verdict="merged_unchanged")
        result = self._call(verdict="merged_unchanged")

        assert result == {"success": True}
        assert get_event_count(mock_record, PrCloseMetricsEvent) == 1

    @patch("sentry.analytics.record")
    def test_retried_callback_keeps_first_verdict(self, mock_record: Any) -> None:
        # The first settled verdict is authoritative; a later differing callback is
        # a no-op rather than overwriting and re-emitting.
        self._track()
        self._call(verdict="merged_unchanged")
        result = self._call(verdict="merged_with_iteration")

        assert result == {"success": True}
        assert PullRequestMetrics.objects.get(pull_request=self.pull_request).verdict == (
            "merged_unchanged"
        )
        assert get_event_count(mock_record, PrCloseMetricsEvent) == 1


@cell_silo_test
class ForwardPrToSeerJudgeTest(TestCase):
    """The Sentry → Seer forward: assemble the judge request and classify the response."""

    def setUp(self) -> None:
        self.repo = self.create_repo(
            self.project, name="getsentry/sentry", provider="integrations:github"
        )
        self.repo.update(external_id="10270250", integration_id=99)
        self.pull_request = self.create_pull_request(
            repository_id=self.repo.id, organization_id=self.organization.id, key="42"
        )
        self.pull_request.update(
            head_commit_sha=HEAD_SHA,
            merge_commit_sha=MERGE_SHA,
            opened_at=OPENED_AT,
            closed_at=CLOSED_AT,
            merged_at=CLOSED_AT,
        )
        PullRequestMetrics.objects.create(
            pull_request=self.pull_request, additions=12, comments_count=5
        )

    def _response(self, status: int) -> Mock:
        response = Mock()
        response.status = status
        return response

    @patch("sentry.pr_metrics.judge.make_signed_seer_api_request")
    def test_forwards_terminal_facts_and_repo_identity(self, mock_request: Any) -> None:
        mock_request.return_value = self._response(202)
        forward_pr_to_seer_judge(self.pull_request, self.repo)

        kwargs = mock_request.call_args.kwargs
        assert kwargs["path"] == "/v1/code_review/pr-metrics-judge"
        body = orjson.loads(kwargs["body"])
        assert body["pull_request_id"] == self.pull_request.id
        assert body["organization_id"] == self.organization.id
        assert body["repository_id"] == self.repo.id
        assert body["pr_number"] == "42"
        assert body["close_action"] == "merged"
        assert body["head_commit_sha"] == HEAD_SHA
        assert body["merge_commit_sha"] == MERGE_SHA
        assert body["repo"] == {
            "provider": "integrations:github",
            "external_id": "10270250",
            "name": "getsentry/sentry",
            "integration_id": "99",
        }
        assert body["additions"] == 12
        assert body["comments_count"] == 5

    @patch("sentry.pr_metrics.judge.make_signed_seer_api_request")
    def test_close_action_is_closed_when_unmerged(self, mock_request: Any) -> None:
        mock_request.return_value = self._response(202)
        self.pull_request.update(merged_at=None, merge_commit_sha=None)
        forward_pr_to_seer_judge(self.pull_request, self.repo)

        body = orjson.loads(mock_request.call_args.kwargs["body"])
        assert body["close_action"] == "closed"
        assert body["merge_commit_sha"] is None

    @patch("sentry.pr_metrics.judge.make_signed_seer_api_request")
    def test_retryable_status_raises_for_task_retry(self, mock_request: Any) -> None:
        # 5xx/429 raise so the enclosing task's Retry policy kicks in.
        mock_request.return_value = self._response(503)
        with pytest.raises(HTTPError):
            forward_pr_to_seer_judge(self.pull_request, self.repo)

    @patch("sentry.pr_metrics.judge.metrics")
    @patch("sentry.pr_metrics.judge.make_signed_seer_api_request")
    def test_client_error_is_dropped_not_retried(
        self, mock_request: Any, mock_metrics: Any
    ) -> None:
        # A permanent 4xx is observe-only: no raise (no retry), the row stays claimed.
        mock_request.return_value = self._response(404)
        forward_pr_to_seer_judge(self.pull_request, self.repo)
        mock_metrics.incr.assert_any_call(
            "pr_metrics.judge.forward_failed", tags={"reason": "client_error"}
        )
