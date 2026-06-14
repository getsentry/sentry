from datetime import datetime, timezone
from typing import Any
from unittest.mock import patch

import pytest

from sentry.analytics.events.pr_metrics_events import PrCloseMetricsEvent
from sentry.models.grouplink import GroupLink
from sentry.models.pullrequest import (
    PullRequestActivity,
    PullRequestActivityType,
    PullRequestAttribution,
    PullRequestAttributionSignalType,
    PullRequestAttributionSource,
    PullRequestMetrics,
    PullRequestVerdict,
)
from sentry.pr_metrics.emit import (
    _active_attributions,
    _commit_shas_from_activity,
    _resolved_group_ids,
    build_pr_metrics_row,
    emit_pr_metrics_row,
    is_pr_tracked,
    select_verdict,
)
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
@with_feature("organizations:pr-metrics-activity")
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

    def test_select_verdict_merged_without_later_commits_is_unchanged(self) -> None:
        # Merged with no SYNCHRONIZED activity: merge head == opened head.
        assert (
            select_verdict(self.pull_request, self.organization)
            == PullRequestVerdict.MERGED_UNCHANGED
        )

    def test_select_verdict_merged_with_later_commits_needs_judge(self) -> None:
        self._add_synchronize()
        assert select_verdict(self.pull_request, self.organization) is None

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
        assert select_verdict(self.pull_request, self.organization) is None

    def test_select_verdict_merged_without_metrics_row_needs_judge(self) -> None:
        # A missing row is an error state for a merge too: defer rather than emit a
        # row with zeroed counters.
        PullRequestMetrics.objects.filter(pull_request=self.pull_request).delete()
        with patch("sentry.pr_metrics.emit.logger") as mock_logger:
            assert select_verdict(self.pull_request, self.organization) is None
        mock_logger.warning.assert_called_once_with(
            "pr_metrics.select_verdict.metrics_row_missing",
            extra={
                "organization_id": self.organization.id,
                "pull_request_id": self.pull_request.id,
            },
        )

    def test_select_verdict_closed_without_metrics_row_needs_judge(self) -> None:
        # A missing row is an error state (handle_metrics failed): warn, and defer
        # to a judge rather than guess "abandoned".
        self.pull_request.merged_at = None
        PullRequestMetrics.objects.filter(pull_request=self.pull_request).delete()
        with patch("sentry.pr_metrics.emit.logger") as mock_logger:
            assert select_verdict(self.pull_request, self.organization) is None
        mock_logger.warning.assert_called_once_with(
            "pr_metrics.select_verdict.metrics_row_missing",
            extra={
                "organization_id": self.organization.id,
                "pull_request_id": self.pull_request.id,
            },
        )

    def test_select_verdict_closed_with_later_commits_needs_judge(self) -> None:
        self.pull_request.merged_at = None
        PullRequestMetrics.objects.filter(pull_request=self.pull_request).update(
            comments_count=0, review_comments_count=0
        )
        self._add_synchronize()
        assert select_verdict(self.pull_request, self.organization) is None

    def test_select_verdict_needs_judge_when_activity_tracking_disabled(self) -> None:
        # The commits-after-open signal comes from activity rows the org isn't
        # recording, so an otherwise-clean merge can't be settled deterministically.
        with self.feature({"organizations:pr-metrics-activity": False}):
            with patch("sentry.pr_metrics.emit.metrics") as mock_metrics:
                assert select_verdict(self.pull_request, self.organization) is None
        mock_metrics.incr.assert_called_once_with("pr_metrics.select_verdict.activity_disabled")

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
            PullRequestAttributionSignalType.REFERENCED_ISSUE,
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
            PullRequestAttributionSignalType.REFERENCED_ISSUE,
            source=PullRequestAttributionSource.WEBHOOK_DATA,
            is_valid=False,
        )
        assert _active_attributions(self.pull_request) == [SENTRY_APP_ATTRIBUTION]

    def test_active_attributions_ordered_by_priority_with_source_and_details(self) -> None:
        # Lower-confidence signal recorded first, but ordered second.
        self._track(
            PullRequestAttributionSignalType.REFERENCED_ISSUE,
            source=PullRequestAttributionSource.WEBHOOK_DATA,
            signal_details={"group_ids": [7]},
        )
        self._track(PullRequestAttributionSignalType.SENTRY_APP)
        assert _active_attributions(self.pull_request) == [
            SENTRY_APP_ATTRIBUTION,
            {
                "signal_type": "referenced_issue",
                "source": "webhook_data",
                "signal_details": {"group_ids": [7]},
            },
        ]

    def test_resolved_group_ids_returns_sorted_resolving_links(self) -> None:
        ids = sorted([self._link_group(), self._link_group()])
        assert _resolved_group_ids(self.pull_request) == ids

    def test_resolved_group_ids_excludes_non_resolving_links(self) -> None:
        # Only resolving links count; a "references" link is not a resolution.
        self._link_group(relationship=GroupLink.Relationship.references)
        assert _resolved_group_ids(self.pull_request) == []

    def test_resolved_group_ids_empty_when_pr_resolves_nothing(self) -> None:
        assert _resolved_group_ids(self.pull_request) == []

    def test_build_row_carries_group_ids(self) -> None:
        row = build_pr_metrics_row(
            pull_request=self.pull_request,
            close_action="merged",
            attributions=[],
            group_ids=[7, 9],
        )
        assert row.group_ids == [7, 9]

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
        assert _commit_shas_from_activity(self.pull_request) == {"a" * 40, "b" * 40}

    def test_commit_shas_from_activity_normal_chain(self) -> None:
        # Two pushes in a normal (non-force) sequence.
        # Older event created first so it gets a lower timestamp/id.
        self._sync_activity(after_sha="b" * 40, before_sha="c" * 40, webhook_id="s1")
        self._sync_activity(after_sha="a" * 40, before_sha="b" * 40, webhook_id="s2")
        assert _commit_shas_from_activity(self.pull_request) == {
            "a" * 40,
            "b" * 40,
            "c" * 40,
        }

    def test_commit_shas_from_activity_stops_at_force_push(self) -> None:
        # P1 (older): after=x, before=y — disconnected from P2.after; force push.
        # P2 (newer): after=a, before=b — always included.
        self._sync_activity(after_sha="x" * 40, before_sha="y" * 40, webhook_id="s1")
        self._sync_activity(after_sha="a" * 40, before_sha="b" * 40, webhook_id="s2")
        # "x" != "b" → force push detected; only a, b survive.
        assert _commit_shas_from_activity(self.pull_request) == {"a" * 40, "b" * 40}

    def test_commit_shas_from_activity_skips_missing_after_sha(self) -> None:
        PullRequestActivity.objects.create(
            pull_request=self.pull_request,
            webhook_id="s1",
            event_type=PullRequestActivityType.SYNCHRONIZED,
            payload={"before_sha": "b" * 40},  # no after_sha
        )
        assert _commit_shas_from_activity(self.pull_request) == set()

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
        assert _resolved_group_ids(self.pull_request) == [group_id]

    def test_resolved_group_ids_merges_pr_and_commit_links(self) -> None:
        pr_group_id = self._link_group()
        commit_group_id, _ = self._link_commit_group(key="c" * 40)
        self._sync_activity(after_sha="c" * 40, before_sha="d" * 40, webhook_id="s1")
        assert _resolved_group_ids(self.pull_request) == sorted([pr_group_id, commit_group_id])

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
        assert _resolved_group_ids(self.pull_request) == [group.id]

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
        assert _resolved_group_ids(self.pull_request) == []

    def test_resolved_group_ids_excludes_commits_after_force_push(self) -> None:
        # sha "x" is behind a force-push boundary and should be excluded.
        group_id, _ = self._link_commit_group(key="x" * 40)
        # Older event first → lower timestamp/id.
        self._sync_activity(after_sha="x" * 40, before_sha="y" * 40, webhook_id="s1")
        self._sync_activity(after_sha="a" * 40, before_sha="b" * 40, webhook_id="s2")
        # "x" != "b" → force push; only a,b survive.
        assert _resolved_group_ids(self.pull_request) == []

    def test_resolved_group_ids_ignores_untracked_commit_shas(self) -> None:
        # A SHA in the activity that has no Commit row in Sentry doesn't error.
        self._sync_activity(after_sha="a" * 40, before_sha="b" * 40, webhook_id="s1")
        assert _resolved_group_ids(self.pull_request) == []
