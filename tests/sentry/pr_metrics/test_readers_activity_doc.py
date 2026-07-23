"""Reader-routing tests for the reduced activity document (CORE-283 PR 4).

Each reader (select_verdict, select_fallback_verdict, the activity-derived counters,
ci_failing_at_close, resolved_group_ids, the judge timeline forward) routes per PR by
store presence: a ``PullRequestActivityLog`` row → read the document; no row → read
the legacy rows.
These craft a document and assert the reader returns the document-derived value
(there are no legacy rows, so the two stores can't be confused). The parity check
and the post-emit sweep are covered too.
"""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any
from unittest.mock import patch

from sentry.models.grouplink import GroupLink
from sentry.models.pullrequest import (
    PullRequestActivity,
    PullRequestActivityLog,
    PullRequestActivityType,
    PullRequestMetrics,
    PullRequestVerdict,
)
from sentry.pr_metrics.emit import (
    VerdictDeferral,
    _activity_derived_metrics,
    ci_failing_at_close,
    review_activity,
    select_fallback_verdict,
    select_verdict,
)
from sentry.pr_metrics.judge import _build_judge_request, _pr_activity_timeline
from sentry.pr_metrics.tasks import cleanup_pr_activity_task
from sentry.pr_metrics.utils import load_activity_document, resolved_group_ids
from sentry.testutils.cases import TestCase
from sentry.testutils.helpers import with_feature
from sentry.testutils.silo import cell_silo_test

HEAD_SHA = "a" * 40


def _doc(**overrides: Any) -> dict[str, Any]:
    base: dict[str, Any] = {
        "version": 1,
        "events": [],
        "checks": {},
        "participants": {},
        "counts": {},
        "events_dropped": 0,
        "sync_chain": [],
    }
    base.update(overrides)
    return base


def _entry(event_type: str, webhook_id: str, **payload: Any) -> dict[str, Any]:
    return {
        "event_type": event_type,
        "ts": "2026-07-10T12:00:00Z",
        "event_at": None,
        "webhook_id": webhook_id,
        "payload": payload,
    }


def _group(**overrides: Any) -> dict[str, Any]:
    base: dict[str, Any] = {
        "head_sha": "sha1",
        "app_slug": "github-actions",
        "suite_conclusion": None,
        "suite_updated_at": None,
        "check_runs_count": 0,
        "runs": {},
        "first_failure_at": None,
        "last_event_at": None,
    }
    base.update(overrides)
    return base


@cell_silo_test
@with_feature("organizations:pr-metrics-activity")
class ActivityDocumentReadersTest(TestCase):
    def setUp(self) -> None:
        self.repo = self.create_repo(
            self.project, name="getsentry/sentry", provider="integrations:github"
        )
        self.pr = self.create_pull_request(
            repository_id=self.repo.id, organization_id=self.organization.id, key="42"
        )
        self.pr.head_commit_sha = HEAD_SHA
        self.pr.merge_commit_sha = "b" * 40
        self.pr.closed_at = datetime(2020, 6, 4, 10, tzinfo=timezone.utc)
        self.pr.merged_at = datetime(2020, 6, 4, 10, tzinfo=timezone.utc)
        self.pr.save()

    def _write_doc(self, doc: dict[str, Any]) -> None:
        PullRequestActivityLog.objects.create(pull_request=self.pr, data=doc)

    # --- select_verdict ---------------------------------------------------

    def test_select_verdict_reads_has_commits_from_doc(self) -> None:
        PullRequestMetrics.objects.create(pull_request=self.pr)
        # A push landed after open → merged-with-later-commits → defer to a judge.
        self._write_doc(_doc(counts={"synchronized": 1}))
        assert select_verdict(self.pr, self.organization) is VerdictDeferral.NEEDS_JUDGE

    def test_select_verdict_merged_unchanged_from_empty_doc(self) -> None:
        PullRequestMetrics.objects.create(pull_request=self.pr)
        # Document exists but records no pushes → merge head == opened head.
        self._write_doc(_doc())
        assert select_verdict(self.pr, self.organization) == PullRequestVerdict.MERGED_UNCHANGED

    def test_unfolded_doc_row_reads_as_absent_not_empty(self) -> None:
        # A row created but never folded holds the model's {} default (no version) —
        # not a document. load_activity_document must report absence so readers fall
        # back to the legacy store instead of computing zeros from a phantom doc.
        PullRequestMetrics.objects.create(pull_request=self.pr)
        PullRequestActivityLog.objects.create(pull_request=self.pr, data={})
        PullRequestActivity.objects.create(
            pull_request=self.pr,
            webhook_id="sync1",
            event_type=PullRequestActivityType.SYNCHRONIZED,
            payload={},
        )
        assert load_activity_document(self.pr) is None
        # The legacy SYNCHRONIZED row wins the routing fallback, so the reader sees
        # the push and defers to the judge — not the wrong MERGED_UNCHANGED it would
        # emit if the empty {} doc were read as a real (zeroed) document.
        assert select_verdict(self.pr, self.organization) is VerdictDeferral.NEEDS_JUDGE

    # --- select_fallback_verdict ------------------------------------------

    def test_select_fallback_verdict_reads_has_commits_from_doc(self) -> None:
        # The judge-ineligible (weak/MCP) path: select_verdict defers NEEDS_JUDGE,
        # no judge ever runs, and the fallback settles the verdict itself. It has to
        # route to the same store select_verdict did — reading only the legacy rows
        # finds nothing here and mislabels an iterated PR MERGED_UNCHANGED.
        PullRequestMetrics.objects.create(pull_request=self.pr)
        self._write_doc(_doc(counts={"synchronized": 1}))
        assert select_verdict(self.pr, self.organization) is VerdictDeferral.NEEDS_JUDGE
        assert select_fallback_verdict(self.pr) == PullRequestVerdict.MERGED_WITH_ITERATION

    def test_select_fallback_verdict_merged_unchanged_from_empty_doc(self) -> None:
        self._write_doc(_doc())
        assert select_fallback_verdict(self.pr) == PullRequestVerdict.MERGED_UNCHANGED

    # --- _activity_derived_metrics ----------------------------------------

    def test_activity_derived_metrics_from_doc(self) -> None:
        self._write_doc(
            _doc(
                counts={"review_submitted": 2},
                participants={"human": "User", "ci[bot]": "Bot"},
                events=[
                    _entry("review_submitted", "r1", sender_login="human", sender_type="User"),
                    _entry("review_submitted", "r2", sender_login="botrev", sender_type="Bot"),
                ],
            )
        )
        metrics = _activity_derived_metrics(self.pr)
        assert metrics["reviews_count"] == 2
        assert metrics["reviews_bot_count"] == 1
        assert metrics["reviews_human_count"] == 1
        assert metrics["participants_count"] == 1  # human only; ci[bot] excluded

    # --- ci_failing_at_close ----------------------------------------------

    def test_ci_failing_at_close_from_doc(self) -> None:
        self._write_doc(_doc(checks={"sha1|github-actions": _group(suite_conclusion="failure")}))
        assert ci_failing_at_close(self.pr) is True

    def test_ci_not_failing_at_close_from_doc(self) -> None:
        self._write_doc(_doc(checks={"sha1|github-actions": _group(suite_conclusion="success")}))
        assert ci_failing_at_close(self.pr) is False

    # --- review_activity (requested_count, results) -------------------------

    def test_reviews_requested_count_from_doc(self) -> None:
        self._write_doc(_doc(counts={"review_requested": 3, "review_request_removed": 1}))
        assert review_activity(self.pr).requested_count == 2

    def test_reviews_requested_count_from_legacy_rows(self) -> None:
        # No PullRequestActivityLog row → routes to the legacy PullRequestActivity
        # rows instead of the doc.
        PullRequestActivity.objects.create(
            pull_request=self.pr,
            webhook_id="rr1",
            event_type=PullRequestActivityType.REVIEW_REQUESTED,
            payload={},
        )
        PullRequestActivity.objects.create(
            pull_request=self.pr,
            webhook_id="rr2",
            event_type=PullRequestActivityType.REVIEW_REQUESTED,
            payload={},
        )
        PullRequestActivity.objects.create(
            pull_request=self.pr,
            webhook_id="rr3",
            event_type=PullRequestActivityType.REVIEW_REQUEST_REMOVED,
            payload={},
        )
        assert review_activity(self.pr).requested_count == 1

    def test_review_results_from_doc(self) -> None:
        self._write_doc(
            _doc(
                events=[
                    _entry("review_submitted", "r1", review_state="approved"),
                    _entry("review_submitted", "r2", review_state="changes_requested"),
                ]
            )
        )
        assert review_activity(self.pr).results == {
            "approved": 1,
            "changes_requested": 1,
            "commented": 0,
        }

    def test_review_results_from_legacy_rows(self) -> None:
        # No PullRequestActivityLog row → routes to the legacy PullRequestActivity
        # rows instead of the doc.
        PullRequestActivity.objects.create(
            pull_request=self.pr,
            webhook_id="r1",
            event_type=PullRequestActivityType.REVIEW_SUBMITTED,
            payload={"review_state": "commented"},
        )
        assert review_activity(self.pr).results == {
            "approved": 0,
            "changes_requested": 0,
            "commented": 1,
        }

    # --- resolved_group_ids -----------------------------------------------

    def test_resolved_group_ids_from_doc_commit_chain(self) -> None:
        commit = self.create_commit(repo=self.repo, key=HEAD_SHA)
        group = self.create_group(project=self.project)
        GroupLink.objects.create(
            group_id=group.id,
            project_id=group.project_id,
            linked_type=GroupLink.LinkedType.commit,
            relationship=GroupLink.Relationship.resolves,
            linked_id=commit.id,
        )
        self._write_doc(
            _doc(
                events=[_entry("synchronized", "s1", before_sha="old", after_sha=HEAD_SHA)],
                sync_chain=[[HEAD_SHA, "old"]],
            )
        )
        assert resolved_group_ids(self.pr) == [group.id]

    # --- judge timeline forward -------------------------------------------

    def test_pr_activity_timeline_from_doc(self) -> None:
        self._write_doc(
            _doc(
                events=[_entry(PullRequestActivityType.OPENED, "o1", sender_login="a")],
                checks={
                    "sha1|github-actions": _group(
                        suite_conclusion="failure",
                        check_runs_count=2,
                        runs={
                            "test": {
                                "conclusion": "failure",
                                "completed_at": "2026-07-10T12:05:00Z",
                                "failed_attempts": 1,
                            }
                        },
                        first_failure_at="2026-07-10T12:05:00Z",
                        last_event_at="2026-07-10T12:06:00Z",
                    )
                },
            )
        )
        timeline, events_dropped = _pr_activity_timeline(self.pr)
        types = [event.event_type for event in timeline]
        assert "opened" in types
        assert "check_suite_completed" in types
        suite = next(e for e in timeline if e.event_type == "check_suite_completed")
        assert suite.payload["failing_check_names"] == ["test"]
        assert suite.payload["head_sha"] == "sha1"
        assert events_dropped == 0

    def test_pr_activity_timeline_forwards_dropped_count_from_doc(self) -> None:
        # A capped document is missing its newest events, so the judge has to be
        # told the timeline it receives is a truncated prefix.
        self._write_doc(
            _doc(
                events=[_entry(PullRequestActivityType.OPENED, "o1", sender_login="a")],
                events_dropped=7,
            )
        )
        timeline, events_dropped = _pr_activity_timeline(self.pr)
        assert [event.event_type for event in timeline] == ["opened"]
        assert events_dropped == 7

    def test_pr_activity_timeline_legacy_path_reports_not_truncated(self) -> None:
        # No document → legacy path forwards every lifecycle row it has, so the
        # count is a constant zero rather than an inference.
        PullRequestActivity.objects.create(
            pull_request=self.pr,
            webhook_id="o1",
            event_type=PullRequestActivityType.OPENED,
            payload={"sender_login": "dev"},
        )
        timeline, events_dropped = _pr_activity_timeline(self.pr)
        assert [event.event_type for event in timeline] == ["opened"]
        assert events_dropped == 0

    def test_judge_request_carries_dropped_count_from_doc(self) -> None:
        PullRequestMetrics.objects.create(pull_request=self.pr)
        self.repo.update(external_id="10270250", integration_id=99)
        self._write_doc(
            _doc(
                events=[_entry(PullRequestActivityType.OPENED, "o1", sender_login="a")],
                events_dropped=3,
            )
        )
        request = _build_judge_request(self.pr, self.repo)
        assert request.activity_events_dropped == 3
        assert [event.event_type for event in request.activity] == ["opened"]

    def test_judge_request_untruncated_doc_reports_zero(self) -> None:
        PullRequestMetrics.objects.create(pull_request=self.pr)
        self.repo.update(external_id="10270250", integration_id=99)
        self._write_doc(
            _doc(events=[_entry(PullRequestActivityType.OPENED, "o1", sender_login="a")])
        )
        request = _build_judge_request(self.pr, self.repo)
        assert request.activity_events_dropped == 0

    # --- post-emit sweep --------------------------------------------------

    def test_cleanup_deletes_document_and_rows(self) -> None:
        self._write_doc(_doc())
        PullRequestActivity.objects.create(
            pull_request=self.pr,
            webhook_id="w1",
            event_type=PullRequestActivityType.OPENED,
            payload={},
        )
        cleanup_pr_activity_task(pull_request_id=self.pr.id)
        assert not PullRequestActivityLog.objects.filter(pull_request=self.pr).exists()
        assert not PullRequestActivity.objects.filter(pull_request=self.pr).exists()

    # --- parity check (legacy path) ---------------------------------------

    @patch("sentry.pr_metrics.emit.metrics")
    def test_reducer_parity_matches_on_legacy_path(self, mock_metrics: Any) -> None:
        # No document → legacy path → the parity check folds the rows through the
        # reducer and confirms the pinned counters agree.
        PullRequestActivity.objects.create(
            pull_request=self.pr,
            webhook_id="s1",
            event_type=PullRequestActivityType.SYNCHRONIZED,
            payload={"sender_login": "dev", "sender_type": "User"},
        )
        PullRequestActivity.objects.create(
            pull_request=self.pr,
            webhook_id="r1",
            event_type=PullRequestActivityType.REVIEW_SUBMITTED,
            payload={"sender_login": "rev", "sender_type": "User"},
        )
        PullRequestActivity.objects.create(
            pull_request=self.pr,
            webhook_id="c1",
            event_type=PullRequestActivityType.COMMENT_CREATED,
            payload={"sender_login": "commenter", "sender_type": "User"},
        )
        _activity_derived_metrics(self.pr)
        mock_metrics.incr.assert_any_call("pr_metrics.reducer_parity.match")
