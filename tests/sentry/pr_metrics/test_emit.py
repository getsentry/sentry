from datetime import datetime, timezone
from typing import Any
from unittest.mock import patch

import pytest

from sentry.analytics.events.pr_metrics_events import PrCloseMetricsEvent
from sentry.models.grouplink import GroupLink
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
from sentry.pr_metrics.contracts import PrConversationAnalysis
from sentry.pr_metrics.emit import (
    VerdictDeferral,
    _activity_derived_metrics,
    active_attributions,
    build_pr_metrics_row,
    ci_failing_at_close,
    emit_pr_metrics_row,
    is_pr_tracked,
    resolve_autofix_referrers,
    select_fallback_verdict,
    select_verdict,
)
from sentry.pr_metrics.utils import _commit_shas_from_activity, resolved_group_ids
from sentry.testutils.cases import TestCase
from sentry.testutils.helpers import with_feature
from sentry.testutils.helpers.analytics import assert_last_analytics_event
from sentry.testutils.silo import cell_silo_test
from sentry.utils import json

SENTRY_APP_ATTRIBUTION = {
    "signal_type": "sentry_app",
    "source": "seer_data",
    "signal_details": None,
}

# A conversation judge result for the emission tests: the semantic
# outputs promoted to columns plus the opaque metadata drill-down bundle.
CONVERSATION_METADATA = {
    "judge": "conversation.v1",
    "sentiment_reasoning": "reviewer approved after the fix",
    "comment_intents": [
        {"comment_id": "IC_123", "author": "octocat", "author_class": "human", "intent": "praise"},
    ],
    "intent_counts": {"praise": 1},
}
CONVERSATION_ANALYSIS = PrConversationAnalysis(
    sentiment="positive",
    comments_bot=0,
    comments_human=1,
    comments_total=3,
    comments_judged=2,
    comments_truncated=1,
    metadata=CONVERSATION_METADATA,
)
# Cross-judge close-reason labels, threaded independently of the conversation analysis.
DIAGNOSIS_LABELS = ["trivial"]

HEAD_SHA = "a" * 40
MERGE_SHA = "b" * 40
# Lifecycle facts and draft live on the PullRequest row; the activity counters
# live on PullRequestMetrics. build_pr_metrics_row reads both, no payload. Past
# year avoids S015.
OPENED_AT = datetime(2020, 6, 4, 9, 0, 0, tzinfo=timezone.utc)
CLOSED_AT = datetime(2020, 6, 4, 10, 0, 0, tzinfo=timezone.utc)
# The webhook-sourced counters persisted on PullRequestMetrics.
METRICS = {
    "additions": 12,
    "deletions": 3,
    "files_changed": 2,
    "commits_count": 4,
    "comments_count": 5,
    "review_comments_count": 6,
    "is_assigned": True,
}


@cell_silo_test
@with_feature(["organizations:pr-metrics-activity", "organizations:gen-ai-features"])
class PrMetricsEmissionTest(TestCase):
    def setUp(self) -> None:
        self.repo = self.create_repo(
            self.project, name="getsentry/sentry", provider="integrations:github"
        )
        self.pull_request = self.create_pull_request(
            repository_id=self.repo.id, organization_id=self.organization.id, key="42"
        )
        # build_pr_metrics_row reads everything off the row. Default to a merged
        # PR; close-specific tests null the merge fields.
        self.pull_request.head_commit_sha = HEAD_SHA
        self.pull_request.merge_commit_sha = MERGE_SHA
        self.pull_request.opened_at = OPENED_AT
        self.pull_request.closed_at = CLOSED_AT
        self.pull_request.merged_at = CLOSED_AT
        self.pull_request.draft = False
        PullRequestMetrics.objects.create(pull_request=self.pull_request, **METRICS)

    def _track(
        self,
        signal_type: str = PullRequestAttributionSignalType.SENTRY_APP,
        *,
        source: str = PullRequestAttributionSource.SEER_DATA,
        signal_details: dict[str, Any] | None = None,
        is_valid: bool = True,
    ) -> None:
        PullRequestAttribution.objects.create(
            pull_request=self.pull_request,
            signal_type=signal_type,
            source=source,
            signal_details=signal_details,
            is_valid=is_valid,
        )

    def _link_group(
        self,
        *,
        relationship: int = GroupLink.Relationship.resolves,
    ) -> int:
        group = self.create_group(project=self.project)
        GroupLink.objects.create(
            group_id=group.id,
            project_id=group.project_id,
            linked_type=GroupLink.LinkedType.pull_request,
            relationship=relationship,
            linked_id=self.pull_request.id,
        )
        return group.id

    def _add_synchronize(self) -> None:
        # A push to the PR branch after it opened — the commits-after-open signal.
        PullRequestActivity.objects.create(
            pull_request=self.pull_request,
            webhook_id="sync-1",
            event_type=PullRequestActivityType.SYNCHRONIZED,
            payload={},
        )

    def _add_check_suite(
        self, *, app_slug: str = "github-actions", conclusion: str = "success", webhook_id: str
    ) -> None:
        PullRequestActivity.objects.create(
            pull_request=self.pull_request,
            webhook_id=webhook_id,
            event_type=PullRequestActivityType.CHECK_SUITE_COMPLETED,
            payload={"conclusion": conclusion, "app_slug": app_slug, "check_runs_count": 1},
        )

    def test_select_verdict_merged_without_later_commits_is_unchanged(self) -> None:
        # Merged with no SYNCHRONIZED activity: merge head == opened head.
        assert (
            select_verdict(self.pull_request, self.organization)
            == PullRequestVerdict.MERGED_UNCHANGED
        )

    def test_select_verdict_merged_with_later_commits_needs_judge(self) -> None:
        self._add_synchronize()
        assert select_verdict(self.pull_request, self.organization) == VerdictDeferral.NEEDS_JUDGE

    def test_select_verdict_closed_without_engagement_is_unmerged(self) -> None:
        self.pull_request.merged_at = None
        PullRequestMetrics.objects.filter(pull_request=self.pull_request).update(
            comments_count=0, review_comments_count=0
        )
        assert (
            select_verdict(self.pull_request, self.organization)
            == PullRequestVerdict.CLOSED_UNMERGED
        )

    def test_select_verdict_closed_with_comments_needs_judge(self) -> None:
        # setUp's metrics row carries comments_count=5, i.e. engagement to analyze.
        self.pull_request.merged_at = None
        assert select_verdict(self.pull_request, self.organization) == VerdictDeferral.NEEDS_JUDGE

    def test_select_verdict_merged_without_metrics_row_is_indeterminate(self) -> None:
        # A missing row is an error state for a merge too: there's no reliable
        # activity/engagement data to decide from, so it's indeterminate rather
        # than a genuine needs-judge ambiguity — and never emit zeroed counters.
        PullRequestMetrics.objects.filter(pull_request=self.pull_request).delete()
        with patch("sentry.pr_metrics.emit.logger") as mock_logger:
            assert (
                select_verdict(self.pull_request, self.organization)
                == VerdictDeferral.INDETERMINATE
            )
        mock_logger.warning.assert_called_once_with(
            "pr_metrics.select_verdict.metrics_row_missing",
            extra={
                "organization_id": self.organization.id,
                "repository_id": self.pull_request.repository_id,
                "pull_request_id": self.pull_request.id,
            },
        )

    def test_select_verdict_closed_without_metrics_row_is_indeterminate(self) -> None:
        # A missing row is an error state (handle_metrics failed): warn, and defer
        # as indeterminate rather than guess "abandoned".
        self.pull_request.merged_at = None
        PullRequestMetrics.objects.filter(pull_request=self.pull_request).delete()
        with patch("sentry.pr_metrics.emit.logger") as mock_logger:
            assert (
                select_verdict(self.pull_request, self.organization)
                == VerdictDeferral.INDETERMINATE
            )
        mock_logger.warning.assert_called_once_with(
            "pr_metrics.select_verdict.metrics_row_missing",
            extra={
                "organization_id": self.organization.id,
                "repository_id": self.pull_request.repository_id,
                "pull_request_id": self.pull_request.id,
            },
        )

    def test_select_verdict_closed_with_later_commits_needs_judge(self) -> None:
        self.pull_request.merged_at = None
        PullRequestMetrics.objects.filter(pull_request=self.pull_request).update(
            comments_count=0, review_comments_count=0
        )
        self._add_synchronize()
        assert select_verdict(self.pull_request, self.organization) == VerdictDeferral.NEEDS_JUDGE

    def test_select_verdict_indeterminate_when_activity_tracking_disabled(self) -> None:
        # The commits-after-open signal comes from activity rows the org isn't
        # recording, so an otherwise-clean merge can't be settled deterministically
        # — and isn't a genuine needs-judge ambiguity either, since there's no
        # activity data at all to have found ambiguous.
        with self.feature({"organizations:pr-metrics-activity": False}):
            with patch("sentry.pr_metrics.emit.metrics") as mock_metrics:
                assert (
                    select_verdict(self.pull_request, self.organization)
                    == VerdictDeferral.INDETERMINATE
                )
        mock_metrics.incr.assert_called_once_with("pr_metrics.select_verdict.activity_disabled")

    def test_ci_failing_at_close_no_check_activity_is_false(self) -> None:
        assert ci_failing_at_close(self.pull_request) is False

    def test_ci_failing_at_close_all_success_is_false(self) -> None:
        self._add_check_suite(conclusion="success", webhook_id="check-1")
        assert ci_failing_at_close(self.pull_request) is False

    def test_ci_failing_at_close_failure_is_true(self) -> None:
        self._add_check_suite(conclusion="failure", webhook_id="check-1")
        assert ci_failing_at_close(self.pull_request) is True

    def test_ci_failing_at_close_timed_out_is_true(self) -> None:
        self._add_check_suite(conclusion="timed_out", webhook_id="check-1")
        assert ci_failing_at_close(self.pull_request) is True

    def test_ci_failing_at_close_startup_failure_is_true(self) -> None:
        self._add_check_suite(conclusion="startup_failure", webhook_id="check-1")
        assert ci_failing_at_close(self.pull_request) is True

    def test_ci_failing_at_close_non_failure_conclusions_are_false(self) -> None:
        # neutral/cancelled/skipped/stale/action_required never ran to a failure
        # verdict, so none of them should trip the label.
        for conclusion in ("neutral", "cancelled", "skipped", "stale", "action_required"):
            PullRequestActivity.objects.filter(pull_request=self.pull_request).delete()
            self._add_check_suite(conclusion=conclusion, webhook_id="check-1")
            assert ci_failing_at_close(self.pull_request) is False, conclusion

    def test_ci_failing_at_close_one_app_failing_among_others_is_true(self) -> None:
        self._add_check_suite(app_slug="github-actions", conclusion="success", webhook_id="check-1")
        self._add_check_suite(app_slug="codecov", conclusion="failure", webhook_id="check-2")
        assert ci_failing_at_close(self.pull_request) is True

    def test_ci_failing_at_close_rerun_success_after_failure_is_false(self) -> None:
        # A rerun with no new push (no SYNCHRONIZED row) still writes another
        # CHECK_SUITE_COMPLETED row for the same app; the latest one wins.
        self._add_check_suite(app_slug="github-actions", conclusion="failure", webhook_id="check-1")
        self._add_check_suite(app_slug="github-actions", conclusion="success", webhook_id="check-2")
        assert ci_failing_at_close(self.pull_request) is False

    def test_ci_failing_at_close_rerun_failure_after_success_is_true(self) -> None:
        self._add_check_suite(app_slug="github-actions", conclusion="success", webhook_id="check-1")
        self._add_check_suite(app_slug="github-actions", conclusion="failure", webhook_id="check-2")
        assert ci_failing_at_close(self.pull_request) is True

    def test_select_fallback_verdict_merged_without_later_commits_is_unchanged(self) -> None:
        assert select_fallback_verdict(self.pull_request) == PullRequestVerdict.MERGED_UNCHANGED

    def test_select_fallback_verdict_merged_with_later_commits_is_iteration(self) -> None:
        self._add_synchronize()
        assert (
            select_fallback_verdict(self.pull_request) == PullRequestVerdict.MERGED_WITH_ITERATION
        )

    def test_select_fallback_verdict_closed_is_unmerged(self) -> None:
        # setUp's metrics row carries engagement (comments_count=5), which would
        # need a judge under select_verdict — the fallback has no judge to defer
        # to, so it settles CLOSED_UNMERGED unconditionally.
        self.pull_request.merged_at = None
        assert select_fallback_verdict(self.pull_request) == PullRequestVerdict.CLOSED_UNMERGED

    def test_build_row_for_merge(self) -> None:
        row = build_pr_metrics_row(
            pull_request=self.pull_request,
            close_action="merged",
            attributions=[SENTRY_APP_ATTRIBUTION],
            group_ids=[],
        )
        assert row.close_action == "merged"
        assert row.head_commit_sha == HEAD_SHA
        assert row.merge_commit_sha == MERGE_SHA
        assert row.closed_at == CLOSED_AT.isoformat()
        assert row.merged_at == CLOSED_AT.isoformat()
        assert json.loads(row.attributions) == [SENTRY_APP_ATTRIBUTION]

    def test_build_row_carries_stored_counters(self) -> None:
        row = build_pr_metrics_row(
            pull_request=self.pull_request,
            close_action="merged",
            attributions=[],
            group_ids=[],
        )
        assert row.opened_at == OPENED_AT.isoformat()
        assert row.draft is False
        assert row.additions == 12
        assert row.deletions == 3
        assert row.files_changed == 2
        assert row.commits_count == 4
        assert row.comments_count == 5
        assert row.review_comments_count == 6
        assert row.is_assigned is True

    def test_build_row_carries_repository_provider(self) -> None:
        # setUp's repo is created with the prefixed "integrations:github" form —
        # the row carries the normalized slug.
        row = build_pr_metrics_row(
            pull_request=self.pull_request,
            close_action="merged",
            attributions=[],
            group_ids=[],
        )
        assert row.repository_provider == "github"

    def test_build_row_repository_provider_null_when_repository_deleted(self) -> None:
        self.repo.delete()
        row = build_pr_metrics_row(
            pull_request=self.pull_request,
            close_action="merged",
            attributions=[],
            group_ids=[],
        )
        assert row.repository_provider is None

    def test_build_row_repository_is_public_null_when_no_opened_activity(self) -> None:
        row = build_pr_metrics_row(
            pull_request=self.pull_request,
            close_action="merged",
            attributions=[],
            group_ids=[],
        )
        assert row.repository_is_public is None

    def test_build_row_repository_is_public_from_legacy_activity_row(self) -> None:
        PullRequestActivity.objects.create(
            pull_request=self.pull_request,
            webhook_id="opened-1",
            event_type=PullRequestActivityType.OPENED,
            payload={"is_private": False},
        )
        row = build_pr_metrics_row(
            pull_request=self.pull_request,
            close_action="merged",
            attributions=[],
            group_ids=[],
        )
        assert row.repository_is_public is True

    def test_build_row_repository_is_public_false_for_private_repo(self) -> None:
        PullRequestActivity.objects.create(
            pull_request=self.pull_request,
            webhook_id="opened-1",
            event_type=PullRequestActivityType.OPENED,
            payload={"is_private": True},
        )
        row = build_pr_metrics_row(
            pull_request=self.pull_request,
            close_action="merged",
            attributions=[],
            group_ids=[],
        )
        assert row.repository_is_public is False

    def test_build_row_repository_is_public_from_activity_document(self) -> None:
        # The doc-routed store takes priority over (and here, is the only)
        # source — mirrors the webhook side's per-PR routing.
        PullRequestActivityLog.objects.create(
            pull_request=self.pull_request,
            data={
                "version": 1,
                "events": [
                    {
                        "event_type": PullRequestActivityType.OPENED,
                        "ts": "2020-06-04T09:00:00Z",
                        "event_at": None,
                        "webhook_id": "opened-1",
                        "payload": {"is_private": False},
                    }
                ],
            },
        )
        row = build_pr_metrics_row(
            pull_request=self.pull_request,
            close_action="merged",
            attributions=[],
            group_ids=[],
        )
        assert row.repository_is_public is True

    def test_build_row_repository_is_public_empty_document_fallback_to_legacy(self) -> None:
        # Edge case: PullRequestActivityLog exists but has empty data {}
        # Should fall back to legacy store instead of treating as document
        PullRequestActivityLog.objects.create(
            pull_request=self.pull_request,
            data={},  # Empty document - no version field
        )
        PullRequestActivity.objects.create(
            pull_request=self.pull_request,
            webhook_id="opened-1",
            event_type=PullRequestActivityType.OPENED,
            payload={"is_private": False},
        )
        row = build_pr_metrics_row(
            pull_request=self.pull_request,
            close_action="merged",
            attributions=[],
            group_ids=[],
        )
        # Should read from legacy store, not fail due to empty document
        assert row.repository_is_public is True

    def test_build_row_repository_is_public_no_version_document_fallback_to_legacy(self) -> None:
        # Edge case: PullRequestActivityLog exists but has no version field
        # Should fall back to legacy store (orphaned document from failed fold)
        PullRequestActivityLog.objects.create(
            pull_request=self.pull_request,
            data={"events": []},  # Document without version - treated as orphaned
        )
        PullRequestActivity.objects.create(
            pull_request=self.pull_request,
            webhook_id="opened-1",
            event_type=PullRequestActivityType.OPENED,
            payload={"is_private": False},
        )
        row = build_pr_metrics_row(
            pull_request=self.pull_request,
            close_action="merged",
            attributions=[],
            group_ids=[],
        )
        # Should read from legacy store, not fail due to versionless document
        assert row.repository_is_public is True

    def test_build_row_counters_default_to_zero_when_metrics_row_absent(self) -> None:
        # A PR Sentry never saw active has no PullRequestMetrics row; emit
        # coalesces every counter to its zero/false default.
        PullRequestMetrics.objects.filter(pull_request=self.pull_request).delete()
        self.pull_request.draft = None
        row = build_pr_metrics_row(
            pull_request=self.pull_request,
            close_action="closed",
            attributions=[],
            group_ids=[],
        )
        assert row.additions == 0
        assert row.commits_count == 0
        assert row.is_assigned is False
        assert row.draft is False

    def test_build_row_opened_at_is_null_when_unknown(self) -> None:
        # opened_at is best-effort: a PR Sentry never saw opened (late-installed
        # integration, missed webhook, backfill) leaves it null rather than
        # falling back to date_added, which would skew open-time metrics.
        self.pull_request.opened_at = None
        row = build_pr_metrics_row(
            pull_request=self.pull_request,
            close_action="merged",
            attributions=[],
            group_ids=[],
        )
        assert row.opened_at is None

    def test_build_row_raises_when_stored_lifecycle_missing(self) -> None:
        # A close/merge row needs a persisted head_commit_sha and closed_at; a
        # null means emit ran on a PR that never reached a terminal state.
        self.pull_request.closed_at = None
        with pytest.raises(ValueError):
            build_pr_metrics_row(
                pull_request=self.pull_request,
                close_action="merged",
                attributions=[],
                group_ids=[],
            )

    def test_build_row_for_close_omits_merge_commit_sha(self) -> None:
        # The webhook persists null merge fields for a closed-but-unmerged PR.
        self.pull_request.merge_commit_sha = None
        self.pull_request.merged_at = None
        row = build_pr_metrics_row(
            pull_request=self.pull_request,
            close_action="closed",
            attributions=[],
            group_ids=[],
        )
        assert row.merge_commit_sha is None
        assert row.merged_at is None
        assert row.head_commit_sha == HEAD_SHA
        assert row.closed_at == CLOSED_AT.isoformat()

    def test_is_pr_tracked_requires_a_valid_attribution(self) -> None:
        assert is_pr_tracked(self.pull_request) is False
        self._track(
            PullRequestAttributionSignalType.SENTRY_APP,
            source=PullRequestAttributionSource.WEBHOOK_DATA,
            is_valid=False,
        )
        assert is_pr_tracked(self.pull_request) is False
        self._track()
        assert is_pr_tracked(self.pull_request) is True

    def test_build_row_resolves_merge_commit_id(self) -> None:
        # When Sentry tracks the landed commit, the row carries its Commit.id.
        commit = self.create_commit(repo=self.repo, key=MERGE_SHA)
        row = build_pr_metrics_row(
            pull_request=self.pull_request,
            close_action="merged",
            attributions=[],
            group_ids=[],
        )
        assert row.merge_commit_id == commit.id

    def test_build_row_merge_commit_id_null_when_commit_untracked(self) -> None:
        # No Commit row matches the merge sha (pr_metrics never creates them), so
        # the id resolves to null rather than erroring.
        row = build_pr_metrics_row(
            pull_request=self.pull_request,
            close_action="merged",
            attributions=[],
            group_ids=[],
        )
        assert row.merge_commit_id is None

    def test_build_row_merge_commit_id_null_when_unmerged(self) -> None:
        # A closed-but-unmerged PR has no merge commit sha, so no id to resolve.
        self.pull_request.merge_commit_sha = None
        self.pull_request.merged_at = None
        row = build_pr_metrics_row(
            pull_request=self.pull_request,
            close_action="closed",
            attributions=[],
            group_ids=[],
        )
        assert row.merge_commit_id is None

    def test_active_attributions_only_includes_valid_signals(self) -> None:
        self._track(PullRequestAttributionSignalType.SENTRY_APP)
        self._track(
            PullRequestAttributionSignalType.SEER_DELEGATED_CLAUDE_CODE,
            source=PullRequestAttributionSource.WEBHOOK_DATA,
            is_valid=False,
        )
        assert active_attributions(self.pull_request) == [SENTRY_APP_ATTRIBUTION]

    def test_active_attributions_ordered_by_priority_with_source_and_details(self) -> None:
        # Lower-confidence signal recorded first, but ordered second.
        self._track(
            PullRequestAttributionSignalType.SEER_DELEGATED_CLAUDE_CODE,
            source=PullRequestAttributionSource.WEBHOOK_DATA,
            signal_details={"group_ids": [7]},
        )
        self._track(PullRequestAttributionSignalType.SENTRY_APP)
        assert active_attributions(self.pull_request) == [
            SENTRY_APP_ATTRIBUTION,
            {
                "signal_type": "seer_delegated:claude_code",
                "source": "webhook_data",
                "signal_details": {"group_ids": [7]},
            },
        ]

    def test_resolve_autofix_referrers_empty_without_run_id(self) -> None:
        assert resolve_autofix_referrers(self.pull_request, [SENTRY_APP_ATTRIBUTION]) == []

    def test_resolve_autofix_referrers_resolves_seer_run(self) -> None:
        seer_run = self.create_seer_run(
            organization=self.organization, seer_run_state_id=555, referrer="slack"
        )
        attributions = [
            {
                "signal_type": "sentry_app",
                "source": "seer_data",
                "signal_details": {"run_id": seer_run.seer_run_state_id},
            }
        ]
        assert resolve_autofix_referrers(self.pull_request, attributions) == ["slack"]

    def test_resolve_autofix_referrers_dedupes_repeated_run_ids(self) -> None:
        seer_run = self.create_seer_run(
            organization=self.organization, seer_run_state_id=556, referrer="night_shift"
        )
        details = {"run_id": seer_run.seer_run_state_id}
        attributions = [
            {"signal_type": "sentry_app", "source": "seer_data", "signal_details": details},
            {
                "signal_type": "seer_delegated:claude_code",
                "source": "seer_data",
                "signal_details": details,
            },
        ]
        assert resolve_autofix_referrers(self.pull_request, attributions) == ["night_shift"]

    def test_resolve_autofix_referrers_skips_run_ids_with_no_matching_seer_run(self) -> None:
        attributions = [
            {
                "signal_type": "seer_delegated:cursor",
                "source": "seer_data",
                # Cursor's delegated-agent path doesn't record a run_id today.
                "signal_details": {"run_id": None},
            }
        ]
        assert resolve_autofix_referrers(self.pull_request, attributions) == []

    def test_build_row_carries_autofix_referrers(self) -> None:
        seer_run = self.create_seer_run(
            organization=self.organization, seer_run_state_id=557, referrer="night_shift"
        )
        row = build_pr_metrics_row(
            pull_request=self.pull_request,
            close_action="merged",
            attributions=[
                {
                    "signal_type": "sentry_app",
                    "source": "seer_data",
                    "signal_details": {"run_id": seer_run.seer_run_state_id},
                }
            ],
            group_ids=[],
        )
        assert row.autofix_referrers == ["night_shift"]

    def test_build_row_autofix_referrers_empty_by_default(self) -> None:
        row = build_pr_metrics_row(
            pull_request=self.pull_request,
            close_action="merged",
            attributions=[],
            group_ids=[],
        )
        assert row.autofix_referrers == []

    def test_resolved_group_ids_returns_sorted_resolving_links(self) -> None:
        ids = sorted([self._link_group(), self._link_group()])
        assert resolved_group_ids(self.pull_request) == ids

    def test_resolved_group_ids_excludes_non_resolving_links(self) -> None:
        # Only resolving links count; a "references" link is not a resolution.
        self._link_group(relationship=GroupLink.Relationship.references)
        assert resolved_group_ids(self.pull_request) == []

    def test_resolved_group_ids_empty_when_pr_resolves_nothing(self) -> None:
        assert resolved_group_ids(self.pull_request) == []

    def test_build_row_carries_group_ids(self) -> None:
        row = build_pr_metrics_row(
            pull_request=self.pull_request,
            close_action="merged",
            attributions=[],
            group_ids=[7, 9],
        )
        assert row.group_ids == [7, 9]

    def test_build_row_carries_conversation_analysis(self) -> None:
        # The conversation judge's semantic outputs land on their own prefixed
        # columns; only the metadata bundle is JSON-encoded (as attributions is).
        row = build_pr_metrics_row(
            pull_request=self.pull_request,
            close_action="merged",
            attributions=[],
            group_ids=[],
            conversation_analysis=CONVERSATION_ANALYSIS,
        )
        assert row.conversation_sentiment == "positive"
        assert row.conversation_comments_bot == 0
        assert row.conversation_comments_human == 1
        assert row.conversation_comments_total == 3
        assert row.conversation_comments_judged == 2
        assert row.conversation_comments_truncated == 1
        assert row.conversation_metadata is not None
        assert json.loads(row.conversation_metadata) == CONVERSATION_METADATA

    def test_build_row_carries_diagnosis_labels(self) -> None:
        # The cross-judge close-reason "why" is threaded independently of the
        # conversation analysis, onto its own unprefixed repeated column.
        row = build_pr_metrics_row(
            pull_request=self.pull_request,
            close_action="closed",
            attributions=[],
            group_ids=[],
            diagnosis_labels=DIAGNOSIS_LABELS,
        )
        assert row.diagnosis_labels == ["trivial"]

    def test_build_row_empty_diagnosis_labels_stays_empty(self) -> None:
        # An empty list is a valid value (judge ran, no labels) and emits [], not null.
        row = build_pr_metrics_row(
            pull_request=self.pull_request,
            close_action="closed",
            attributions=[],
            group_ids=[],
            diagnosis_labels=[],
        )
        assert row.diagnosis_labels == []

    def test_build_row_without_judge_enrichment_leaves_fields_null(self) -> None:
        # The no-judge path / old Seer pods supply nothing — every judge column
        # stays null rather than emitting an empty placeholder.
        row = build_pr_metrics_row(
            pull_request=self.pull_request,
            close_action="merged",
            attributions=[],
            group_ids=[],
        )
        assert row.conversation_sentiment is None
        assert row.conversation_comments_bot is None
        assert row.diagnosis_labels is None
        assert row.conversation_metadata is None

    def test_build_row_conversation_metadata_null_when_absent(self) -> None:
        # An analysis without a metadata bundle emits a null conversation_metadata (not
        # "null"-the-string); the semantic columns still populate.
        conversation_analysis = PrConversationAnalysis(sentiment="neutral")
        row = build_pr_metrics_row(
            pull_request=self.pull_request,
            close_action="merged",
            attributions=[],
            group_ids=[],
            conversation_analysis=conversation_analysis,
        )
        assert row.conversation_sentiment == "neutral"
        assert row.conversation_metadata is None

    @patch("sentry.analytics.record")
    def test_emit_threads_judge_enrichment(self, mock_record: Any) -> None:
        self._track()
        emit_pr_metrics_row(
            pull_request=self.pull_request,
            conversation_analysis=CONVERSATION_ANALYSIS,
            diagnosis_labels=DIAGNOSIS_LABELS,
        )
        row = mock_record.call_args[0][0]
        assert row.conversation_sentiment == "positive"
        assert row.conversation_comments_human == 1
        assert row.diagnosis_labels == ["trivial"]
        assert json.loads(row.conversation_metadata) == CONVERSATION_METADATA

    @patch("sentry.analytics.record")
    def test_emit_carries_resolved_group_ids(self, mock_record: Any) -> None:
        self._track()
        group_ids = sorted([self._link_group(), self._link_group()])
        emit_pr_metrics_row(pull_request=self.pull_request)
        assert mock_record.call_args[0][0].group_ids == group_ids

    @patch("sentry.analytics.record")
    def test_emit_records_for_tracked_pr(self, mock_record: Any) -> None:
        self._track()
        emitted = emit_pr_metrics_row(pull_request=self.pull_request)
        assert emitted is True
        assert_last_analytics_event(
            mock_record,
            PrCloseMetricsEvent(
                organization_id=self.organization.id,
                repository_id=self.repo.id,
                repository_provider="github",
                pull_request_id=self.pull_request.id,
                pr_key="42",
                group_ids=[],
                close_action="merged",
                head_commit_sha=HEAD_SHA,
                merge_commit_sha=MERGE_SHA,
                opened_at=OPENED_AT.isoformat(),
                closed_at=CLOSED_AT.isoformat(),
                merged_at=CLOSED_AT.isoformat(),
                draft=False,
                additions=12,
                deletions=3,
                files_changed=2,
                commits_count=4,
                comments_count=5,
                review_comments_count=6,
                is_assigned=True,
                attributions=json.dumps([SENTRY_APP_ATTRIBUTION]),
            ),
        )

    @patch("sentry.analytics.record")
    def test_emit_skips_untracked_pr(self, mock_record: Any) -> None:
        emitted = emit_pr_metrics_row(pull_request=self.pull_request)
        assert emitted is False
        assert mock_record.call_count == 0

    # --- _activity_derived_metrics ---

    def _activity(
        self,
        *,
        webhook_id: str,
        event_type: str = PullRequestActivityType.COMMENT_CREATED,
        sender_login: str = "",
        sender_type: str = "User",
    ) -> None:
        PullRequestActivity.objects.create(
            pull_request=self.pull_request,
            webhook_id=webhook_id,
            event_type=event_type,
            payload={"sender_login": sender_login, "sender_type": sender_type},
        )

    def test_activity_derived_metrics_zero_without_activity(self) -> None:
        assert _activity_derived_metrics(self.pull_request) == {
            "participants_count": 0,
            "reviews_count": 0,
            "reviews_bot_count": 0,
            "reviews_human_count": 0,
            "pushes_bot_count": 0,
            "pushes_human_count": 0,
            "opened_by_bot": None,
            "closed_by_bot": None,
            "opened_and_closed_by_same_actor": None,
        }

    def test_activity_derived_metrics_counts_reviews_and_distinct_participants(self) -> None:
        self._activity(
            webhook_id="a1", event_type=PullRequestActivityType.OPENED, sender_login="octocat"
        )
        self._activity(webhook_id="a2", sender_login="octocat")  # same participant again
        self._activity(webhook_id="a3", sender_login="reviewer")
        self._activity(
            webhook_id="a4",
            event_type=PullRequestActivityType.REVIEW_SUBMITTED,
            sender_login="reviewer",
        )
        self._activity(
            webhook_id="a5",
            event_type=PullRequestActivityType.REVIEW_SUBMITTED,
            sender_login="reviewer",
        )
        result = _activity_derived_metrics(self.pull_request)
        assert result["participants_count"] == 2  # distinct octocat, reviewer
        assert result["reviews_count"] == 2  # two REVIEW_SUBMITTED rows, not distinct reviewers

    def test_activity_derived_metrics_excludes_bots_and_blank_logins(self) -> None:
        self._activity(webhook_id="b1", sender_login="human")
        self._activity(webhook_id="b2", sender_login="dependabot", sender_type="Bot")
        self._activity(
            webhook_id="b3", event_type=PullRequestActivityType.SYNCHRONIZED, sender_login=""
        )
        result = _activity_derived_metrics(self.pull_request)
        assert result["participants_count"] == 1  # "human"; bot + blank login excluded
        assert result["reviews_count"] == 0

    def test_activity_derived_metrics_splits_reviews_by_account_class(self) -> None:
        self._activity(
            webhook_id="r1",
            event_type=PullRequestActivityType.REVIEW_SUBMITTED,
            sender_login="human",
        )
        self._activity(
            webhook_id="r2",
            event_type=PullRequestActivityType.REVIEW_SUBMITTED,
            sender_login="seer",
            sender_type="Bot",
        )
        self._activity(
            webhook_id="r3",
            event_type=PullRequestActivityType.REVIEW_SUBMITTED,
            sender_login="seer",
            sender_type="Bot",
        )
        result = _activity_derived_metrics(self.pull_request)
        assert result["reviews_count"] == 3
        assert result["reviews_bot_count"] == 2
        assert result["reviews_human_count"] == 1  # sums back to reviews_count

    def test_activity_derived_metrics_splits_pushes_by_account_class(self) -> None:
        # A push is an opened or synchronize event; the pusher's account class,
        # not the commit count, is what's split (a bot batch push counts as one).
        self._activity(
            webhook_id="p1",
            event_type=PullRequestActivityType.OPENED,
            sender_login="human",
        )
        self._activity(
            webhook_id="p2",
            event_type=PullRequestActivityType.SYNCHRONIZED,
            sender_login="seer",
            sender_type="Bot",
        )
        self._activity(
            webhook_id="p3",
            event_type=PullRequestActivityType.SYNCHRONIZED,
            sender_login="human",
        )
        # A review is not a push and must not be counted here.
        self._activity(
            webhook_id="p4",
            event_type=PullRequestActivityType.REVIEW_SUBMITTED,
            sender_login="human",
        )
        result = _activity_derived_metrics(self.pull_request)
        assert result["pushes_bot_count"] == 1
        assert result["pushes_human_count"] == 2

    def test_activity_derived_metrics_opener_and_closer_account_class(self) -> None:
        self._activity(
            webhook_id="o1",
            event_type=PullRequestActivityType.OPENED,
            sender_login="seer",
            sender_type="Bot",
        )
        self._activity(
            webhook_id="o2",
            event_type=PullRequestActivityType.CLOSED,
            sender_login="human",
        )
        result = _activity_derived_metrics(self.pull_request)
        assert result["opened_by_bot"] is True
        assert result["closed_by_bot"] is False
        assert result["opened_and_closed_by_same_actor"] is False

    def test_activity_derived_metrics_same_actor_opened_and_merged(self) -> None:
        self._activity(
            webhook_id="s1", event_type=PullRequestActivityType.OPENED, sender_login="octocat"
        )
        self._activity(
            webhook_id="s2", event_type=PullRequestActivityType.MERGED, sender_login="octocat"
        )
        result = _activity_derived_metrics(self.pull_request)
        assert result["opened_by_bot"] is False
        assert result["closed_by_bot"] is False
        assert result["opened_and_closed_by_same_actor"] is True

    def test_activity_derived_metrics_closer_is_latest_terminal_row(self) -> None:
        # A PR can be closed unmerged, reopened, then merged, leaving two terminal
        # rows. The closer must be the latest (the merge), not an earlier close.
        self._activity(
            webhook_id="t1", event_type=PullRequestActivityType.OPENED, sender_login="author"
        )
        self._activity(
            webhook_id="t2", event_type=PullRequestActivityType.CLOSED, sender_login="early-closer"
        )
        self._activity(
            webhook_id="t3",
            event_type=PullRequestActivityType.MERGED,
            sender_login="merger",
            sender_type="Bot",
        )
        result = _activity_derived_metrics(self.pull_request)
        assert result["closed_by_bot"] is True  # the merger (Bot), not early-closer (human)
        assert result["opened_and_closed_by_same_actor"] is False

    def test_activity_derived_metrics_same_actor_null_when_closer_missing(self) -> None:
        self._activity(
            webhook_id="m1", event_type=PullRequestActivityType.OPENED, sender_login="octocat"
        )
        result = _activity_derived_metrics(self.pull_request)
        assert result["opened_by_bot"] is False
        assert result["closed_by_bot"] is None
        assert result["opened_and_closed_by_same_actor"] is None

    @patch("sentry.analytics.record")
    def test_emit_persists_and_carries_activity_derived_counts(self, mock_record: Any) -> None:
        self._track()
        self._activity(
            webhook_id="c1", event_type=PullRequestActivityType.OPENED, sender_login="octocat"
        )
        self._activity(
            webhook_id="c2",
            event_type=PullRequestActivityType.REVIEW_SUBMITTED,
            sender_login="reviewer",
        )
        self._activity(
            webhook_id="c3", event_type=PullRequestActivityType.MERGED, sender_login="octocat"
        )
        emit_pr_metrics_row(pull_request=self.pull_request)

        # Persisted onto the metrics row so recovery re-reads them post-cleanup...
        row = PullRequestMetrics.objects.get(pull_request=self.pull_request)
        assert row.participants_count == 2
        assert row.reviews_count == 1
        assert row.reviews_human_count == 1
        assert row.pushes_human_count == 1  # the opened event
        assert row.opened_by_bot is False
        assert row.closed_by_bot is False
        assert row.opened_and_closed_by_same_actor is True
        # ...and carried on the emitted analytics row.
        emitted = mock_record.call_args[0][0]
        assert emitted.participants_count == 2
        assert emitted.reviews_count == 1
        assert emitted.reviews_human_count == 1
        assert emitted.opened_and_closed_by_same_actor is True

    # --- _commit_shas_from_activity ---

    def _sync_activity(self, *, after_sha: str, before_sha: str, webhook_id: str) -> None:
        PullRequestActivity.objects.create(
            pull_request=self.pull_request,
            webhook_id=webhook_id,
            event_type=PullRequestActivityType.SYNCHRONIZED,
            payload={"after_sha": after_sha, "before_sha": before_sha},
        )

    def test_commit_shas_from_activity_empty_when_no_events(self) -> None:
        assert _commit_shas_from_activity(self.pull_request) == set()

    def test_commit_shas_from_activity_single_event(self) -> None:
        self._sync_activity(after_sha="a" * 40, before_sha="b" * 40, webhook_id="s1")
        assert _commit_shas_from_activity(self.pull_request) == {"a" * 40}

    def test_commit_shas_from_activity_normal_chain(self) -> None:
        # Two pushes in a normal (non-force) sequence.
        # Older event created first so it gets a lower timestamp/id.
        self._sync_activity(after_sha="b" * 40, before_sha="c" * 40, webhook_id="s1")
        self._sync_activity(after_sha="a" * 40, before_sha="b" * 40, webhook_id="s2")
        assert _commit_shas_from_activity(self.pull_request) == {
            "a" * 40,
            "b" * 40,
        }

    def test_commit_shas_from_activity_stops_at_force_push(self) -> None:
        # P1 (older): after=x, before=y — disconnected from P2.after; force push.
        # P2 (newer): after=a, before=b — always included.
        self._sync_activity(after_sha="x" * 40, before_sha="y" * 40, webhook_id="s1")
        self._sync_activity(after_sha="a" * 40, before_sha="b" * 40, webhook_id="s2")
        # "x" != "b" → force push detected; only a survives.
        assert _commit_shas_from_activity(self.pull_request) == {"a" * 40}

    def test_commit_shas_from_activity_returns_empty_when_only_event_has_no_after_sha(self) -> None:
        PullRequestActivity.objects.create(
            pull_request=self.pull_request,
            webhook_id="s1",
            event_type=PullRequestActivityType.SYNCHRONIZED,
            payload={"before_sha": "b" * 40},  # no after_sha
        )
        assert _commit_shas_from_activity(self.pull_request) == set()

    def test_commit_shas_from_activity_stops_when_chain_event_has_no_after_sha(self) -> None:
        # Three events newest→oldest: s3, s2 (no after_sha), s1.
        # The loop breaks on s2; s1 is never reached.
        self._sync_activity(after_sha="b" * 40, before_sha="a" * 40, webhook_id="s1")
        PullRequestActivity.objects.create(
            pull_request=self.pull_request,
            webhook_id="s2",
            event_type=PullRequestActivityType.SYNCHRONIZED,
            payload={"before_sha": "c" * 40},  # no after_sha — middle event
        )
        self._sync_activity(after_sha="c" * 40, before_sha="d" * 40, webhook_id="s3")
        assert _commit_shas_from_activity(self.pull_request) == {"c" * 40}

    # --- _resolved_group_ids (commit-link extension) ---

    def _link_commit_group(self, *, key: str) -> tuple[int, int]:
        """Create a commit + resolving GroupLink; return (group_id, commit_id)."""
        commit = self.create_commit(repo=self.repo, key=key)
        group = self.create_group(project=self.project)
        GroupLink.objects.create(
            group_id=group.id,
            project_id=group.project_id,
            linked_type=GroupLink.LinkedType.commit,
            relationship=GroupLink.Relationship.resolves,
            linked_id=commit.id,
        )
        return group.id, commit.id

    def test_resolved_group_ids_includes_commit_link_via_activity(self) -> None:
        group_id, _ = self._link_commit_group(key="a" * 40)
        self._sync_activity(after_sha="a" * 40, before_sha="b" * 40, webhook_id="s1")
        assert resolved_group_ids(self.pull_request) == [group_id]

    def test_resolved_group_ids_merges_pr_and_commit_links(self) -> None:
        pr_group_id = self._link_group()
        commit_group_id, _ = self._link_commit_group(key="c" * 40)
        self._sync_activity(after_sha="c" * 40, before_sha="d" * 40, webhook_id="s1")
        assert resolved_group_ids(self.pull_request) == sorted([pr_group_id, commit_group_id])

    def test_resolved_group_ids_deduplicates_pr_and_commit_links(self) -> None:
        # Same group linked both via PR and via a commit in the activity chain.
        group = self.create_group(project=self.project)
        GroupLink.objects.create(
            group_id=group.id,
            project_id=group.project_id,
            linked_type=GroupLink.LinkedType.pull_request,
            relationship=GroupLink.Relationship.resolves,
            linked_id=self.pull_request.id,
        )
        commit = self.create_commit(repo=self.repo, key="e" * 40)
        GroupLink.objects.create(
            group_id=group.id,
            project_id=group.project_id,
            linked_type=GroupLink.LinkedType.commit,
            relationship=GroupLink.Relationship.resolves,
            linked_id=commit.id,
        )
        self._sync_activity(after_sha="e" * 40, before_sha="f" * 40, webhook_id="s1")
        assert resolved_group_ids(self.pull_request) == [group.id]

    def test_resolved_group_ids_excludes_commit_references_links(self) -> None:
        commit = self.create_commit(repo=self.repo, key="a" * 40)
        group = self.create_group(project=self.project)
        GroupLink.objects.create(
            group_id=group.id,
            project_id=group.project_id,
            linked_type=GroupLink.LinkedType.commit,
            relationship=GroupLink.Relationship.references,
            linked_id=commit.id,
        )
        self._sync_activity(after_sha="a" * 40, before_sha="b" * 40, webhook_id="s1")
        assert resolved_group_ids(self.pull_request) == []

    def test_resolved_group_ids_excludes_commits_after_force_push(self) -> None:
        # sha "x" is behind a force-push boundary and should be excluded.
        group_id, _ = self._link_commit_group(key="x" * 40)
        # Older event first → lower timestamp/id.
        self._sync_activity(after_sha="x" * 40, before_sha="y" * 40, webhook_id="s1")
        self._sync_activity(after_sha="a" * 40, before_sha="b" * 40, webhook_id="s2")
        # "x" != "b" → force push detected; only "a" survives.
        assert resolved_group_ids(self.pull_request) == []

    def test_resolved_group_ids_ignores_untracked_commit_shas(self) -> None:
        # A SHA in the activity that has no Commit row in Sentry doesn't error.
        self._sync_activity(after_sha="a" * 40, before_sha="b" * 40, webhook_id="s1")
        assert resolved_group_ids(self.pull_request) == []

    def test_resolved_group_ids_with_commits_falls_back_to_pr_links_when_no_activity(
        self,
    ) -> None:
        # No SYNCHRONIZED activity: PR-linked groups are still returned (commit path is a no-op).
        pr_group_id = self._link_group()
        assert resolved_group_ids(self.pull_request) == [pr_group_id]

    @patch("sentry.analytics.record")
    def test_emit_picks_up_commit_linked_groups_via_activity(self, mock_record: Any) -> None:
        # The full path: a commit reachable from SYNCHRONIZED activity resolves a
        # group → emit should include that group_id in the emitted row.
        self._track()
        group_id, _ = self._link_commit_group(key="a" * 40)
        self._sync_activity(after_sha="a" * 40, before_sha="b" * 40, webhook_id="s1")
        emit_pr_metrics_row(pull_request=self.pull_request)
        assert mock_record.call_args[0][0].group_ids == [group_id]

    @patch("sentry.pr_metrics.tasks.cleanup_pr_activity_task")
    @patch("sentry.analytics.record")
    def test_emit_enqueues_cleanup_task(self, mock_record: Any, mock_cleanup: Any) -> None:
        self._track()
        emit_pr_metrics_row(pull_request=self.pull_request)
        mock_cleanup.delay.assert_called_once_with(pull_request_id=self.pull_request.id)

    @patch("sentry.pr_metrics.tasks.cleanup_pr_activity_task")
    @patch("sentry.analytics.record")
    def test_untracked_pr_does_not_enqueue_cleanup(
        self, mock_record: Any, mock_cleanup: Any
    ) -> None:
        # No attribution → emit returns False and must not enqueue cleanup.
        result = emit_pr_metrics_row(pull_request=self.pull_request)
        assert result is False
        mock_cleanup.delay.assert_not_called()
