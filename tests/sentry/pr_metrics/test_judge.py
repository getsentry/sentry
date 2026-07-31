from datetime import datetime, timedelta, timezone
from typing import Any
from unittest.mock import Mock, patch

import orjson
import pytest
from urllib3.exceptions import HTTPError

from sentry.analytics.events.pr_metrics_events import PrCloseMetricsEvent
from sentry.models.pullrequest import (
    PullRequestActivity,
    PullRequestActivityType,
    PullRequestAttribution,
    PullRequestAttributionSignalType,
    PullRequestAttributionSource,
    PullRequestMetrics,
    PullRequestVerdict,
)
from sentry.pr_metrics.attribution import record_attribution_signal
from sentry.pr_metrics.judge import (
    _MAX_FORWARDED_CHECK_ROWS,
    _reconcile_stuck_judge_claim,
    forward_pr_to_seer_judge,
    reap_stuck_judge_verdicts,
    update_pr_metrics,
)
from sentry.seer.sentry_data_models import (
    UpdatePrMetricsErrorResponse,
    UpdatePrMetricsSuccessResponse,
)
from sentry.testutils.cases import TestCase
from sentry.testutils.helpers import with_feature
from sentry.testutils.helpers.analytics import get_event_count
from sentry.testutils.silo import cell_silo_test

HEAD_SHA = "a" * 40
MERGE_SHA = "b" * 40
# Past year avoids the S015 future-date lint.
OPENED_AT = datetime(2020, 6, 4, 9, 0, 0, tzinfo=timezone.utc)
CLOSED_AT = datetime(2020, 6, 4, 10, 0, 0, tzinfo=timezone.utc)

# The conversation judge's result as Seer sends it over the RPC: the
# semantic outputs alongside the opaque metadata drill-down bundle.
CONVERSATION_ANALYSIS = {
    "sentiment": "negative",
    "comments_bot": 0,
    "comments_human": 1,
    "comments_total": 1,
    "comments_judged": 1,
    "comments_truncated": 0,
    "metadata": {
        "judge": "conversation.v1",
        "sentiment_reasoning": "reviewer raised an unaddressed objection",
        "comment_intents": [
            {
                "comment_id": "IC_9",
                "author": "octocat",
                "author_class": "human",
                "intent": "objection",
            },
        ],
    },
}
# Cross-judge close-reason labels, sent as a top-level arg alongside the verdict.
DIAGNOSIS_LABELS = ["out_of_scope_or_unwanted"]


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

    def _call(self, **kwargs: Any) -> UpdatePrMetricsSuccessResponse | UpdatePrMetricsErrorResponse:
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

        assert result.dict() == {"success": True}
        assert PullRequestMetrics.objects.get(pull_request=self.pull_request).verdict == (
            "merged_with_iteration"
        )
        assert get_event_count(mock_record, PrCloseMetricsEvent) == 1
        assert _last_row(mock_record).verdict == "merged_with_iteration"

    @patch("sentry.analytics.record")
    def test_threads_judge_enrichment_onto_emitted_row(self, mock_record: Any) -> None:
        self._track()
        result = self._call(
            verdict="closed_unmerged",
            conversation_analysis=CONVERSATION_ANALYSIS,
            diagnosis_labels=DIAGNOSIS_LABELS,
        )

        assert result.dict() == {"success": True}
        assert get_event_count(mock_record, PrCloseMetricsEvent) == 1
        row = _last_row(mock_record)
        assert row.conversation_sentiment == "negative"
        assert row.conversation_comments_bot == 0
        assert row.conversation_comments_human == 1
        # diagnosis_labels is a cross-judge top-level arg, not part of the analysis.
        assert row.diagnosis_labels == ["out_of_scope_or_unwanted"]
        # The metadata bundle rides through verbatim as the opaque drill-down blob.
        assert row.conversation_metadata is not None
        assert orjson.loads(row.conversation_metadata) == CONVERSATION_ANALYSIS["metadata"]

    @patch("sentry.analytics.record")
    def test_unknown_sentiment_and_diagnosis_pass_through(self, mock_record: Any) -> None:
        # sentiment and the diagnosis labels are free strings — a value outside the
        # v1 vocabulary rides through verbatim, never 422s the row.
        self._track()
        conversation_analysis = {**CONVERSATION_ANALYSIS, "sentiment": "ambivalent"}
        result = self._call(
            verdict="closed_unmerged",
            conversation_analysis=conversation_analysis,
            diagnosis_labels=["brand_new_label"],
        )

        assert result.dict() == {"success": True}
        row = _last_row(mock_record)
        assert row.conversation_sentiment == "ambivalent"
        assert row.diagnosis_labels == ["brand_new_label"]

    @patch("sentry.pr_metrics.judge.metrics")
    @patch("sentry.analytics.record")
    def test_malformed_conversation_analysis_dropped_but_row_still_emits(
        self, mock_record: Any, mock_metrics: Any
    ) -> None:
        # conversation_analysis is BigQuery-only enrichment, never persisted — a
        # wrong-typed payload degrades gracefully: the verdict still settles and the
        # row emits (without judge columns), rather than 422-ing the whole callback.
        self._track()
        result = self._call(
            verdict="closed_unmerged",
            conversation_analysis={"comments_total": "not-an-int"},
        )

        assert result.dict() == {"success": True}
        assert PullRequestMetrics.objects.get(pull_request=self.pull_request).verdict == (
            "closed_unmerged"
        )
        assert get_event_count(mock_record, PrCloseMetricsEvent) == 1
        row = _last_row(mock_record)
        assert row.conversation_sentiment is None
        assert row.conversation_comments_total is None
        assert row.conversation_metadata is None
        mock_metrics.incr.assert_any_call("pr_metrics.update.invalid_conversation_analysis")

    @patch("sentry.pr_metrics.judge.metrics")
    @patch("sentry.analytics.record")
    def test_non_serializable_metadata_dropped_but_row_still_emits(
        self, mock_record: Any, mock_metrics: Any
    ) -> None:
        # metadata is emitted as JSON outside the parse guard and after the verdict
        # commits; a structurally-valid but non-serializable value (a bare object)
        # must still be dropped gracefully, not raise mid-emit and 500 the callback.
        self._track()
        result = self._call(
            verdict="closed_unmerged",
            conversation_analysis={"sentiment": "negative", "metadata": {"obj": object()}},
        )

        assert result.dict() == {"success": True}
        assert get_event_count(mock_record, PrCloseMetricsEvent) == 1
        row = _last_row(mock_record)
        assert row.conversation_sentiment is None
        assert row.conversation_metadata is None
        mock_metrics.incr.assert_any_call("pr_metrics.update.invalid_conversation_analysis")

    @patch("sentry.pr_metrics.judge.metrics")
    @patch("sentry.analytics.record")
    def test_malformed_diagnosis_labels_dropped_but_row_still_emits(
        self, mock_record: Any, mock_metrics: Any
    ) -> None:
        # diagnosis_labels must be a list of strings; a bare string is dropped
        # gracefully (BigQuery-only enrichment) while the row still emits.
        self._track()
        result = self._call(verdict="closed_unmerged", diagnosis_labels="out_of_scope")

        assert result.dict() == {"success": True}
        assert get_event_count(mock_record, PrCloseMetricsEvent) == 1
        assert _last_row(mock_record).diagnosis_labels is None
        mock_metrics.incr.assert_any_call("pr_metrics.update.invalid_diagnosis_labels")

    @patch("sentry.pr_metrics.judge.metrics")
    @patch("sentry.analytics.record")
    def test_mixed_type_diagnosis_labels_dropped(self, mock_record: Any, mock_metrics: Any) -> None:
        # A list with a non-string element is not a valid label list — dropped whole.
        self._track()
        result = self._call(verdict="closed_unmerged", diagnosis_labels=["valid", 2])

        assert result.dict() == {"success": True}
        assert _last_row(mock_record).diagnosis_labels is None
        mock_metrics.incr.assert_any_call("pr_metrics.update.invalid_diagnosis_labels")

    @patch("sentry.analytics.record")
    def test_judge_enrichment_absent_is_back_compat(self, mock_record: Any) -> None:
        # Old Seer pods (and the no-judge path) send no analysis; the row emits with
        # every judge column null.
        self._track()
        result = self._call(verdict="closed_unmerged")

        assert result.dict() == {"success": True}
        row = _last_row(mock_record)
        assert row.conversation_sentiment is None
        assert row.diagnosis_labels is None
        assert row.conversation_metadata is None

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

        assert result.dict() == {"success": True}
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

        assert result.dict() == {"success": False, "error": "pull_request_not_found"}
        assert not PullRequestMetrics.objects.filter(pull_request=self.pull_request).exists()
        assert mock_record.call_count == 0

    @patch("sentry.analytics.record")
    def test_rejects_invalid_verdict(self, mock_record: Any) -> None:
        self._track()
        result = self._call(verdict="not_a_verdict")

        assert result.dict() == {"success": False, "error": "invalid_verdict"}
        assert not PullRequestMetrics.objects.filter(pull_request=self.pull_request).exists()
        assert mock_record.call_count == 0

    @patch("sentry.analytics.record")
    def test_rejects_invalid_attribution(self, mock_record: Any) -> None:
        self._track()
        result = self._call(
            verdict="merged_unchanged",
            attributions=[{"signal_type": "bogus", "source": "seer_llm_judge"}],
        )

        assert result.dict() == {"success": False, "error": "invalid_attribution"}
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

        assert result.dict() == {"success": False, "error": "invalid_attribution"}
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

        assert result.dict() == {"success": False, "error": "invalid_attribution"}
        assert not PullRequestMetrics.objects.filter(pull_request=self.pull_request).exists()
        assert mock_record.call_count == 0

    @patch("sentry.analytics.record")
    def test_does_not_clobber_webhook_counters(self, mock_record: Any) -> None:
        self._track()
        PullRequestMetrics.objects.create(
            pull_request=self.pull_request, additions=10, deletions=5, is_assigned=True
        )

        result = self._call(verdict="merged_unchanged")

        assert result.dict() == {"success": True}
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

        assert result.dict() == {"success": False, "error": "invalid_verdict"}
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

        assert result.dict() == {"success": False, "error": "pull_request_not_found"}
        assert mock_record.call_count == 0

    @patch("sentry.analytics.record")
    def test_rejects_non_terminal_pr(self, mock_record: Any) -> None:
        self._track()
        # A PR that never reached a terminal state can't build a row. Reject up
        # front so we don't commit the verdict and then fail in emit.
        self.pull_request.update(closed_at=None, head_commit_sha=None)

        result = self._call(verdict="merged_unchanged")

        assert result.dict() == {"success": False, "error": "pull_request_not_terminal"}
        assert not PullRequestMetrics.objects.filter(pull_request=self.pull_request).exists()
        assert mock_record.call_count == 0

    @patch("sentry.analytics.record")
    def test_persists_but_skips_emit_for_untracked_pr(self, mock_record: Any) -> None:
        # No attribution anywhere: the verdict is still stored, but the row is not
        # emitted (untracked PRs are never emitted).
        result = self._call(verdict="closed_unmerged")

        assert result.dict() == {"success": True}
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

        assert result.dict() == {"success": False, "error": "invalid_verdict"}
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

        assert result.dict() == {"success": True}
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

        assert result.dict() == {"success": True}
        assert get_event_count(mock_record, PrCloseMetricsEvent) == 1

    @patch("sentry.analytics.record")
    def test_retried_callback_keeps_first_verdict(self, mock_record: Any) -> None:
        # The first settled verdict is authoritative; a later differing callback is
        # a no-op rather than overwriting and re-emitting.
        self._track()
        self._call(verdict="merged_unchanged")
        result = self._call(verdict="merged_with_iteration")

        assert result.dict() == {"success": True}
        assert PullRequestMetrics.objects.get(pull_request=self.pull_request).verdict == (
            "merged_unchanged"
        )
        assert get_event_count(mock_record, PrCloseMetricsEvent) == 1


@cell_silo_test
@with_feature("organizations:pr-metrics-activity")
class ReapStuckJudgeVerdictsTest(TestCase):
    def setUp(self) -> None:
        self.repo = self.create_repo(
            self.project, name="getsentry/sentry", provider="integrations:github"
        )
        self.pull_request = self.create_pull_request(
            repository_id=self.repo.id, organization_id=self.organization.id, key="42"
        )
        self.pull_request.update(head_commit_sha=HEAD_SHA)
        record_attribution_signal(
            pull_request=self.pull_request,
            signal_type=PullRequestAttributionSignalType.SENTRY_APP,
            source=PullRequestAttributionSource.WEBHOOK_DATA,
        )

    def _stick(
        self, *, closed_at: datetime | None = None, merged_at: datetime | None = None
    ) -> None:
        self.pull_request.update(closed_at=closed_at, merged_at=merged_at)
        PullRequestMetrics.objects.create(
            pull_request=self.pull_request, verdict=PullRequestVerdict.JUDGE_IN_PROGRESS
        )

    @patch("sentry.analytics.record")
    def test_settles_stuck_merged_pr_unchanged(self, mock_record: Any) -> None:
        # GitHub sets both closed_at and merged_at on a merge.
        merged_at = datetime.now(timezone.utc) - timedelta(hours=5)
        self._stick(closed_at=merged_at, merged_at=merged_at)

        reap_stuck_judge_verdicts()

        assert PullRequestMetrics.objects.get(pull_request=self.pull_request).verdict == (
            "merged_unchanged"
        )
        assert get_event_count(mock_record, PrCloseMetricsEvent) == 1

    @patch("sentry.analytics.record")
    def test_settles_stuck_merged_pr_with_iteration(self, mock_record: Any) -> None:
        merged_at = datetime.now(timezone.utc) - timedelta(hours=5)
        self._stick(closed_at=merged_at, merged_at=merged_at)
        PullRequestActivity.objects.create(
            pull_request=self.pull_request,
            webhook_id="delivery-1",
            event_type=PullRequestActivityType.SYNCHRONIZED,
            payload={},
        )

        reap_stuck_judge_verdicts()

        assert PullRequestMetrics.objects.get(pull_request=self.pull_request).verdict == (
            "merged_with_iteration"
        )
        assert get_event_count(mock_record, PrCloseMetricsEvent) == 1

    @patch("sentry.analytics.record")
    def test_settles_stuck_closed_unmerged_pr(self, mock_record: Any) -> None:
        self._stick(closed_at=datetime.now(timezone.utc) - timedelta(hours=5))

        reap_stuck_judge_verdicts()

        assert PullRequestMetrics.objects.get(pull_request=self.pull_request).verdict == (
            "closed_unmerged"
        )
        assert get_event_count(mock_record, PrCloseMetricsEvent) == 1

    @patch("sentry.analytics.record")
    def test_releases_without_emitting_when_indeterminate(self, mock_record: Any) -> None:
        # Activity tracking off for this org: select_verdict can't tell whether
        # there were commits after open, so select_fallback_verdict would risk
        # misreading "untracked" as "no commits after open". Rather than emit a
        # null-verdict row (which would leave the door open, via verdict IS NULL,
        # for a later genuine Seer callback to emit a second row), the sentinel
        # is released and nothing is emitted.
        self._stick(closed_at=datetime.now(timezone.utc) - timedelta(hours=5))

        with self.feature({"organizations:pr-metrics-activity": False}):
            reap_stuck_judge_verdicts()

        assert PullRequestMetrics.objects.get(pull_request=self.pull_request).verdict is None
        assert mock_record.call_count == 0

    @patch("sentry.analytics.record")
    def test_leaves_recently_stuck_pr_alone(self, mock_record: Any) -> None:
        # Within JUDGE_REAP_STUCK_AFTER: may still be legitimately in flight to Seer.
        self._stick(closed_at=datetime.now(timezone.utc) - timedelta(hours=1))

        reap_stuck_judge_verdicts()

        assert PullRequestMetrics.objects.get(pull_request=self.pull_request).verdict == (
            "judge_in_progress"
        )
        assert mock_record.call_count == 0

    @patch("sentry.analytics.record")
    def test_settles_pr_stuck_long_past_stale_cutoff(self, mock_record: Any) -> None:
        # No upper bound: a row that fell behind (task outage, an oversized
        # backlog) still gets reaped rather than aging out and staying stuck.
        self._stick(closed_at=datetime.now(timezone.utc) - timedelta(days=10))

        reap_stuck_judge_verdicts()

        assert PullRequestMetrics.objects.get(pull_request=self.pull_request).verdict == (
            "closed_unmerged"
        )
        assert get_event_count(mock_record, PrCloseMetricsEvent) == 1

    @patch("sentry.analytics.record")
    def test_releases_sentinel_for_reopened_pr(self, mock_record: Any) -> None:
        # closed_at/merged_at both null: the PR was reopened after being claimed.
        self._stick()

        reap_stuck_judge_verdicts()

        assert PullRequestMetrics.objects.get(pull_request=self.pull_request).verdict is None
        assert mock_record.call_count == 0

    @patch("sentry.analytics.record")
    def test_does_not_touch_rows_with_other_verdicts(self, mock_record: Any) -> None:
        self.pull_request.update(closed_at=datetime.now(timezone.utc) - timedelta(hours=5))
        PullRequestMetrics.objects.create(
            pull_request=self.pull_request, verdict=PullRequestVerdict.MERGED_UNCHANGED
        )

        reap_stuck_judge_verdicts()

        assert PullRequestMetrics.objects.get(pull_request=self.pull_request).verdict == (
            "merged_unchanged"
        )
        assert mock_record.call_count == 0

    @patch("sentry.analytics.record")
    def test_settle_is_a_no_op_if_already_settled_concurrently(self, mock_record: Any) -> None:
        # A very-late Seer callback landing first: the row is no longer
        # JUDGE_IN_PROGRESS by the time the reaper's compare-and-set runs.
        self.pull_request.update(closed_at=datetime.now(timezone.utc) - timedelta(hours=5))
        PullRequestMetrics.objects.create(
            pull_request=self.pull_request, verdict=PullRequestVerdict.MERGED_UNCHANGED
        )

        _reconcile_stuck_judge_claim(self.pull_request)

        assert PullRequestMetrics.objects.get(pull_request=self.pull_request).verdict == (
            "merged_unchanged"
        )
        assert mock_record.call_count == 0


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
        assert kwargs["path"] == "/v1/pr-metrics/pr-close-judge"
        body = orjson.loads(kwargs["body"])
        assert body["pull_request_id"] == self.pull_request.id
        assert body["organization_id"] == self.organization.id
        assert body["repository_id"] == self.repo.id
        assert body["pr_number"] == "42"
        assert body["close_action"] == "merged"
        assert body["head_commit_sha"] == HEAD_SHA
        assert body["merge_commit_sha"] == MERGE_SHA
        # The shared Seer RepoDefinition shape: split owner/name and bare provider slug.
        assert body["repo"] == {
            "provider": "github",
            "owner": "getsentry",
            "name": "sentry",
            "external_id": "10270250",
            "base_commit_sha": HEAD_SHA,
            "organization_id": self.organization.id,
            "is_private": None,
            "integration_id": "99",
        }
        assert body["additions"] == 12
        assert body["comments_count"] == 5

    @patch("sentry.pr_metrics.judge.make_signed_seer_api_request")
    def test_forwards_activity_timeline(self, mock_request: Any) -> None:
        # The captured activity rides along verbatim (text-free payloads), giving
        # the judge the actors/outcomes the end-state counters flatten away.
        mock_request.return_value = self._response(202)
        PullRequestActivity.objects.create(
            pull_request=self.pull_request,
            webhook_id="d1",
            event_type=PullRequestActivityType.SYNCHRONIZED,
            payload={"sender_type": "Bot", "after_sha": "c" * 40},
        )
        PullRequestActivity.objects.create(
            pull_request=self.pull_request,
            webhook_id="d2",
            event_type=PullRequestActivityType.REVIEW_SUBMITTED,
            payload={"review_state": "changes_requested"},
        )
        forward_pr_to_seer_judge(self.pull_request, self.repo)

        activity = orjson.loads(mock_request.call_args.kwargs["body"])["activity"]
        by_type = {e["event_type"]: e["payload"] for e in activity}
        assert len(activity) == 2
        assert by_type["synchronized"]["sender_type"] == "Bot"
        assert by_type["review_submitted"]["review_state"] == "changes_requested"

    @patch("sentry.pr_metrics.judge.logger")
    @patch("sentry.pr_metrics.judge.metrics")
    @patch("sentry.pr_metrics.judge.make_signed_seer_api_request")
    def test_forwarded_check_rows_are_capped(
        self, mock_request: Any, mock_metrics: Any, mock_logger: Any
    ) -> None:
        # check_run fires per check per push, so a busy PR's CI noise must not
        # balloon the request: lifecycle rows ride along in full, check rows are
        # capped to the most recent _MAX_FORWARDED_CHECK_ROWS.
        mock_request.return_value = self._response(202)
        base = datetime(2023, 1, 1, tzinfo=timezone.utc)
        dropped = 5
        total_checks = _MAX_FORWARDED_CHECK_ROWS + dropped

        PullRequestActivity.objects.create(
            pull_request=self.pull_request,
            webhook_id="opened",
            event_type=PullRequestActivityType.OPENED,
            payload={},
            date_added=base,
        )
        for i in range(total_checks):
            PullRequestActivity.objects.create(
                pull_request=self.pull_request,
                webhook_id=f"check-{i}",
                event_type=PullRequestActivityType.CHECK_RUN_COMPLETED,
                payload={"index": i},
                date_added=base + timedelta(minutes=i + 1),
            )
        PullRequestActivity.objects.create(
            pull_request=self.pull_request,
            webhook_id="synchronized",
            event_type=PullRequestActivityType.SYNCHRONIZED,
            payload={},
            date_added=base + timedelta(hours=10),
        )

        forward_pr_to_seer_judge(self.pull_request, self.repo)

        activity = orjson.loads(mock_request.call_args.kwargs["body"])["activity"]
        check_events = [e for e in activity if e["event_type"] == "check_run_completed"]
        lifecycle = [e for e in activity if e["event_type"] != "check_run_completed"]

        # All lifecycle rows kept; check rows capped to the most recent N.
        assert {e["event_type"] for e in lifecycle} == {"opened", "synchronized"}
        assert len(check_events) == _MAX_FORWARDED_CHECK_ROWS
        # The oldest `dropped` check rows are trimmed; the most recent N remain.
        kept_indexes = {e["payload"]["index"] for e in check_events}
        assert kept_indexes == set(range(dropped, total_checks))
        # Overall chronological order is preserved.
        timestamps = [e["timestamp"] for e in activity]
        assert timestamps == sorted(timestamps)
        # Hitting the cap is observable: it emits a metric and a warning so a
        # persistently high rate can argue for raising the cap.
        mock_metrics.incr.assert_any_call("pr_metrics.judge.check_rows_capped")
        mock_logger.warning.assert_any_call(
            "pr_metrics.judge.check_rows_capped",
            extra={
                "pull_request_id": self.pull_request.id,
                "check_rows": total_checks,
                "dropped": dropped,
            },
        )

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
