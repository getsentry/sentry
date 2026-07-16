"""Write-path + routing tests for the reduced activity document (CORE-283 PR 2).

These exercise the ``pr_metrics.activity_document.enabled`` cutover: with the
option off every webhook keeps writing legacy ``PullRequestActivity`` rows
(covered by ``test_webhooks.py``); with it on, activity folds into the per-PR
``PullRequestActivityLog`` document per the routing rules.
"""

from __future__ import annotations

from typing import Any
from unittest.mock import patch

import pytest

from sentry.integrations.github.webhook_types import GithubWebhookType
from sentry.models.pullrequest import (
    PullRequestActivity,
    PullRequestActivityLog,
    PullRequestActivityType,
)
from sentry.pr_metrics.webhooks import (
    handle_activity,
    handle_check_run,
    handle_check_suite,
    handle_comment,
    handle_review,
    handle_review_comment,
    handle_review_thread,
)
from sentry.testutils.cases import TestCase
from sentry.testutils.helpers import override_options, with_feature
from sentry.testutils.silo import cell_silo_test

ACTIVITY_FLAG = "organizations:pr-metrics-activity"
DOC_ON = {"pr_metrics.activity_document.enabled": True}


@with_feature(ACTIVITY_FLAG)
@cell_silo_test
class ActivityDocumentWritePathTest(TestCase):
    def setUp(self) -> None:
        self.project = self.create_project(organization=self.organization)
        self.repo = self.create_repo(self.project, provider="integrations:github", external_id="99")
        self.pr = self.create_pull_request(
            repository_id=self.repo.id,
            organization_id=self.organization.id,
            key="42",
        )

    # --- builders ---------------------------------------------------------

    def _doc_or_none(self) -> dict[str, Any] | None:
        log = PullRequestActivityLog.objects.filter(pull_request=self.pr).first()
        return log.data if log else None

    def _doc(self) -> dict[str, Any]:
        doc = self._doc_or_none()
        assert doc is not None
        return doc

    def _rows(self) -> int:
        return PullRequestActivity.objects.filter(pull_request=self.pr).count()

    def _pull_request_payload(self, **overrides: Any) -> dict[str, Any]:
        payload: dict[str, Any] = {
            "number": 42,
            "created_at": "2026-07-10T10:00:00Z",
            "closed_at": None,
            "merged_at": None,
            "merged": False,
            "merged_by": None,
            "head": {"sha": "headsha1"},
            "base": {"sha": "basesha1"},
            "additions": 10,
            "deletions": 5,
            "changed_files": 3,
            "commits": 2,
            "user": {"id": 999, "login": "author"},
        }
        payload.update(overrides)
        return payload

    def _activity(
        self,
        *,
        action: str = "opened",
        webhook_id: str = "d1",
        sender: dict[str, Any] | None = None,
        pull_request: dict[str, Any] | None = None,
        **event_extra: Any,
    ) -> None:
        event: dict[str, Any] = {
            "action": action,
            "pull_request": pull_request or self._pull_request_payload(),
            "sender": sender or {"id": 999, "login": "author", "type": "User"},
            **event_extra,
        }
        handle_activity(
            github_event=GithubWebhookType.PULL_REQUEST,
            event=event,
            organization=self.organization,
            repo=self.repo,
            github_delivery_id=webhook_id,
        )

    def _comment(self, *, webhook_id: str = "c1", sender_login: str = "commenter") -> None:
        handle_comment(
            github_event=GithubWebhookType.ISSUE_COMMENT,
            event={
                "action": "created",
                "issue": {
                    "number": 42,
                    "created_at": "2026-07-10T10:00:00Z",
                    "title": "T",
                    "pull_request": {"url": "https://api.github.com/pulls/42"},
                },
                "comment": {"author_association": "MEMBER"},
                "sender": {"id": 7, "login": sender_login, "type": "User"},
            },
            organization=self.organization,
            repo=self.repo,
            github_delivery_id=webhook_id,
        )

    def _review_comment(self, *, webhook_id: str = "rc1", sender_login: str = "reviewer") -> None:
        handle_review_comment(
            github_event=GithubWebhookType.PULL_REQUEST_REVIEW_COMMENT,
            event={
                "action": "created",
                "pull_request": self._pull_request_payload(),
                "comment": {"author_association": "MEMBER", "pull_request_review_id": 5},
                "sender": {"id": 8, "login": sender_login, "type": "User"},
            },
            organization=self.organization,
            repo=self.repo,
            github_delivery_id=webhook_id,
        )

    def _review(self, *, webhook_id: str = "rv1", sender_login: str = "reviewer") -> None:
        handle_review(
            github_event=GithubWebhookType.PULL_REQUEST_REVIEW,
            event={
                "action": "submitted",
                "pull_request": self._pull_request_payload(),
                "review": {
                    "state": "approved",
                    "id": 111,
                    "submitted_at": "2026-07-10T12:34:56Z",
                },
                "sender": {"id": 8, "login": sender_login, "type": "User"},
            },
            organization=self.organization,
            repo=self.repo,
            github_delivery_id=webhook_id,
        )

    def _review_thread(self, *, webhook_id: str = "rt1") -> None:
        handle_review_thread(
            github_event=GithubWebhookType.PULL_REQUEST_REVIEW_THREAD,
            event={
                "action": "resolved",
                "pull_request": self._pull_request_payload(),
                "thread": {"node_id": "PRT_abc"},
                "sender": {"id": 8, "login": "reviewer", "type": "User"},
            },
            organization=self.organization,
            repo=self.repo,
            github_delivery_id=webhook_id,
        )

    def _check_suite(
        self,
        *,
        conclusion: str = "failure",
        updated_at: str = "2026-07-10T12:00:00Z",
        webhook_id: str = "cs1",
    ) -> None:
        handle_check_suite(
            github_event=GithubWebhookType.CHECK_SUITE,
            event={
                "action": "completed",
                "check_suite": {
                    "head_sha": "headsha1",
                    "conclusion": conclusion,
                    "app": {"slug": "github-actions"},
                    "latest_check_runs_count": 6,
                    "updated_at": updated_at,
                    "pull_requests": [{"number": 42, "base": {"repo": {"id": 99}}}],
                },
                "sender": {"id": 5, "login": "ci[bot]", "type": "Bot"},
            },
            organization=self.organization,
            repo=self.repo,
            github_delivery_id=webhook_id,
        )

    def _check_run(
        self,
        *,
        check_name: str = "test",
        conclusion: str = "failure",
        completed_at: str = "2026-07-10T12:00:00Z",
        webhook_id: str = "cr1",
    ) -> None:
        handle_check_run(
            github_event=GithubWebhookType.CHECK_RUN,
            event={
                "action": "completed",
                "check_run": {
                    "name": check_name,
                    "head_sha": "headsha1",
                    "conclusion": conclusion,
                    "app": {"slug": "github-actions"},
                    "completed_at": completed_at,
                    "pull_requests": [{"number": 42, "base": {"repo": {"id": 99}}}],
                },
                "sender": {"id": 5, "login": "ci[bot]", "type": "Bot"},
            },
            organization=self.organization,
            repo=self.repo,
            github_delivery_id=webhook_id,
        )

    # --- routing ----------------------------------------------------------

    def test_option_off_writes_legacy_row_only(self) -> None:
        self._activity(action="opened")
        assert self._doc_or_none() is None
        assert self._rows() == 1

    def test_option_on_fresh_pr_writes_document_only(self) -> None:
        with override_options(DOC_ON):
            self._activity(action="opened")
        assert self._rows() == 0
        doc = self._doc()
        assert doc is not None
        assert [e["event_type"] for e in doc["events"]] == [PullRequestActivityType.OPENED]

    def test_option_on_existing_legacy_rows_stay_on_legacy(self) -> None:
        # A PR that already has legacy rows keeps writing them (self-drains later).
        PullRequestActivity.objects.create(
            pull_request=self.pr,
            webhook_id="pre-existing",
            event_type=PullRequestActivityType.OPENED,
            payload={},
        )
        with override_options(DOC_ON):
            self._activity(action="synchronize", webhook_id="d2", before="a", after="b")
        assert self._doc_or_none() is None
        assert self._rows() == 2

    def test_option_on_existing_document_stays_on_document(self) -> None:
        PullRequestActivityLog.objects.create(
            pull_request=self.pr,
            data={
                "version": 1,
                "events": [],
                "checks": {},
                "participants": {},
                "counts": {},
                "events_dropped": 0,
            },
        )
        with override_options(DOC_ON):
            self._activity(action="synchronize", webhook_id="d2", before="a", after="b")
        assert self._rows() == 0
        doc = self._doc()
        assert doc is not None
        assert doc["counts"] == {PullRequestActivityType.SYNCHRONIZED: 1}

    def test_document_wins_when_both_stores_present(self) -> None:
        # Routing checks the document first: its presence wins even if legacy rows
        # also exist, so a PR never splits its writes once on the document.
        PullRequestActivity.objects.create(
            pull_request=self.pr,
            webhook_id="legacy",
            event_type=PullRequestActivityType.OPENED,
            payload={},
        )
        PullRequestActivityLog.objects.create(
            pull_request=self.pr,
            data={
                "version": 1,
                "events": [],
                "checks": {},
                "participants": {},
                "counts": {},
                "events_dropped": 0,
            },
        )
        with override_options(DOC_ON):
            self._activity(action="synchronize", webhook_id="d2", before="a", after="b")
        assert self._rows() == 1  # unchanged legacy row
        doc = self._doc()
        assert doc is not None
        assert len(doc["events"]) == 1  # the synchronize folded into the document

    def test_fold_failure_leaves_no_orphan_document_row(self) -> None:
        # The row creation and the fold share one transaction, so a fold that raises
        # rolls the creation back too — no empty {} row is left behind to route later
        # events onto an all-zeros document. (Matches the legacy row insert, which
        # also leaves nothing on failure.)
        with override_options(DOC_ON):
            with patch(
                "sentry.pr_metrics.webhooks.apply_activity", side_effect=RuntimeError("boom")
            ):
                with pytest.raises(RuntimeError):
                    self._activity(action="opened")
        assert not PullRequestActivityLog.objects.filter(pull_request=self.pr).exists()
        assert self._rows() == 0

    # --- entry writes -----------------------------------------------------

    def test_opened_entry_captures_payload_and_event_at(self) -> None:
        with override_options(DOC_ON):
            self._activity(action="opened", webhook_id="d1")
        entry = self._doc()["events"][0]
        assert entry["event_type"] == PullRequestActivityType.OPENED
        assert entry["webhook_id"] == "d1"
        assert entry["event_at"] == "2026-07-10T10:00:00Z"  # pull_request.created_at
        assert entry["payload"]["sender_login"] == "author"
        assert entry["payload"]["head_sha"] == "headsha1"
        # Structural-only posture preserved on the new path.
        assert "title" not in entry["payload"]
        assert "body" not in entry["payload"]

    def test_synchronize_entry_has_null_event_at(self) -> None:
        with override_options(DOC_ON):
            self._activity(action="synchronize", webhook_id="d1", before="old", after="new")
        entry = self._doc()["events"][0]
        assert entry["event_type"] == PullRequestActivityType.SYNCHRONIZED
        assert entry["event_at"] is None
        assert entry["payload"]["before_sha"] == "old"
        assert entry["payload"]["after_sha"] == "new"

    def test_closed_and_merged_event_at_from_pr_fields(self) -> None:
        with override_options(DOC_ON):
            self._activity(
                action="closed",
                webhook_id="close1",
                pull_request=self._pull_request_payload(
                    merged=True,
                    merged_at="2026-07-10T11:30:00Z",
                    closed_at="2026-07-10T11:30:00Z",
                    merged_by={"id": 999, "login": "author"},
                ),
            )
        entry = self._doc()["events"][0]
        assert entry["event_type"] == PullRequestActivityType.MERGED
        assert entry["event_at"] == "2026-07-10T11:30:00Z"  # merged_at

    def test_review_submitted_entry_uses_review_submitted_at(self) -> None:
        with override_options(DOC_ON):
            self._review(webhook_id="rv1")
        doc = self._doc()
        entry = doc["events"][0]
        assert entry["event_type"] == PullRequestActivityType.REVIEW_SUBMITTED
        assert entry["event_at"] == "2026-07-10T12:34:56Z"
        assert doc["counts"] == {PullRequestActivityType.REVIEW_SUBMITTED: 1}
        assert doc["participants"] == {"reviewer": "User"}

    def test_review_thread_entry_recorded(self) -> None:
        with override_options(DOC_ON):
            self._review_thread(webhook_id="rt1")
        entry = self._doc()["events"][0]
        assert entry["event_type"] == PullRequestActivityType.REVIEW_THREAD_RESOLVED

    def test_entry_redelivery_deduped_in_document(self) -> None:
        with override_options(DOC_ON):
            self._activity(action="synchronize", webhook_id="dup", before="a", after="b")
            self._activity(action="synchronize", webhook_id="dup", before="a", after="b")
        doc = self._doc()
        assert len(doc["events"]) == 1
        assert doc["counts"] == {PullRequestActivityType.SYNCHRONIZED: 1}

    # --- comment writes (participants only) -------------------------------

    def test_comment_folds_participant_only(self) -> None:
        with override_options(DOC_ON):
            self._comment(webhook_id="c1", sender_login="commenter")
        assert self._rows() == 0
        doc = self._doc()
        assert doc["participants"] == {"commenter": "User"}
        assert doc["events"] == []
        assert doc["counts"] == {}

    def test_review_comment_folds_participant_only(self) -> None:
        with override_options(DOC_ON):
            self._review_comment(webhook_id="rc1", sender_login="inline-reviewer")
        doc = self._doc()
        assert doc["participants"] == {"inline-reviewer": "User"}
        assert doc["events"] == []
        assert doc["counts"] == {}

    # --- check writes (rollup) --------------------------------------------

    def test_check_suite_folds_into_rollup(self) -> None:
        with override_options(DOC_ON):
            self._check_suite(conclusion="failure", updated_at="2026-07-10T12:00:00Z")
        assert self._rows() == 0
        doc = self._doc()
        assert len(doc["checks"]) == 1
        group = next(iter(doc["checks"].values()))
        assert group["suite_conclusion"] == "failure"
        assert group["check_runs_count"] == 6
        # Provider updated_at drives last_event_at / first_failure_at.
        assert group["last_event_at"] == "2026-07-10T12:00:00Z"
        assert group["first_failure_at"] == "2026-07-10T12:00:00Z"
        assert doc["events"] == []

    def test_check_run_failing_tracked_with_provider_completed_at(self) -> None:
        with override_options(DOC_ON):
            self._check_run(
                check_name="unit", conclusion="failure", completed_at="2026-07-10T12:05:00Z"
            )
        doc = self._doc()
        group = next(iter(doc["checks"].values()))
        assert group["runs"]["unit"] == {
            "conclusion": "failure",
            "completed_at": "2026-07-10T12:05:00Z",
            "failed_attempts": 1,
        }

    def test_check_run_green_not_retained(self) -> None:
        with override_options(DOC_ON):
            self._check_run(
                check_name="lint", conclusion="success", completed_at="2026-07-10T12:05:00Z"
            )
        group = next(iter(self._doc()["checks"].values()))
        assert group["runs"] == {}
