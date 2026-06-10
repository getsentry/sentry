from datetime import datetime, timezone
from typing import Any
from unittest.mock import patch

import pytest

from sentry.analytics.events.pr_metrics_events import PrCloseMetricsEvent
from sentry.models.grouplink import GroupLink
from sentry.models.pullrequest import (
    PullRequestAttribution,
    PullRequestAttributionSignalType,
    PullRequestAttributionSource,
    PullRequestMetrics,
)
from sentry.pr_metrics.emit import (
    _active_attributions,
    _resolved_group_ids,
    build_pr_metrics_row,
    emit_pr_metrics_row,
    needs_judge,
)
from sentry.testutils.cases import TestCase
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

    def test_needs_judge_is_false_in_m1(self) -> None:
        assert needs_judge(self.pull_request) is False

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
        emit_pr_metrics_row(
            pull_request=self.pull_request,
            close_action="merged",
        )
        assert mock_record.call_args[0][0].group_ids == group_ids

    @patch("sentry.analytics.record")
    def test_emit_records_for_tracked_pr(self, mock_record: Any) -> None:
        self._track()
        emitted = emit_pr_metrics_row(
            pull_request=self.pull_request,
            close_action="merged",
        )
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
        emitted = emit_pr_metrics_row(
            pull_request=self.pull_request,
            close_action="merged",
        )
        assert emitted is False
        assert mock_record.call_count == 0
