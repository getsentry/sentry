"""Tests for stale PR detection: find_stale_pull_requests, emit_pr_metrics_row (abandoned path),
and the detect_stale_pull_requests_task cron task."""

from __future__ import annotations

from datetime import timedelta
from typing import Any
from unittest.mock import patch

from django.utils import timezone

from sentry.models.pullrequest import (
    PullRequestActivity,
    PullRequestActivityLog,
    PullRequestActivityType,
    PullRequestAttribution,
    PullRequestAttributionSignalType,
    PullRequestAttributionSource,
    PullRequestMetrics,
    PullRequestVerdict,
)
from sentry.pr_metrics.activity_doc import apply_activity, new_document
from sentry.pr_metrics.contracts import CLOSE_ACTION_ABANDONED
from sentry.pr_metrics.emit import NO_REVIEWER_ENGAGEMENT, emit_pr_metrics_row
from sentry.pr_metrics.tasks import (
    _STALE_SCAN_LIMIT,
    detect_stale_pull_requests_task,
    find_stale_pull_requests,
)
from sentry.testutils.cases import TestCase
from sentry.testutils.helpers import with_feature
from sentry.testutils.silo import cell_silo_test
from sentry.utils import json


def _ago(weeks: float) -> Any:
    return timezone.now() - timedelta(weeks=weeks)


@cell_silo_test
class FindStalePullRequestsTest(TestCase):
    def setUp(self) -> None:
        self.repo = self.create_repo(
            self.project, name="getsentry/sentry", provider="integrations:github"
        )

    def _make_pr(self, *, opened_weeks_ago: float = 4.0, state: str = "open") -> Any:
        pr = self.create_pull_request(
            repository_id=self.repo.id, organization_id=self.organization.id
        )
        pr.date_added = _ago(opened_weeks_ago)
        pr.state = state
        pr.save(update_fields=["date_added", "state"])
        return pr

    def _track(self, pr: Any, *, is_valid: bool = True) -> None:
        PullRequestAttribution.objects.create(
            pull_request=pr,
            signal_type=PullRequestAttributionSignalType.SENTRY_APP,
            source=PullRequestAttributionSource.WEBHOOK_DATA,
            is_valid=is_valid,
        )

    def _set_verdict(self, pr: Any, verdict: str) -> None:
        PullRequestMetrics.objects.update_or_create(pull_request=pr, defaults={"verdict": verdict})

    def _add_activity(self, pr: Any, event_type: str, *, weeks_ago: float) -> None:
        activity = PullRequestActivity.objects.create(
            pull_request=pr,
            event_type=event_type,
            payload={},
            webhook_id=f"wh-{pr.id}-{event_type}-{weeks_ago}",
        )
        activity.date_added = _ago(weeks_ago)
        activity.save(update_fields=["date_added"])

    def _add_activity_log(
        self, pr: Any, event_type: PullRequestActivityType, *, weeks_ago: float
    ) -> None:
        doc = new_document()
        apply_activity(
            doc,
            event_type=event_type,
            payload={},
            ts=_ago(weeks_ago).isoformat(),
            webhook_id=f"wh-{pr.id}-{event_type}-{weeks_ago}",
        )
        log = PullRequestActivityLog.objects.create(pull_request=pr, data=doc)
        # auto_now=True always stamps "now" on .save(); .update() backdates it.
        PullRequestActivityLog.objects.filter(id=log.id).update(date_updated=_ago(weeks_ago))

    # --- inclusion ---

    def test_includes_tracked_open_pr_with_no_activity(self) -> None:
        pr = self._make_pr()
        self._track(pr)
        assert pr.id in find_stale_pull_requests(cutoff=_ago(3))

    def test_includes_pr_with_only_non_engaging_recent_activity(self) -> None:
        # Comments and label events don't reset the stale clock — both are
        # commonly bot-driven and not a reliable signal of human engagement.
        pr = self._make_pr()
        self._track(pr)
        self._add_activity(pr, PullRequestActivityType.COMMENT_CREATED, weeks_ago=1.0)
        self._add_activity(pr, PullRequestActivityType.LABELED, weeks_ago=1.0)
        assert pr.id in find_stale_pull_requests(cutoff=_ago(3))

    # --- exclusion ---

    def test_excludes_recently_reviewed_pr(self) -> None:
        pr = self._make_pr()
        self._track(pr)
        self._add_activity(pr, PullRequestActivityType.REVIEW_SUBMITTED, weeks_ago=1.0)
        assert pr.id not in find_stale_pull_requests(cutoff=_ago(3))

    def test_excludes_recently_synchronized_pr(self) -> None:
        pr = self._make_pr()
        self._track(pr)
        self._add_activity(pr, PullRequestActivityType.SYNCHRONIZED, weeks_ago=1.0)
        assert pr.id not in find_stale_pull_requests(cutoff=_ago(3))

    def test_excludes_pr_marked_ready_for_review_recently(self) -> None:
        pr = self._make_pr()
        self._track(pr)
        self._add_activity(pr, PullRequestActivityType.READY_FOR_REVIEW, weeks_ago=1.0)
        assert pr.id not in find_stale_pull_requests(cutoff=_ago(3))

    def test_excludes_pr_with_recent_review_request(self) -> None:
        pr = self._make_pr()
        self._track(pr)
        self._add_activity(pr, PullRequestActivityType.REVIEW_REQUESTED, weeks_ago=1.0)
        assert pr.id not in find_stale_pull_requests(cutoff=_ago(3))

    def test_excludes_untracked_pr(self) -> None:
        pr = self._make_pr()
        assert pr.id not in find_stale_pull_requests(cutoff=_ago(3))

    def test_excludes_pr_with_only_invalid_attribution(self) -> None:
        pr = self._make_pr()
        self._track(pr, is_valid=False)
        assert pr.id not in find_stale_pull_requests(cutoff=_ago(3))

    def test_excludes_pr_opened_after_cutoff(self) -> None:
        pr = self._make_pr(opened_weeks_ago=1.0)
        self._track(pr)
        assert pr.id not in find_stale_pull_requests(cutoff=_ago(3))

    def test_excludes_pr_with_non_null_verdict(self) -> None:
        pr = self._make_pr()
        self._track(pr)
        self._set_verdict(pr, PullRequestVerdict.CLOSED_UNMERGED)
        assert pr.id not in find_stale_pull_requests(cutoff=_ago(3))

    def test_excludes_judge_in_progress_pr(self) -> None:
        pr = self._make_pr()
        self._track(pr)
        self._set_verdict(pr, PullRequestVerdict.JUDGE_IN_PROGRESS)
        assert pr.id not in find_stale_pull_requests(cutoff=_ago(3))

    def test_excludes_closed_pr(self) -> None:
        pr = self._make_pr(state="closed")
        self._track(pr)
        assert pr.id not in find_stale_pull_requests(cutoff=_ago(3))

    def test_excludes_document_track_pr_with_recent_engagement(self) -> None:
        # Document-track PRs never write legacy PullRequestActivity rows, so
        # this must be caught via PullRequestActivityLog.date_updated instead.
        pr = self._make_pr()
        self._track(pr)
        self._add_activity_log(pr, PullRequestActivityType.REVIEW_SUBMITTED, weeks_ago=1.0)
        assert pr.id not in find_stale_pull_requests(cutoff=_ago(3))

    def test_excludes_document_track_pr_with_only_non_engaging_activity(self) -> None:
        # Unlike the legacy track, date_updated can't distinguish engaging
        # from non-engaging writes, so this is excluded too (see
        # test_includes_pr_with_only_non_engaging_recent_activity above).
        pr = self._make_pr()
        self._track(pr)
        self._add_activity_log(pr, PullRequestActivityType.COMMENT_CREATED, weeks_ago=1.0)
        assert pr.id not in find_stale_pull_requests(cutoff=_ago(3))

    def test_includes_document_track_pr_whose_document_is_stale(self) -> None:
        pr = self._make_pr()
        self._track(pr)
        self._add_activity_log(pr, PullRequestActivityType.REVIEW_SUBMITTED, weeks_ago=5.0)
        assert pr.id in find_stale_pull_requests(cutoff=_ago(3))

    def test_returns_distinct_ids_with_multiple_attributions(self) -> None:
        pr = self._make_pr()
        self._track(pr)
        PullRequestAttribution.objects.create(
            pull_request=pr,
            signal_type=PullRequestAttributionSignalType.MCP,
            source=PullRequestAttributionSource.WEBHOOK_DATA,
            is_valid=True,
        )
        ids = find_stale_pull_requests(cutoff=_ago(3))
        assert ids.count(pr.id) == 1

    def test_caps_result_at_scan_limit_oldest_first(self) -> None:
        prs = [self._make_pr(opened_weeks_ago=10.0 + i) for i in range(_STALE_SCAN_LIMIT + 5)]
        for pr in prs:
            self._track(pr)

        ids = find_stale_pull_requests(cutoff=_ago(3))

        assert len(ids) == _STALE_SCAN_LIMIT
        expected_oldest_first = [pr.id for pr in sorted(prs, key=lambda pr: pr.date_added)]
        assert ids == expected_oldest_first[:_STALE_SCAN_LIMIT]


@cell_silo_test
class EmitAbandonedPrMetricsRowTest(TestCase):
    def setUp(self) -> None:
        self.repo = self.create_repo(
            self.project, name="getsentry/sentry", provider="integrations:github"
        )
        self.pr = self.create_pull_request(
            repository_id=self.repo.id, organization_id=self.organization.id, key="77"
        )
        self.pr.head_commit_sha = "abc123"
        self.pr.opened_at = _ago(4)
        self.pr.draft = False
        self.pr.save(update_fields=["head_commit_sha", "opened_at", "draft"])
        PullRequestMetrics.objects.create(
            pull_request=self.pr,
            additions=10,
            deletions=5,
            verdict=PullRequestVerdict.ABANDONED,
        )
        PullRequestAttribution.objects.create(
            pull_request=self.pr,
            signal_type=PullRequestAttributionSignalType.SENTRY_APP,
            source=PullRequestAttributionSource.WEBHOOK_DATA,
            is_valid=True,
        )

    @patch("sentry.analytics.record")
    def test_emits_abandoned_row(self, mock_record: Any) -> None:
        with patch("sentry.pr_metrics.tasks.cleanup_pr_activity_task"):
            result = emit_pr_metrics_row(pull_request=self.pr)
        assert result is True
        assert mock_record.call_count == 1
        row = mock_record.call_args[0][0]
        assert row.close_action == CLOSE_ACTION_ABANDONED
        assert row.verdict == PullRequestVerdict.ABANDONED
        assert row.closed_at is not None  # detection timestamp, not null
        assert row.merged_at is None
        assert row.pull_request_id == self.pr.id
        assert row.organization_id == self.organization.id

    @patch("sentry.analytics.record")
    def test_emits_with_metrics_counters(self, mock_record: Any) -> None:
        with patch("sentry.pr_metrics.tasks.cleanup_pr_activity_task"):
            emit_pr_metrics_row(pull_request=self.pr)
        row = mock_record.call_args[0][0]
        assert row.additions == 10
        assert row.deletions == 5

    @patch("sentry.analytics.record")
    def test_skips_untracked_pr(self, mock_record: Any) -> None:
        PullRequestAttribution.objects.filter(pull_request=self.pr).delete()
        with patch("sentry.pr_metrics.tasks.cleanup_pr_activity_task"):
            result = emit_pr_metrics_row(pull_request=self.pr)
        assert result is False
        assert mock_record.call_count == 0

    @patch("sentry.analytics.record")
    def test_skips_pr_with_only_invalid_attribution(self, mock_record: Any) -> None:
        PullRequestAttribution.objects.filter(pull_request=self.pr).update(is_valid=False)
        with patch("sentry.pr_metrics.tasks.cleanup_pr_activity_task"):
            result = emit_pr_metrics_row(pull_request=self.pr)
        assert result is False
        assert mock_record.call_count == 0

    @patch("sentry.analytics.record")
    def test_attribution_json_in_row(self, mock_record: Any) -> None:
        with patch("sentry.pr_metrics.tasks.cleanup_pr_activity_task"):
            emit_pr_metrics_row(pull_request=self.pr)
        row = mock_record.call_args[0][0]
        attributions = json.loads(row.attributions)
        assert len(attributions) == 1
        assert attributions[0]["signal_type"] == PullRequestAttributionSignalType.SENTRY_APP

    @patch("sentry.analytics.record")
    def test_no_metrics_row_emits_with_zero_counters(self, mock_record: Any) -> None:
        PullRequestMetrics.objects.filter(pull_request=self.pr).delete()
        with patch("sentry.pr_metrics.tasks.cleanup_pr_activity_task"):
            result = emit_pr_metrics_row(pull_request=self.pr)
        assert result is True
        row = mock_record.call_args[0][0]
        assert row.additions == 0
        assert row.deletions == 0
        assert row.close_action == CLOSE_ACTION_ABANDONED


@cell_silo_test
@with_feature("organizations:pr-metrics-emit")
class DetectStalePullRequestsTaskTest(TestCase):
    def setUp(self) -> None:
        self.repo = self.create_repo(
            self.project, name="getsentry/sentry", provider="integrations:github"
        )

    def _make_tracked_stale_pr(self) -> Any:
        pr = self.create_pull_request(
            repository_id=self.repo.id, organization_id=self.organization.id
        )
        pr.date_added = _ago(4)
        pr.state = "open"
        pr.head_commit_sha = "deadbeef"
        pr.save(update_fields=["date_added", "state", "head_commit_sha"])
        PullRequestAttribution.objects.create(
            pull_request=pr,
            signal_type=PullRequestAttributionSignalType.SENTRY_APP,
            source=PullRequestAttributionSource.WEBHOOK_DATA,
            is_valid=True,
        )
        return pr

    def _add_activity_log(
        self, pr: Any, event_type: PullRequestActivityType, *, weeks_ago: float
    ) -> None:
        doc = new_document()
        apply_activity(
            doc,
            event_type=event_type,
            payload={},
            ts=_ago(weeks_ago).isoformat(),
            webhook_id=f"wh-{pr.id}-{event_type}-{weeks_ago}",
        )
        log = PullRequestActivityLog.objects.create(pull_request=pr, data=doc)
        # auto_now=True always stamps "now" on .save(); .update() backdates it.
        PullRequestActivityLog.objects.filter(id=log.id).update(date_updated=_ago(weeks_ago))

    def test_skips_document_track_pr_with_recent_engagement(self) -> None:
        pr = self._make_tracked_stale_pr()
        self._add_activity_log(pr, PullRequestActivityType.REVIEW_SUBMITTED, weeks_ago=1.0)
        with (
            self.feature({"organizations:pr-metrics-activity": True}),
            patch("sentry.pr_metrics.tasks.emit_pr_metrics_row") as mock_emit,
        ):
            detect_stale_pull_requests_task()

        mock_emit.assert_not_called()
        assert not PullRequestMetrics.objects.filter(
            pull_request=pr, verdict=PullRequestVerdict.ABANDONED
        ).exists()

    def test_skips_document_track_pr_with_only_non_engaging_activity(self) -> None:
        pr = self._make_tracked_stale_pr()
        self._add_activity_log(pr, PullRequestActivityType.COMMENT_CREATED, weeks_ago=1.0)
        with (
            self.feature({"organizations:pr-metrics-activity": True}),
            patch("sentry.pr_metrics.tasks.emit_pr_metrics_row") as mock_emit,
        ):
            detect_stale_pull_requests_task()

        mock_emit.assert_not_called()
        assert not PullRequestMetrics.objects.filter(
            pull_request=pr, verdict=PullRequestVerdict.ABANDONED
        ).exists()

    def test_claims_verdict_and_emits_for_stale_pr(self) -> None:
        pr = self._make_tracked_stale_pr()
        with (
            self.feature({"organizations:pr-metrics-activity": True}),
            patch("sentry.pr_metrics.tasks.emit_pr_metrics_row") as mock_emit,
        ):
            mock_emit.return_value = True
            detect_stale_pull_requests_task()

        pr.refresh_from_db()
        metrics = PullRequestMetrics.objects.get(pull_request=pr)
        assert metrics.verdict == PullRequestVerdict.ABANDONED
        mock_emit.assert_called_once()

    def test_tags_stale_emission_with_no_reviewer_engagement(self) -> None:
        self._make_tracked_stale_pr()
        with (
            self.feature({"organizations:pr-metrics-activity": True}),
            patch("sentry.pr_metrics.tasks.emit_pr_metrics_row") as mock_emit,
        ):
            mock_emit.return_value = True
            detect_stale_pull_requests_task()

        assert mock_emit.call_args.kwargs["diagnosis_labels"] == [NO_REVIEWER_ENGAGEMENT]

    def test_emits_abandoned_when_pr_has_historical_activity(self) -> None:
        pr = self._make_tracked_stale_pr()
        # Activity predating the staleness window: stale, but not untouched.
        old_activity = PullRequestActivity.objects.create(
            pull_request=pr,
            event_type=PullRequestActivityType.SYNCHRONIZED,
        )
        old_activity.date_added = _ago(4) - timedelta(days=1)
        old_activity.save(update_fields=["date_added"])
        with (
            self.feature({"organizations:pr-metrics-activity": True}),
            patch("sentry.pr_metrics.tasks.emit_pr_metrics_row") as mock_emit,
        ):
            mock_emit.return_value = True
            detect_stale_pull_requests_task()

        mock_emit.assert_called_once()

    def test_skips_pr_without_emit_feature(self) -> None:
        self._make_tracked_stale_pr()
        with self.feature({"organizations:pr-metrics-emit": False}):
            with patch("sentry.pr_metrics.tasks.emit_pr_metrics_row") as mock_emit:
                detect_stale_pull_requests_task()
        mock_emit.assert_not_called()

    def test_does_not_double_emit_on_second_run(self) -> None:
        self._make_tracked_stale_pr()
        with (
            self.feature({"organizations:pr-metrics-activity": True}),
            patch("sentry.pr_metrics.tasks.emit_pr_metrics_row") as mock_emit,
        ):
            mock_emit.return_value = True
            detect_stale_pull_requests_task()
            detect_stale_pull_requests_task()

        assert mock_emit.call_count == 1

    def test_skips_pr_already_closed_by_webhook(self) -> None:
        pr = self._make_tracked_stale_pr()
        PullRequestMetrics.objects.create(
            pull_request=pr, verdict=PullRequestVerdict.CLOSED_UNMERGED
        )
        with patch("sentry.pr_metrics.tasks.emit_pr_metrics_row") as mock_emit:
            detect_stale_pull_requests_task()
        mock_emit.assert_not_called()

    def test_skips_when_activity_tracking_disabled(self) -> None:
        self._make_tracked_stale_pr()
        with patch("sentry.pr_metrics.tasks.emit_pr_metrics_row") as mock_emit:
            detect_stale_pull_requests_task()

        mock_emit.assert_not_called()

    def test_continues_when_org_not_found(self) -> None:
        ghost_org = self.create_organization()
        ghost_repo = self.create_repo(
            self.project, name="getsentry/ghost", provider="integrations:github"
        )
        ghost_pr = self.create_pull_request(
            repository_id=ghost_repo.id, organization_id=ghost_org.id
        )
        ghost_pr.date_added = _ago(4)
        ghost_pr.state = "open"
        ghost_pr.head_commit_sha = "deadbeef"
        ghost_pr.save(update_fields=["date_added", "state", "head_commit_sha"])
        PullRequestAttribution.objects.create(
            pull_request=ghost_pr,
            signal_type=PullRequestAttributionSignalType.SENTRY_APP,
            source=PullRequestAttributionSource.WEBHOOK_DATA,
            is_valid=True,
        )
        good_pr = self._make_tracked_stale_pr()
        ghost_org.delete()

        with (
            self.feature({"organizations:pr-metrics-activity": True}),
            patch("sentry.pr_metrics.tasks.emit_pr_metrics_row") as mock_emit,
        ):
            mock_emit.return_value = True
            detect_stale_pull_requests_task()

        assert mock_emit.call_count == 1
        emitted_pr_id = mock_emit.call_args.kwargs["pull_request"].id
        assert emitted_pr_id == good_pr.id

    def test_continues_batch_when_emit_raises(self) -> None:
        failing_pr = self._make_tracked_stale_pr()
        good_pr = self._make_tracked_stale_pr()

        with (
            self.feature({"organizations:pr-metrics-activity": True}),
            patch("sentry.pr_metrics.tasks.emit_pr_metrics_row") as mock_emit,
        ):

            def _emit(*, pull_request: Any, diagnosis_labels: Any) -> bool:
                if pull_request.id == failing_pr.id:
                    raise RuntimeError("boom")
                return True

            mock_emit.side_effect = _emit
            detect_stale_pull_requests_task()

        # Both PRs were claimed before emission ran, so the failure doesn't
        # roll back failing_pr's verdict or stop good_pr from being processed.
        assert (
            PullRequestMetrics.objects.get(pull_request=failing_pr).verdict
            == PullRequestVerdict.ABANDONED
        )
        assert (
            PullRequestMetrics.objects.get(pull_request=good_pr).verdict
            == PullRequestVerdict.ABANDONED
        )
        assert mock_emit.call_count == 2
