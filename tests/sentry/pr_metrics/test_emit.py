from datetime import datetime, timezone
from typing import Any
from unittest.mock import patch

import pytest

from sentry.analytics.events.pr_metrics_events import PrCloseMetricsEvent
from sentry.models.pullrequest import (
    PullRequestAttribution,
    PullRequestAttributionSignalType,
    PullRequestAttributionSource,
)
from sentry.pr_metrics.emit import (
    _active_attributions,
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
# Lifecycle lives on the PullRequest row; open time stays on the payload. Past
# year avoids S015.
CLOSED_AT = datetime(2020, 6, 4, 10, 0, 0, tzinfo=timezone.utc)
OPENED_AT = "2020-06-04T09:00:00Z"


@cell_silo_test
class PrMetricsEmissionTest(TestCase):
    def setUp(self) -> None:
        self.repo = self.create_repo(
            self.project, name="getsentry/sentry", provider="integrations:github"
        )
        self.pull_request = self.create_pull_request(
            repository_id=self.repo.id, organization_id=self.organization.id, key="42"
        )
        # build_pr_metrics_row reads lifecycle from the row, not the payload.
        # Default to a merged PR; close-specific tests null the merge fields.
        self.pull_request.head_commit_sha = HEAD_SHA
        self.pull_request.merge_commit_sha = MERGE_SHA
        self.pull_request.closed_at = CLOSED_AT
        self.pull_request.merged_at = CLOSED_AT

    def _payload(self) -> dict[str, Any]:
        # Payload-sourced fields only: open time, draft, and activity counters.
        return {
            "number": 42,
            "created_at": OPENED_AT,
            "draft": False,
            "additions": 12,
            "deletions": 3,
            "changed_files": 2,
            "commits": 4,
            "comments": 5,
            "review_comments": 6,
            "assignees": [{"login": "octocat"}],
        }

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

    def test_needs_judge_is_false_in_m1(self) -> None:
        assert needs_judge(self.pull_request) is False

    def test_build_row_for_merge(self) -> None:
        row = build_pr_metrics_row(
            pull_request=self.pull_request,
            close_action="merged",
            payload=self._payload(),
            attributions=[SENTRY_APP_ATTRIBUTION],
        )
        assert row.close_action == "merged"
        assert row.head_commit_sha == HEAD_SHA
        assert row.merge_commit_sha == MERGE_SHA
        assert row.closed_at == CLOSED_AT.isoformat()
        assert row.merged_at == CLOSED_AT.isoformat()
        assert json.loads(row.attributions) == [SENTRY_APP_ATTRIBUTION]

    def test_build_row_carries_payload_counters(self) -> None:
        row = build_pr_metrics_row(
            pull_request=self.pull_request,
            close_action="merged",
            payload=self._payload(),
            attributions=[],
        )
        assert row.opened_at == OPENED_AT
        assert row.draft is False
        assert row.additions == 12
        assert row.deletions == 3
        assert row.files_changed == 2
        assert row.commits_count == 4
        assert row.comments_count == 5
        assert row.review_comments_count == 6
        assert row.is_assigned is True

    def test_build_row_counters_default_to_zero_when_absent(self) -> None:
        row = build_pr_metrics_row(
            pull_request=self.pull_request,
            close_action="closed",
            payload={"number": 42, "created_at": OPENED_AT},
            attributions=[],
        )
        assert row.additions == 0
        assert row.commits_count == 0
        assert row.is_assigned is False

    def test_build_row_raises_when_opened_at_missing(self) -> None:
        # opened_at has no persisted column, so it's read fail-fast — a malformed
        # payload errors (and the webhook loop logs it) rather than emitting null.
        with pytest.raises(KeyError):
            build_pr_metrics_row(
                pull_request=self.pull_request,
                close_action="closed",
                payload={"number": 42},
                attributions=[],
            )

    def test_build_row_raises_when_stored_lifecycle_missing(self) -> None:
        # A close/merge row needs a persisted head_commit_sha and closed_at; a
        # null means emit ran on a PR that never reached a terminal state.
        self.pull_request.closed_at = None
        with pytest.raises(ValueError):
            build_pr_metrics_row(
                pull_request=self.pull_request,
                close_action="merged",
                payload=self._payload(),
                attributions=[],
            )

    def test_build_row_for_close_omits_merge_commit_sha(self) -> None:
        # The webhook persists null merge fields for a closed-but-unmerged PR.
        self.pull_request.merge_commit_sha = None
        self.pull_request.merged_at = None
        row = build_pr_metrics_row(
            pull_request=self.pull_request,
            close_action="closed",
            payload=self._payload(),
            attributions=[],
        )
        assert row.merge_commit_sha is None
        assert row.merged_at is None
        assert row.head_commit_sha == HEAD_SHA
        assert row.closed_at == CLOSED_AT.isoformat()

    def test_build_row_reads_lifecycle_from_stored_row_not_payload(self) -> None:
        # Lifecycle in the payload must be ignored — the stored row is the source
        # of truth, shared with the judge path (which has no payload at all).
        row = build_pr_metrics_row(
            pull_request=self.pull_request,
            close_action="merged",
            payload={
                **self._payload(),
                "head": {"sha": "c" * 40},
                "closed_at": "2020-01-01T00:00:00Z",
                "merged_at": "2020-01-01T00:00:00Z",
                "merge_commit_sha": "d" * 40,
            },
            attributions=[],
        )
        assert row.head_commit_sha == HEAD_SHA
        assert row.merge_commit_sha == MERGE_SHA
        assert row.closed_at == CLOSED_AT.isoformat()
        assert row.merged_at == CLOSED_AT.isoformat()

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

    @patch("sentry.analytics.record")
    def test_emit_records_for_tracked_pr(self, mock_record: Any) -> None:
        self._track()
        emitted = emit_pr_metrics_row(
            pull_request=self.pull_request,
            close_action="merged",
            payload=self._payload(),
        )
        assert emitted is True
        assert_last_analytics_event(
            mock_record,
            PrCloseMetricsEvent(
                organization_id=self.organization.id,
                repository_id=self.repo.id,
                pull_request_id=self.pull_request.id,
                pr_key="42",
                close_action="merged",
                head_commit_sha=HEAD_SHA,
                merge_commit_sha=MERGE_SHA,
                opened_at=OPENED_AT,
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
            payload=self._payload(),
        )
        assert emitted is False
        assert mock_record.call_count == 0
