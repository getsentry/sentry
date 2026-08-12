"""Unit tests for the pure per-PR activity-document reducer.

No DB: every case builds a plain ``dict`` and folds events through
``apply_activity``, asserting the reduction laws directly.
"""

from __future__ import annotations

import copy
import itertools
from typing import Any, cast
from unittest.mock import patch

import pytest

from sentry.models.pullrequest import PullRequestActivityType
from sentry.pr_metrics.activity_doc import (
    DOC_VERSION,
    MAX_CHECK_GROUPS,
    MAX_EVENTS,
    MAX_FORWARDED_GROUPS_PER_HEAD,
    MAX_GROUPS_PER_HEAD,
    MAX_RUNS_PER_GROUP,
    MAX_SYNC_CHAIN,
    ActivityDoc,
    _fold_sync_chain,
    apply_activity,
    ci_head_outcomes_from_doc,
    ci_head_results_from_doc,
    classify_ci_head_actor,
    commit_shas_from_doc,
    derived_metrics_from_doc,
    extract_event_at,
    has_commits_after_open,
    human_participant_count,
    is_failing_conclusion,
    new_document,
    opening_head_from_doc,
    review_activity_from_doc,
    reviews_requested_count_from_doc,
    timeline_events_from_doc,
)
from sentry.utils import json

MODULE = "sentry.pr_metrics.activity_doc"


# --- small builders -------------------------------------------------------


def _entry(
    doc: ActivityDoc,
    *,
    event_type: PullRequestActivityType = PullRequestActivityType.SYNCHRONIZED,
    webhook_id: str = "d1",
    ts: str = "2026-07-10T12:00:00Z",
    event_at: str | None = None,
    **payload: Any,
) -> None:
    apply_activity(
        doc,
        event_type=event_type,
        payload=payload,
        ts=ts,
        event_at=event_at,
        webhook_id=webhook_id,
    )


def _comment(
    doc: ActivityDoc,
    *,
    event_type: PullRequestActivityType = PullRequestActivityType.COMMENT_CREATED,
    sender_login: str = "alice",
    sender_type: str = "User",
    webhook_id: str = "c1",
) -> None:
    apply_activity(
        doc,
        event_type=event_type,
        payload={"sender_login": sender_login, "sender_type": sender_type},
        ts="2026-07-10T12:00:00Z",
        webhook_id=webhook_id,
    )


def _suite(
    doc: ActivityDoc,
    *,
    conclusion: str = "success",
    head_sha: str = "sha1",
    app_slug: str = "github-actions",
    check_suite_id: int | None = 1,
    check_runs_count: int = 4,
    updated_at: str = "2026-07-10T12:00:00Z",
) -> None:
    payload: dict[str, Any] = {
        "conclusion": conclusion,
        "app_slug": app_slug,
        "check_runs_count": check_runs_count,
        "head_sha": head_sha,
    }
    if check_suite_id is not None:
        # Mirrors the write path: the suite id is only merged in when present.
        payload["check_suite_id"] = check_suite_id
    apply_activity(
        doc,
        event_type=PullRequestActivityType.CHECK_SUITE_COMPLETED,
        payload=payload,
        ts="2026-07-10T12:00:00Z",
        provider_ts=updated_at,
    )


def _run(
    doc: ActivityDoc,
    *,
    check_name: str = "test",
    conclusion: str = "failure",
    head_sha: str = "sha1",
    app_slug: str = "github-actions",
    check_suite_id: int | None = 1,
    completed_at: str = "2026-07-10T12:00:00Z",
) -> None:
    payload: dict[str, Any] = {
        "check_name": check_name,
        "conclusion": conclusion,
        "app_slug": app_slug,
        "head_sha": head_sha,
    }
    if check_suite_id is not None:
        payload["check_suite_id"] = check_suite_id
    apply_activity(
        doc,
        event_type=PullRequestActivityType.CHECK_RUN_COMPLETED,
        payload=payload,
        ts="2026-07-10T12:00:00Z",
        provider_ts=completed_at,
    )


def _group(
    doc: ActivityDoc,
    head_sha: str = "sha1",
    app_slug: str = "github-actions",
    check_suite_id: int | None = 1,
) -> Any:
    key = (
        f"{head_sha}|{app_slug}"
        if check_suite_id is None
        else f"{head_sha}|{app_slug}|{check_suite_id}"
    )
    return doc["checks"][key]


# --- document shape -------------------------------------------------------


def test_new_document_shape() -> None:
    assert new_document() == {
        "version": DOC_VERSION,
        "events": [],
        "checks": {},
        "participants": {},
        "counts": {},
        "events_dropped": 0,
        "sync_chain": [],
    }


# --- is_failing_conclusion vocabulary -------------------------------------


def test_failing_conclusion_vocabulary() -> None:
    for non_failing in ("success", "neutral", "skipped"):
        assert is_failing_conclusion(non_failing) is False
    for aborted in ("cancelled", "stale"):
        assert is_failing_conclusion(aborted) is False
    for failing in ("failure", "timed_out", "startup_failure", "action_required"):
        assert is_failing_conclusion(failing) is True
    # Empty / absent is not a failure (the check hasn't concluded).
    assert is_failing_conclusion("") is False
    assert is_failing_conclusion(None) is False


# --- extract_event_at rules -----------------------------------------------


def test_extract_event_at_rules() -> None:
    event = {
        "pull_request": {
            "created_at": "2026-07-10T10:00:00Z",
            "closed_at": "2026-07-10T11:00:00Z",
            "merged_at": "2026-07-10T11:30:00Z",
        },
        "review": {"submitted_at": "2026-07-10T10:30:00Z"},
    }
    assert extract_event_at(PullRequestActivityType.OPENED, event) == "2026-07-10T10:00:00Z"
    assert extract_event_at(PullRequestActivityType.CLOSED, event) == "2026-07-10T11:00:00Z"
    assert extract_event_at(PullRequestActivityType.MERGED, event) == "2026-07-10T11:30:00Z"
    assert (
        extract_event_at(PullRequestActivityType.REVIEW_SUBMITTED, event) == "2026-07-10T10:30:00Z"
    )
    # Every other type carries no event-scoped timestamp.
    for event_type in (
        PullRequestActivityType.SYNCHRONIZED,
        PullRequestActivityType.CONVERTED_TO_DRAFT,
        PullRequestActivityType.LABELED,
        PullRequestActivityType.REVIEW_DISMISSED,
    ):
        assert extract_event_at(event_type, event) is None


def test_extract_event_at_missing_fields_returns_none() -> None:
    assert extract_event_at(PullRequestActivityType.OPENED, {}) is None
    assert extract_event_at(PullRequestActivityType.CLOSED, {"pull_request": {}}) is None
    assert extract_event_at(PullRequestActivityType.REVIEW_SUBMITTED, {}) is None


# --- entries: append, count, participants, dedup --------------------------


def test_entry_appended_with_fields() -> None:
    doc = new_document()
    _entry(
        doc,
        event_type=PullRequestActivityType.OPENED,
        webhook_id="d1",
        ts="2026-07-10T12:00:03Z",
        event_at="2026-07-10T12:00:01Z",
        sender_login="alice",
        sender_type="User",
        head_sha="abc",
    )
    assert doc["events"] == [
        {
            "event_type": PullRequestActivityType.OPENED,
            "ts": "2026-07-10T12:00:03Z",
            "event_at": "2026-07-10T12:00:01Z",
            "webhook_id": "d1",
            "payload": {"sender_login": "alice", "sender_type": "User", "head_sha": "abc"},
        }
    ]
    assert doc["counts"] == {PullRequestActivityType.OPENED: 1}
    assert doc["participants"] == {"alice": "User"}


def test_entries_appended_in_arrival_order() -> None:
    doc = new_document()
    _entry(doc, event_type=PullRequestActivityType.OPENED, webhook_id="d1")
    _entry(doc, event_type=PullRequestActivityType.SYNCHRONIZED, webhook_id="d2")
    _entry(doc, event_type=PullRequestActivityType.SYNCHRONIZED, webhook_id="d3")
    assert [e["webhook_id"] for e in doc["events"]] == ["d1", "d2", "d3"]
    assert doc["counts"] == {
        PullRequestActivityType.OPENED: 1,
        PullRequestActivityType.SYNCHRONIZED: 2,
    }


def test_entry_redelivery_dedup_by_webhook_id() -> None:
    doc = new_document()
    _entry(doc, event_type=PullRequestActivityType.SYNCHRONIZED, webhook_id="d1", after_sha="a")
    # Same delivery id again: no second entry, no double count, no re-fold.
    _entry(doc, event_type=PullRequestActivityType.SYNCHRONIZED, webhook_id="d1", after_sha="a")
    assert len(doc["events"]) == 1
    assert doc["counts"] == {PullRequestActivityType.SYNCHRONIZED: 1}


def test_entry_reapplication_is_idempotent() -> None:
    doc = new_document()
    for _ in range(5):
        _entry(
            doc,
            event_type=PullRequestActivityType.REVIEW_SUBMITTED,
            webhook_id="r1",
            sender_login="rev",
            sender_type="User",
        )
    assert len(doc["events"]) == 1
    assert doc["counts"] == {PullRequestActivityType.REVIEW_SUBMITTED: 1}
    assert doc["participants"] == {"rev": "User"}


def test_entry_without_webhook_id_is_not_deduped() -> None:
    # The write path guarantees a delivery id for entries, but the reducer must not
    # crash / wrongly dedup when one is absent.
    doc = new_document()
    _entry(doc, event_type=PullRequestActivityType.LABELED, webhook_id="")
    _entry(doc, event_type=PullRequestActivityType.LABELED, webhook_id="")
    assert len(doc["events"]) == 2
    assert doc["counts"] == {PullRequestActivityType.LABELED: 2}


def test_stored_payload_is_copied() -> None:
    doc = new_document()
    payload = {"sender_login": "alice", "sender_type": "User"}
    apply_activity(
        doc,
        event_type=PullRequestActivityType.OPENED,
        payload=payload,
        ts="2026-07-10T12:00:00Z",
        webhook_id="d1",
    )
    payload["sender_login"] = "mutated"
    assert doc["events"][0]["payload"]["sender_login"] == "alice"


# --- events cap -----------------------------------------------------------


def test_events_cap_drops_and_counts_dropped() -> None:
    doc = new_document()
    with patch(f"{MODULE}.metrics") as mock_metrics, patch(f"{MODULE}.logger") as mock_logger:
        for i in range(MAX_EVENTS + 3):
            _entry(doc, event_type=PullRequestActivityType.SYNCHRONIZED, webhook_id=f"d{i}")
    assert len(doc["events"]) == MAX_EVENTS
    assert doc["events_dropped"] == 3
    # Counts increment before the cap, so the total is exact even past the cap.
    assert doc["counts"] == {PullRequestActivityType.SYNCHRONIZED: MAX_EVENTS + 3}
    mock_metrics.incr.assert_any_call("pr_metrics.activity_doc.events_capped")
    assert mock_logger.warning.call_count == 3


# --- sync_chain: commit-chain survival ------------------------------------


def test_synchronize_entry_populates_sync_chain() -> None:
    doc = new_document()
    _entry(
        doc,
        event_type=PullRequestActivityType.SYNCHRONIZED,
        webhook_id="d1",
        after_sha="head1",
        before_sha="base1",
    )
    assert doc["sync_chain"] == [["head1", "base1", None, None, "d1"]]


def test_open_entry_is_the_opening_head_and_folds_no_sync_link() -> None:
    doc = new_document()
    _entry(
        doc,
        event_type=PullRequestActivityType.OPENED,
        webhook_id="d1",
        head_sha="head1",
        sender_login="octocat",
        sender_type="User",
    )
    assert opening_head_from_doc(doc) == ("head1", "octocat", "User")
    assert doc["sync_chain"] == []


def test_sync_chain_dedupes_redelivery_but_retains_repeated_sha() -> None:
    doc = new_document()
    _entry(
        doc,
        event_type=PullRequestActivityType.SYNCHRONIZED,
        webhook_id="d1",
        after_sha="head1",
        before_sha="base1",
    )
    # Redelivery (same webhook_id) is dropped at the entry dedup, before the fold.
    _entry(
        doc,
        event_type=PullRequestActivityType.SYNCHRONIZED,
        webhook_id="d1",
        after_sha="head1",
        before_sha="base1",
    )
    # A distinct delivery re-reporting the same after_sha remains an observation.
    _entry(
        doc,
        event_type=PullRequestActivityType.SYNCHRONIZED,
        webhook_id="d2",
        after_sha="head1",
        before_sha="base1",
    )
    assert doc["sync_chain"] == [
        ["head1", "base1", None, None, "d1"],
        ["head1", "base1", None, None, "d2"],
    ]


def test_sync_chain_dedupes_redelivery_past_the_events_cap() -> None:
    # Past the events cap no entry — and so no webhook_id — is retained, leaving the
    # entry-level dedup blind. The chain outlives the cap, so it must not: a
    # redelivered synchronize is one push, not two head observations.
    doc = new_document()
    with patch(f"{MODULE}.metrics"), patch(f"{MODULE}.logger"):
        for i in range(MAX_EVENTS):
            _entry(doc, event_type=PullRequestActivityType.LABELED, webhook_id=f"d{i}")
        for _ in range(2):
            _entry(
                doc,
                event_type=PullRequestActivityType.SYNCHRONIZED,
                webhook_id="sync-redelivered",
                after_sha="head-final",
                before_sha="base-final",
            )

    assert doc["sync_chain"] == [["head-final", "base-final", None, None, "sync-redelivered"]]


def test_synchronize_past_events_cap_still_folds_sync_chain() -> None:
    # The bug this fixes: at the events cap the newest synchronize entry is dropped,
    # but a head-anchored chain walk needs exactly that newest link. The link must
    # survive in sync_chain even though the entry itself does not.
    doc = new_document()
    with patch(f"{MODULE}.metrics"), patch(f"{MODULE}.logger"):
        for i in range(MAX_EVENTS):
            _entry(doc, event_type=PullRequestActivityType.LABELED, webhook_id=f"d{i}")
        assert len(doc["events"]) == MAX_EVENTS
        _entry(
            doc,
            event_type=PullRequestActivityType.SYNCHRONIZED,
            webhook_id="sync-final",
            after_sha="head-final",
            before_sha="base-final",
        )
    # The synchronize entry itself was dropped by the events cap...
    assert doc["events_dropped"] == 1
    assert len(doc["events"]) == MAX_EVENTS
    # ...but its before/after link survived for the chain walk.
    assert doc["sync_chain"] == [["head-final", "base-final", None, None, "sync-final"]]


def test_sync_chain_evicts_oldest_past_cap() -> None:
    doc = new_document()
    # Seed the chain full directly (cheaper than folding MAX_SYNC_CHAIN entries
    # through the events cap); after_shas are distinct and in arrival order.
    doc["sync_chain"] = [
        [f"sha{i:04d}", f"sha{i - 1:04d}" if i else None] for i in range(MAX_SYNC_CHAIN)
    ]
    with patch(f"{MODULE}.metrics") as mock_metrics, patch(f"{MODULE}.logger") as mock_logger:
        _fold_sync_chain(
            doc, {"after_sha": "sha-new", "before_sha": "sha-prev"}, webhook_id="d-new"
        )
    chain = doc["sync_chain"]
    assert len(chain) == MAX_SYNC_CHAIN  # stays at the cap
    assert ["sha0000", None] not in chain  # oldest synchronize link evicted
    # newest link retained
    assert chain[-1] == ["sha-new", "sha-prev", None, None, "d-new"]
    mock_metrics.incr.assert_any_call("pr_metrics.activity_doc.sync_chain_capped")
    assert mock_logger.warning.call_count == 1


def test_sync_chain_ignores_blank_or_missing_after_sha() -> None:
    doc = new_document()
    # Missing after_sha entirely...
    _entry(
        doc,
        event_type=PullRequestActivityType.SYNCHRONIZED,
        webhook_id="d1",
        before_sha="base1",
    )
    # ...and an explicitly blank after_sha both contribute nothing.
    _entry(
        doc,
        event_type=PullRequestActivityType.SYNCHRONIZED,
        webhook_id="d2",
        after_sha="",
    )
    assert doc["sync_chain"] == []


def test_synchronize_folds_into_pre_sync_chain_document() -> None:
    # A stored document written by a build predating sync_chain lacks the key
    # (rolling deploy); folding a synchronize must create it in place, not KeyError.
    legacy: dict[str, Any] = {k: v for k, v in new_document().items() if k != "sync_chain"}
    doc = cast(ActivityDoc, legacy)
    _entry(
        doc,
        event_type=PullRequestActivityType.SYNCHRONIZED,
        webhook_id="d1",
        after_sha="head1",
        before_sha="base1",
    )
    assert doc["sync_chain"] == [["head1", "base1", None, None, "d1"]]


# --- comments: participants only ------------------------------------------


def test_comment_folds_participant_only() -> None:
    doc = new_document()
    _comment(doc, sender_login="alice", sender_type="User")
    assert doc["participants"] == {"alice": "User"}
    assert doc["events"] == []
    assert doc["counts"] == {}


def test_comment_redelivery_and_multiple_senders() -> None:
    doc = new_document()
    _comment(doc, sender_login="alice", sender_type="User", webhook_id="c1")
    _comment(doc, sender_login="alice", sender_type="User", webhook_id="c1")  # redelivery
    _comment(doc, sender_login="bot[bot]", sender_type="Bot", webhook_id="c2")
    assert doc["participants"] == {"alice": "User", "bot[bot]": "Bot"}
    assert doc["events"] == []
    assert doc["counts"] == {}


def test_comment_edited_is_participant_only() -> None:
    doc = new_document()
    _comment(doc, event_type=PullRequestActivityType.COMMENT_EDITED, sender_login="bob")
    assert doc["participants"] == {"bob": "User"}
    assert doc["events"] == []
    assert doc["counts"] == {}


def test_blank_sender_login_not_folded() -> None:
    doc = new_document()
    _comment(doc, sender_login="", sender_type="User")
    _entry(doc, event_type=PullRequestActivityType.ENQUEUED, webhook_id="d1")  # no sender fields
    assert doc["participants"] == {}


# --- checks: single failing run -------------------------------------------


def test_single_failing_run_creates_group_and_entry() -> None:
    doc = new_document()
    _run(doc, check_name="test (3.11)", conclusion="failure", completed_at="2026-07-10T12:00:00Z")
    group = _group(doc)
    assert group["head_sha"] == "sha1"
    assert group["app_slug"] == "github-actions"
    assert group["check_suite_id"] == 1
    assert group["runs"] == {
        "test (3.11)": {
            "conclusion": "failure",
            "completed_at": "2026-07-10T12:00:00Z",
            "failed_attempts": 1,
        }
    }
    assert group["first_failure_at"] == "2026-07-10T12:00:00Z"
    assert group["last_event_at"] == "2026-07-10T12:00:00Z"
    assert group["suite_conclusion"] is None


def test_non_failing_run_for_never_failed_check_not_tracked() -> None:
    doc = new_document()
    _run(doc, check_name="lint", conclusion="success")
    group = _group(doc)
    assert group["runs"] == {}
    assert group["first_failure_at"] is None
    # The group still exists (last_event_at advanced) so suite state can attach.
    assert group["last_event_at"] == "2026-07-10T12:00:00Z"


# --- checks: fail -> rerun-green at same SHA ------------------------------


def test_fail_then_rerun_green_keeps_entry_with_failed_attempts() -> None:
    doc = new_document()
    _run(doc, check_name="test", conclusion="failure", completed_at="2026-07-10T12:00:00Z")
    _run(doc, check_name="test", conclusion="success", completed_at="2026-07-10T12:05:00Z")
    entry = _group(doc)["runs"]["test"]
    # Green re-run updates in place (does not delete); latest completed_at wins.
    assert entry["conclusion"] == "success"
    assert entry["completed_at"] == "2026-07-10T12:05:00Z"
    # The failure history survives.
    assert entry["failed_attempts"] == 1
    # first_failure_at is never cleared by a later green.
    assert _group(doc)["first_failure_at"] == "2026-07-10T12:00:00Z"


def test_failed_attempts_increments_on_each_failing_event() -> None:
    doc = new_document()
    _run(doc, check_name="test", conclusion="failure", completed_at="2026-07-10T12:00:00Z")
    _run(doc, check_name="test", conclusion="failure", completed_at="2026-07-10T12:01:00Z")
    _run(doc, check_name="test", conclusion="failure", completed_at="2026-07-10T12:02:00Z")
    entry = _group(doc)["runs"]["test"]
    assert entry["failed_attempts"] == 3
    assert entry["completed_at"] == "2026-07-10T12:02:00Z"
    assert _group(doc)["first_failure_at"] == "2026-07-10T12:00:00Z"


def test_redelivered_fail_after_green_stays_recovered() -> None:
    # The convergence the ever-failed map guarantees: once a fail→rerun-green has
    # been recorded (in arrival order), a REDELIVERED older failure must not
    # resurrect the failing status — latest-by-completed_at wins. Only the
    # (accepted) failed_attempts magnitude drifts.
    doc = new_document()
    _run(doc, check_name="test", conclusion="failure", completed_at="2026-07-10T12:00:00Z")
    _run(doc, check_name="test", conclusion="success", completed_at="2026-07-10T12:05:00Z")
    _run(
        doc, check_name="test", conclusion="failure", completed_at="2026-07-10T12:00:00Z"
    )  # redelivery
    entry = _group(doc)["runs"]["test"]
    assert entry["conclusion"] == "success"
    assert entry["completed_at"] == "2026-07-10T12:05:00Z"
    assert entry["failed_attempts"] == 2  # accepted magnitude drift on redelivery


def test_green_before_fail_inversion_is_accepted_limitation() -> None:
    # Known, accepted limitation of failed-only storage: when a green re-run's
    # webhook is delivered BEFORE the earlier failure it supersedes (a true
    # cross-completion delivery inversion for one check name), the green — for a
    # not-yet-failed name — is discarded, so the entry the later-arriving failure
    # creates reads failing even though the newer completion passed. This is the
    # same accepted-rarity class as the failed_attempts double-count on redelivery;
    # avoiding it would require retaining passing runs, which this design omits.
    doc = new_document()
    _run(doc, check_name="test", conclusion="success", completed_at="2026-07-10T12:05:00Z")
    _run(doc, check_name="test", conclusion="failure", completed_at="2026-07-10T12:00:00Z")
    entry = _group(doc)["runs"]["test"]
    assert entry["conclusion"] == "failure"
    assert entry["failed_attempts"] == 1


# --- checks: suite reduction ----------------------------------------------


def test_suite_latest_wins_and_counts_max() -> None:
    doc = new_document()
    _suite(doc, conclusion="failure", check_runs_count=10, updated_at="2026-07-10T12:00:00Z")
    _suite(doc, conclusion="success", check_runs_count=4, updated_at="2026-07-10T12:05:00Z")
    group = _group(doc)
    assert group["suite_conclusion"] == "success"  # latest updated_at wins
    assert group["check_runs_count"] == 10  # max seen
    assert group["last_event_at"] == "2026-07-10T12:05:00Z"


def test_suite_older_event_does_not_override() -> None:
    doc = new_document()
    _suite(doc, conclusion="success", updated_at="2026-07-10T12:05:00Z")
    _suite(doc, conclusion="failure", updated_at="2026-07-10T12:00:00Z")  # older
    assert _group(doc)["suite_conclusion"] == "success"


def test_failing_suite_sets_first_failure_at() -> None:
    doc = new_document()
    _suite(doc, conclusion="failure", updated_at="2026-07-10T12:00:00Z")
    assert _group(doc)["first_failure_at"] == "2026-07-10T12:00:00Z"


# --- checks: grouping keys -------------------------------------------------


def test_distinct_head_sha_app_slug_and_suite_are_distinct_groups() -> None:
    doc = new_document()
    _run(doc, head_sha="sha1", app_slug="github-actions", check_suite_id=1, check_name="t")
    _run(doc, head_sha="sha2", app_slug="github-actions", check_suite_id=2, check_name="t")
    _run(doc, head_sha="sha1", app_slug="circleci", check_suite_id=3, check_name="t")
    # One app raises one suite per workflow run, so a single head can carry
    # several suites from the same app — each is its own group.
    _run(doc, head_sha="sha1", app_slug="github-actions", check_suite_id=4, check_name="t")
    assert set(doc["checks"].keys()) == {
        "sha1|github-actions|1",
        "sha2|github-actions|2",
        "sha1|circleci|3",
        "sha1|github-actions|4",
    }


def test_suites_from_one_app_at_same_head_keep_their_conclusions() -> None:
    # The regression this fixes: one app emits one suite per workflow run, and
    # per-app grouping let the last suite to complete overwrite the others.
    doc = new_document()
    _suite(doc, check_suite_id=1, conclusion="failure", updated_at="2026-07-10T12:00:00Z")
    _suite(doc, check_suite_id=2, conclusion="success", updated_at="2026-07-10T12:05:00Z")
    assert _group(doc, check_suite_id=1)["suite_conclusion"] == "failure"
    assert _group(doc, check_suite_id=2)["suite_conclusion"] == "success"


def test_check_runs_count_kept_per_suite_not_max_across_workflows() -> None:
    doc = new_document()
    _suite(doc, check_suite_id=1, check_runs_count=10, updated_at="2026-07-10T12:00:00Z")
    _suite(doc, check_suite_id=2, check_runs_count=4, updated_at="2026-07-10T12:05:00Z")
    assert _group(doc, check_suite_id=1)["check_runs_count"] == 10
    assert _group(doc, check_suite_id=2)["check_runs_count"] == 4


def test_same_named_runs_in_different_suites_do_not_collide() -> None:
    # Two workflows can both have a job named "test". A green completion in one
    # suite must not read as a recovery of the other suite's failure.
    doc = new_document()
    _run(doc, check_suite_id=1, check_name="test", conclusion="failure")
    _run(doc, check_suite_id=2, check_name="test", conclusion="success")
    assert _group(doc, check_suite_id=1)["runs"]["test"]["conclusion"] == "failure"
    assert _group(doc, check_suite_id=2)["runs"] == {}  # never-failed runs aren't tracked


def test_event_without_suite_id_folds_into_legacy_key() -> None:
    # No suite id (pre-split documents, old processors during the rolling
    # deploy, or a payload lacking the id) → the suite-less legacy key.
    doc = new_document()
    _suite(doc, check_suite_id=None, conclusion="failure", updated_at="2026-07-10T12:00:00Z")
    assert set(doc["checks"].keys()) == {"sha1|github-actions"}
    assert _group(doc, check_suite_id=None)["check_suite_id"] is None
    _suite(doc, check_suite_id=None, conclusion="success", updated_at="2026-07-10T12:05:00Z")
    assert set(doc["checks"].keys()) == {"sha1|github-actions"}
    assert _group(doc, check_suite_id=None)["suite_conclusion"] == "success"


def test_suite_scoped_event_leaves_pre_split_group_untouched() -> None:
    # A pre-split document holds one merged group per (head_sha, app_slug) with
    # no check_suite_id key. Suite-scoped events must not fold into it — it
    # stays frozen beside the new per-suite groups.
    doc = new_document()
    legacy_group: Any = {
        "head_sha": "sha1",
        "app_slug": "github-actions",
        "suite_conclusion": "failure",
        "suite_updated_at": "2026-07-10T11:00:00Z",
        "check_runs_count": 3,
        "runs": {},
        "first_failure_at": "2026-07-10T11:00:00Z",
        "last_event_at": "2026-07-10T11:00:00Z",
    }
    doc["checks"]["sha1|github-actions"] = copy.deepcopy(legacy_group)
    _suite(doc, check_suite_id=7, conclusion="success", updated_at="2026-07-10T12:00:00Z")
    assert doc["checks"]["sha1|github-actions"] == legacy_group
    assert _group(doc, check_suite_id=7)["suite_conclusion"] == "success"


def test_timeline_forwards_both_merged_and_suite_groups_for_same_head() -> None:
    # The rolling-deploy state: id-less events fold into the merged group while
    # id-carrying events build per-suite groups beside it. Both reach the judge,
    # each with its own conclusion — the frozen failure is reported, not erased.
    doc = new_document()
    _suite(doc, check_suite_id=None, conclusion="failure", updated_at="2026-07-10T12:00:00Z")
    _suite(doc, check_suite_id=2, conclusion="success", updated_at="2026-07-10T12:05:00Z")

    events = timeline_events_from_doc(doc)
    assert [(e["payload"]["check_suite_id"], e["payload"]["conclusion"]) for e in events] == [
        (None, "failure"),
        (2, "success"),
    ]


# --- checks: idempotency & permutation convergence ------------------------


def test_reapplying_green_run_is_idempotent() -> None:
    doc = new_document()
    _run(doc, check_name="test", conclusion="failure", completed_at="2026-07-10T12:00:00Z")
    _run(doc, check_name="test", conclusion="success", completed_at="2026-07-10T12:05:00Z")
    snapshot = copy.deepcopy(doc["checks"])
    # Re-applying the same green event changes nothing (no counter on non-failing).
    _run(doc, check_name="test", conclusion="success", completed_at="2026-07-10T12:05:00Z")
    assert doc["checks"] == snapshot


def test_reapplying_failing_run_only_bumps_failed_attempts() -> None:
    doc = new_document()
    _run(doc, check_name="test", conclusion="failure", completed_at="2026-07-10T12:00:00Z")
    before = copy.deepcopy(doc["checks"])
    _run(doc, check_name="test", conclusion="failure", completed_at="2026-07-10T12:00:00Z")
    after = doc["checks"]
    # Everything is identical except the accepted failed_attempts magnitude drift.
    assert after["sha1|github-actions|1"]["runs"]["test"]["failed_attempts"] == 2
    before["sha1|github-actions|1"]["runs"]["test"]["failed_attempts"] = 2
    assert after == before


def test_check_events_converge_under_any_permutation() -> None:
    # The monotone fields (latest-wins conclusion, max count, min first_failure_at,
    # max last_event_at, count-based failed_attempts) are order-independent, so a
    # mix of suite + run events with distinct provider timestamps folds to the same
    # ``checks`` map in every arrival order. (The one creation-order-sensitive case
    # — a passing re-run delivered before the failure it supersedes for the same
    # name — is excluded here and covered by its own limitation test.)
    events: list[tuple[str, dict[str, Any]]] = [
        (
            "run",
            {"check_name": "a", "conclusion": "failure", "completed_at": "2026-07-10T12:00:00Z"},
        ),
        (
            "run",
            {"check_name": "b", "conclusion": "failure", "completed_at": "2026-07-10T12:02:00Z"},
        ),
        (
            "run",
            {"check_name": "b", "conclusion": "failure", "completed_at": "2026-07-10T12:03:00Z"},
        ),
        # A check that only ever passes is processed but never retained.
        (
            "run",
            {"check_name": "c", "conclusion": "success", "completed_at": "2026-07-10T12:04:00Z"},
        ),
        (
            "suite",
            {"conclusion": "failure", "check_runs_count": 8, "updated_at": "2026-07-10T12:01:00Z"},
        ),
        (
            "suite",
            {"conclusion": "success", "check_runs_count": 2, "updated_at": "2026-07-10T12:07:00Z"},
        ),
    ]

    def fold(order: list[tuple[str, dict[str, Any]]]) -> dict[str, Any]:
        doc = new_document()
        for kind, kw in order:
            if kind == "run":
                _run(doc, **kw)
            else:
                _suite(doc, **kw)
        return doc["checks"]

    baseline = fold(events)
    # Full permutations of 6 events is 720 — sample a deterministic spread instead.
    for order in list(itertools.permutations(events))[::37]:
        assert fold(list(order)) == baseline

    # Sanity on the converged values.
    group = baseline["sha1|github-actions|1"]
    assert group["suite_conclusion"] == "success"  # latest updated_at
    assert group["check_runs_count"] == 8  # max
    assert group["first_failure_at"] == "2026-07-10T12:00:00Z"  # min failing ts
    assert group["last_event_at"] == "2026-07-10T12:07:00Z"  # max ts
    assert group["runs"]["a"]["failed_attempts"] == 1
    assert group["runs"]["b"]["conclusion"] == "failure"  # still failing
    assert group["runs"]["b"]["failed_attempts"] == 2
    assert "c" not in group["runs"]  # passing-only check never retained


# --- checks: caps ----------------------------------------------------------


def test_check_group_cap_evicts_least_recent_group() -> None:
    doc = new_document()
    # Fill the cap with green CI suites on distinct SHAs, strictly increasing recency
    # (sha0000 the oldest).
    with patch(f"{MODULE}.metrics") as mock_metrics, patch(f"{MODULE}.logger") as mock_logger:
        for i in range(MAX_CHECK_GROUPS):
            _suite(
                doc,
                head_sha=f"sha{i:04d}",
                conclusion="success",
                updated_at=f"2026-07-10T12:{i // 60:02d}:{i % 60:02d}Z",
            )
        assert len(doc["checks"]) == MAX_CHECK_GROUPS
        assert mock_metrics.incr.call_count == 0  # filling exactly to the cap evicts nothing

        # A failing check on a brand-new head must still land: the judge cares about
        # the final head's CI state, so the cap evicts the stalest group, not this one.
        _run(
            doc,
            head_sha="sha-final",
            check_name="build",
            conclusion="failure",
            completed_at="2026-07-10T13:00:00Z",
        )

    assert len(doc["checks"]) == MAX_CHECK_GROUPS
    # The newcomer is present and carries the failure.
    assert doc["checks"]["sha-final|github-actions|1"]["runs"]["build"]["conclusion"] == "failure"
    # The least-recently-updated group was evicted; a newer green group survived.
    assert "sha0000|github-actions|1" not in doc["checks"]
    assert "sha0001|github-actions|1" in doc["checks"]
    mock_metrics.incr.assert_any_call("pr_metrics.activity_doc.check_groups_capped")
    assert mock_logger.warning.call_count == 1


def test_head_group_cap_evicts_within_the_head_only() -> None:
    doc = new_document()
    # A real (failing) group on an old head…
    _suite(
        doc,
        head_sha="sha-old",
        check_suite_id=999,
        conclusion="failure",
        updated_at="2026-07-10T11:00:00Z",
    )
    # …then a suite-spam loop (e.g. a workflow re-trigger bot) fills a newer head
    # to its cap, with strictly increasing recency (suite 0 the stalest).
    with patch(f"{MODULE}.metrics") as mock_metrics, patch(f"{MODULE}.logger") as mock_logger:
        for i in range(MAX_GROUPS_PER_HEAD):
            _suite(
                doc, head_sha="sha-spam", check_suite_id=i, updated_at=f"2026-07-10T12:{i:02d}:00Z"
            )
        assert mock_metrics.incr.call_count == 0  # filling exactly to the cap evicts nothing
        _suite(doc, head_sha="sha-spam", check_suite_id=1000, updated_at="2026-07-10T13:00:00Z")

    # The spam head evicted its own stalest suite to admit the newcomer…
    assert "sha-spam|github-actions|0" not in doc["checks"]
    assert _group(doc, head_sha="sha-spam", check_suite_id=1000) is not None
    spam_groups = [g for g in doc["checks"].values() if g["head_sha"] == "sha-spam"]
    assert len(spam_groups) == MAX_GROUPS_PER_HEAD
    # …and the other head — far staler than anything on the spam head — survived.
    assert _group(doc, head_sha="sha-old", check_suite_id=999)["suite_conclusion"] == "failure"
    mock_metrics.incr.assert_any_call("pr_metrics.activity_doc.check_head_groups_capped")
    assert mock_logger.warning.call_count == 1


def test_document_group_cap_never_evicts_a_recorded_failure() -> None:
    doc = new_document()
    # A failing suite on the oldest head — the natural LRU victim…
    _suite(
        doc,
        head_sha="sha-fail",
        check_suite_id=0,
        conclusion="failure",
        updated_at="2026-07-10T10:00:00Z",
    )
    with patch(f"{MODULE}.metrics"), patch(f"{MODULE}.logger"):
        for i in range(1, MAX_CHECK_GROUPS):
            _suite(
                doc,
                head_sha=f"sha{i:04d}",
                check_suite_id=i,
                updated_at=f"2026-07-10T12:{i // 60:02d}:{i % 60:02d}Z",
            )
        _suite(doc, head_sha="sha-final", check_suite_id=9999, updated_at="2026-07-10T13:00:00Z")
    # …yet the document-wide eviction takes the stalest green instead.
    assert "sha-fail|github-actions|0" in doc["checks"]
    assert "sha0001|github-actions|1" not in doc["checks"]
    assert _group(doc, head_sha="sha-final", check_suite_id=9999)["suite_conclusion"] == "success"


def test_head_group_cap_never_evicts_a_recorded_failure() -> None:
    doc = new_document()
    # The failure lands first, so it is the stalest group on the head…
    _run(
        doc,
        check_suite_id=0,
        check_name="unit",
        conclusion="failure",
        completed_at="2026-07-10T11:00:00Z",
    )
    with patch(f"{MODULE}.metrics"), patch(f"{MODULE}.logger"):
        for i in range(1, MAX_GROUPS_PER_HEAD):
            _suite(doc, check_suite_id=i, updated_at=f"2026-07-10T12:00:{i % 60:02d}Z")
        _suite(doc, check_suite_id=1000, updated_at="2026-07-10T13:00:00Z")
    # …yet the eviction takes the stalest green, not the failure.
    assert "sha1|github-actions|0" in doc["checks"]
    assert "sha1|github-actions|1" not in doc["checks"]
    assert _group(doc, check_suite_id=1000)["suite_conclusion"] == "success"


def test_existing_group_still_updates_after_group_cap() -> None:
    doc = new_document()
    for i in range(MAX_CHECK_GROUPS):
        _run(doc, head_sha=f"sha{i}", check_name="t", conclusion="failure")
    # A new event for an EXISTING group is not a new group — it must still apply.
    _run(doc, head_sha="sha0", check_name="t", conclusion="failure")
    assert doc["checks"]["sha0|github-actions|1"]["runs"]["t"]["failed_attempts"] == 2


def test_check_runs_per_group_cap_drops_new_failing_runs() -> None:
    doc = new_document()
    with patch(f"{MODULE}.metrics") as mock_metrics, patch(f"{MODULE}.logger") as mock_logger:
        for i in range(MAX_RUNS_PER_GROUP + 2):
            _run(doc, check_name=f"check-{i}", conclusion="failure")
    assert len(_group(doc)["runs"]) == MAX_RUNS_PER_GROUP
    mock_metrics.incr.assert_any_call("pr_metrics.activity_doc.check_runs_capped")
    assert mock_logger.warning.call_count == 2


def test_runs_cap_does_not_block_updates_to_existing_runs() -> None:
    doc = new_document()
    for i in range(MAX_RUNS_PER_GROUP):
        _run(doc, check_name=f"check-{i}", conclusion="failure")
    # Updating an existing run (green re-run) is not a new run — still applies.
    _run(doc, check_name="check-0", conclusion="success", completed_at="2026-07-10T13:00:00Z")
    assert _group(doc)["runs"]["check-0"]["conclusion"] == "success"


# --- mixed idempotency across families ------------------------------------


def test_full_sequence_reapplication_is_idempotent_except_failed_attempts() -> None:
    def build(double: bool) -> ActivityDoc:
        doc = new_document()
        sequence: list[Any] = [
            lambda d: _entry(
                d,
                event_type=PullRequestActivityType.OPENED,
                webhook_id="o1",
                sender_login="alice",
                sender_type="User",
            ),
            lambda d: _entry(
                d,
                event_type=PullRequestActivityType.SYNCHRONIZED,
                webhook_id="s1",
                sender_login="alice",
                sender_type="User",
            ),
            lambda d: _comment(d, sender_login="bob", webhook_id="c1"),
            lambda d: _run(
                d, check_name="test", conclusion="success", completed_at="2026-07-10T12:05:00Z"
            ),
        ]
        for step in sequence:
            step(doc)
            if double:
                step(doc)
        return doc

    once = build(double=False)
    twice = build(double=True)
    # Entries dedup, comments/participants union, green run is idempotent → equal.
    assert once == twice


# --- readers: pure projections --------------------------------------------


def _sync(doc: ActivityDoc, *, before: str, after: str, webhook_id: str) -> None:
    apply_activity(
        doc,
        event_type=PullRequestActivityType.SYNCHRONIZED,
        payload={
            "before_sha": before,
            "after_sha": after,
            "sender_login": "dev",
            "sender_type": "User",
        },
        ts="2026-07-10T12:00:00Z",
        webhook_id=webhook_id,
    )


def test_has_commits_after_open() -> None:
    doc = new_document()
    assert has_commits_after_open(doc) is False
    _entry(doc, event_type=PullRequestActivityType.SYNCHRONIZED, webhook_id="s1")
    assert has_commits_after_open(doc) is True


def test_human_participant_count_excludes_bots() -> None:
    doc = new_document()
    _comment(doc, sender_login="human", sender_type="User", webhook_id="c1")
    _comment(doc, sender_login="bot[bot]", sender_type="Bot", webhook_id="c2")
    assert human_participant_count(doc) == 1


def test_derived_metrics_from_doc_mirrors_legacy_shape() -> None:
    doc = new_document()
    _entry(
        doc,
        event_type=PullRequestActivityType.OPENED,
        webhook_id="o1",
        sender_login="octocat",
        sender_type="User",
    )
    _entry(
        doc,
        event_type=PullRequestActivityType.SYNCHRONIZED,
        webhook_id="s1",
        sender_login="seer",
        sender_type="Bot",
    )
    _entry(
        doc,
        event_type=PullRequestActivityType.REVIEW_SUBMITTED,
        webhook_id="r1",
        sender_login="rev",
        sender_type="User",
    )
    _entry(
        doc,
        event_type=PullRequestActivityType.REVIEW_SUBMITTED,
        webhook_id="r2",
        sender_login="botrev",
        sender_type="Bot",
    )
    _entry(
        doc,
        event_type=PullRequestActivityType.MERGED,
        webhook_id="m1",
        sender_login="octocat",
        sender_type="User",
    )
    _comment(doc, sender_login="commenter", sender_type="User", webhook_id="c1")

    metrics = derived_metrics_from_doc(doc)
    assert metrics == {
        "participants_count": 3,  # octocat, rev, commenter (seer + botrev are bots)
        "reviews_count": 2,
        "reviews_bot_count": 1,
        "reviews_human_count": 1,
        "pushes_bot_count": 1,  # the seer synchronize
        "pushes_human_count": 1,  # the octocat open
        "opened_by_bot": False,
        "closed_by_bot": False,
        "opened_and_closed_by_same_actor": True,  # octocat opened and merged
    }


def test_derived_metrics_empty_doc() -> None:
    assert derived_metrics_from_doc(new_document()) == {
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


def test_reviews_requested_count_from_doc_nets_removals() -> None:
    doc = new_document()
    doc["counts"] = {"review_requested": 3, "review_request_removed": 1}
    assert reviews_requested_count_from_doc(doc) == 2


def test_reviews_requested_count_from_doc_floors_at_zero() -> None:
    # More removals than requests can't be matched 1:1 (e.g. a second
    # reviewer's outstanding request), so the net never goes negative.
    doc = new_document()
    doc["counts"] = {"review_requested": 1, "review_request_removed": 3}
    assert reviews_requested_count_from_doc(doc) == 0


def test_reviews_requested_count_from_doc_empty() -> None:
    assert reviews_requested_count_from_doc(new_document()) == 0


def test_review_activity_from_doc_tallies_results() -> None:
    doc = new_document()
    _entry(
        doc,
        event_type=PullRequestActivityType.REVIEW_SUBMITTED,
        webhook_id="r1",
        review_state="approved",
    )
    _entry(
        doc,
        event_type=PullRequestActivityType.REVIEW_SUBMITTED,
        webhook_id="r2",
        review_state="approved",
    )
    _entry(
        doc,
        event_type=PullRequestActivityType.REVIEW_SUBMITTED,
        webhook_id="r3",
        review_state="commented",
    )
    assert review_activity_from_doc(doc) == {
        "requested_count": 0,
        "results": {"approved": 2, "changes_requested": 0, "commented": 1},
    }


def test_review_activity_from_doc_ignores_unrecognized_state() -> None:
    doc = new_document()
    # A review_dismissed row (or any future/unmapped state) contributes
    # nothing rather than erroring or padding an unexpected key.
    _entry(
        doc,
        event_type=PullRequestActivityType.REVIEW_SUBMITTED,
        webhook_id="r1",
        review_state="dismissed",
    )
    assert review_activity_from_doc(doc)["results"] == {
        "approved": 0,
        "changes_requested": 0,
        "commented": 0,
    }


def test_review_activity_from_doc_empty() -> None:
    assert review_activity_from_doc(new_document()) == {
        "requested_count": 0,
        "results": {"approved": 0, "changes_requested": 0, "commented": 0},
    }


def test_commit_shas_from_doc_normal_chain() -> None:
    doc = new_document()
    _sync(doc, before="B0", after="A1", webhook_id="s1")
    _sync(doc, before="A1", after="A2", webhook_id="s2")
    assert commit_shas_from_doc(doc, "A2") == {"A1", "A2"}


def test_commit_shas_from_doc_single_push() -> None:
    doc = new_document()
    _sync(doc, before="B0", after="A1", webhook_id="s1")
    assert commit_shas_from_doc(doc, "A1") == {"A1"}


def test_commit_shas_from_doc_force_push_excludes_abandoned() -> None:
    doc = new_document()
    _sync(doc, before="B0", after="A1", webhook_id="s1")
    _sync(doc, before="A1", after="A2", webhook_id="s2")
    _sync(doc, before="A2", after="A3", webhook_id="s3")
    _sync(doc, before="A1", after="F", webhook_id="s4")  # force-push back onto A1
    # Head is F; the chain follows F -> A1 -> B0, so A2/A3 are abandoned.
    assert commit_shas_from_doc(doc, "F") == {"F", "A1"}


def test_commit_shas_from_doc_force_push_back_onto_prior_head() -> None:
    # ``sync_chain`` keeps repeat head observations for the CI-heads reader, so A1 is
    # recorded twice as an ``after_sha``: once built on A0, once as the target of a
    # force push that abandons A2. Taking the later link would walk A1 -> A2 -> A1 and
    # both pull the abandoned A2 in and lose A0; the first link wins instead.
    doc = new_document()
    _sync(doc, before="B0", after="A0", webhook_id="s1")
    _sync(doc, before="A0", after="A1", webhook_id="s2")
    _sync(doc, before="A1", after="A2", webhook_id="s3")
    _sync(doc, before="A2", after="A1", webhook_id="s4")  # force-push back onto A1
    assert commit_shas_from_doc(doc, "A1") == {"A1", "A0"}


def test_commit_shas_from_doc_order_independent_no_false_force_push() -> None:
    # The bug fix: two synchronize deliveries stored out of order must NOT read as a
    # force push. The legacy reverse-arrival walker would drop A2 here; the
    # chain-follow reassembles the linked list correctly.
    doc = new_document()
    _sync(doc, before="A1", after="A2", webhook_id="s2")  # later push stored first
    _sync(doc, before="B0", after="A1", webhook_id="s1")
    assert commit_shas_from_doc(doc, "A2") == {"A1", "A2"}


def test_commit_shas_from_doc_no_syncs_or_unreachable_head() -> None:
    doc = new_document()
    assert commit_shas_from_doc(doc, "A1") == set()
    _sync(doc, before="B0", after="A1", webhook_id="s1")
    assert commit_shas_from_doc(doc, "unrelated") == set()


def test_commit_shas_from_doc_survives_events_cap() -> None:
    # The events cap drops the NEWEST entries, so a walker scanning ``events`` for
    # synchronizes loses the head once the latest sync is capped and returns nothing.
    # The walk follows ``sync_chain`` instead — fed by the reducer independently of the
    # entries cap — so the head stays reachable even when its synchronize entry was
    # dropped, and every commit-linked issue resolution on a cap-pressured PR survives.
    doc = new_document()
    with patch(f"{MODULE}.metrics"), patch(f"{MODULE}.logger"):
        for i in range(MAX_EVENTS):
            _entry(doc, event_type=PullRequestActivityType.LABELED, webhook_id=f"d{i}")
        _sync(doc, before="A0", after="A1", webhook_id="s1")
        _sync(doc, before="A1", after="A2", webhook_id="s2")
    # Both synchronize entries were dropped by the events cap...
    assert all(e["event_type"] != PullRequestActivityType.SYNCHRONIZED for e in doc["events"])
    assert doc["events_dropped"] == 2
    # ...but their before/after links survived in sync_chain, so the head chain-walks.
    assert commit_shas_from_doc(doc, "A2") == {"A1", "A2"}


def test_timeline_projects_entries_and_synthesized_suite() -> None:
    doc = new_document()
    _entry(
        doc,
        event_type=PullRequestActivityType.OPENED,
        webhook_id="o1",
        ts="2026-07-10T12:00:00Z",
        sender_login="a",
        sender_type="User",
    )
    _entry(
        doc,
        event_type=PullRequestActivityType.SYNCHRONIZED,
        webhook_id="s1",
        ts="2026-07-10T12:10:00Z",
    )
    _run(doc, check_name="test", conclusion="failure", completed_at="2026-07-10T12:05:00Z")
    _suite(doc, conclusion="failure", updated_at="2026-07-10T12:06:00Z")

    events = timeline_events_from_doc(doc)
    # Lifecycle entries + one synthesized check_suite, merged in timestamp order.
    assert [e["event_type"] for e in events] == ["opened", "check_suite_completed", "synchronized"]
    suite = events[1]
    assert suite["timestamp"] == "2026-07-10T12:06:00Z"  # group last_event_at
    assert suite["payload"]["conclusion"] == "failure"
    assert suite["payload"]["failing_check_names"] == ["test"]
    assert suite["payload"]["head_sha"] == "sha1"
    assert suite["payload"]["check_suite_id"] == 1
    assert suite["payload"]["first_failure_at"] == "2026-07-10T12:05:00Z"


def test_timeline_synthesizes_one_event_per_suite() -> None:
    # One synthesized completion per suite — GitHub's own cardinality — instead
    # of one per app carrying whichever suite finished last.
    doc = new_document()
    _run(doc, check_suite_id=1, check_name="test", conclusion="failure")
    _suite(doc, check_suite_id=1, conclusion="failure", updated_at="2026-07-10T12:01:00Z")
    _suite(doc, check_suite_id=2, conclusion="success", updated_at="2026-07-10T12:05:00Z")

    events = timeline_events_from_doc(doc)
    assert [
        (
            e["payload"]["check_suite_id"],
            e["payload"]["conclusion"],
            e["payload"]["failing_check_names"],
        )
        for e in events
    ] == [(1, "failure", ["test"]), (2, "success", [])]


def test_timeline_forward_trims_per_head_keeping_failures() -> None:
    doc = new_document()
    # A currently-failing suite and a fail→green recovery, both early (stalest)…
    _suite(doc, check_suite_id=0, conclusion="failure", updated_at="2026-07-10T11:00:00Z")
    _run(
        doc,
        check_suite_id=1,
        check_name="flaky",
        conclusion="failure",
        completed_at="2026-07-10T11:01:00Z",
    )
    _run(
        doc,
        check_suite_id=1,
        check_name="flaky",
        conclusion="success",
        completed_at="2026-07-10T11:02:00Z",
    )
    # …buried under a full trim window of fresher green suites.
    for i in range(2, MAX_FORWARDED_GROUPS_PER_HEAD + 2):
        _suite(doc, check_suite_id=i, updated_at=f"2026-07-10T12:00:{i:02d}Z")

    with patch(f"{MODULE}.metrics") as mock_metrics, patch(f"{MODULE}.logger") as mock_logger:
        events = timeline_events_from_doc(doc)

    ids = [e["payload"]["check_suite_id"] for e in events]
    assert len(ids) == MAX_FORWARDED_GROUPS_PER_HEAD
    # Both failure-bearing groups survive; the dropped ones are the stalest greens.
    assert 0 in ids and 1 in ids
    assert 2 not in ids and 3 not in ids
    mock_logger.warning.assert_called_once_with(
        "pr_metrics.activity_doc.forward_head_groups_capped",
        extra={"head_sha": "sha1", "dropped": 2},
    )
    mock_metrics.incr.assert_any_call("pr_metrics.activity_doc.forward_head_groups_capped")


def test_timeline_forward_keeps_every_head_represented() -> None:
    # Trimming is per head, so a quiet old head is never displaced by a busier,
    # fresher one — the flat-cap failure mode was dropping whole heads.
    doc = new_document()
    _suite(
        doc,
        head_sha="sha-old",
        check_suite_id=0,
        conclusion="failure",
        updated_at="2026-07-10T11:00:00Z",
    )
    for i in range(1, MAX_FORWARDED_GROUPS_PER_HEAD + 2):
        _suite(doc, head_sha="sha-new", check_suite_id=i, updated_at=f"2026-07-10T12:00:{i:02d}Z")

    with patch(f"{MODULE}.metrics"), patch(f"{MODULE}.logger"):
        events = timeline_events_from_doc(doc)

    heads = {e["payload"]["head_sha"] for e in events}
    assert heads == {"sha-old", "sha-new"}
    assert len(events) == 1 + MAX_FORWARDED_GROUPS_PER_HEAD


def test_timeline_suite_conclusion_derived_from_runs_when_absent() -> None:
    doc = new_document()
    _run(doc, check_name="test", conclusion="failure", completed_at="2026-07-10T12:05:00Z")
    events = timeline_events_from_doc(doc)
    assert events[0]["event_type"] == "check_suite_completed"
    assert events[0]["payload"]["conclusion"] == "failure"  # derived from the failing run


def test_cancelled_rerun_does_not_erase_a_failure() -> None:
    # A check fails, is rerun, and the rerun is cancelled. The cancellation reports
    # no verdict, so the failure stands — otherwise the check silently drops out of
    # failing_check_names while CI never said it passed.
    doc = new_document()
    _run(doc, check_name="unit", conclusion="failure", completed_at="2026-07-10T12:00:00Z")
    _run(doc, check_name="unit", conclusion="cancelled", completed_at="2026-07-10T12:05:00Z")

    assert _group(doc)["runs"]["unit"]["conclusion"] == "failure"
    assert timeline_events_from_doc(doc)[0]["payload"]["failing_check_names"] == ["unit"]


def test_cancelled_rerun_does_not_flip_a_failing_group_to_success() -> None:
    # The sharper consequence: with no suite event the group conclusion is derived
    # from the runs, so letting the cancellation win reported a green CI run that
    # never happened.
    doc = new_document()
    _run(doc, check_name="unit", conclusion="failure", completed_at="2026-07-10T12:00:00Z")
    _run(doc, check_name="unit", conclusion="cancelled", completed_at="2026-07-10T12:05:00Z")

    assert timeline_events_from_doc(doc)[0]["payload"]["conclusion"] == "failure"


def test_cancelled_suite_does_not_erase_a_failing_suite_conclusion() -> None:
    doc = new_document()
    _suite(doc, conclusion="failure", updated_at="2026-07-10T12:00:00Z")
    _suite(doc, conclusion="cancelled", updated_at="2026-07-10T12:05:00Z")

    assert _group(doc)["suite_conclusion"] == "failure"


def test_a_real_verdict_after_an_abort_still_wins() -> None:
    # The guard must not freeze the entry: a genuine green after the cancellation
    # is a verdict and supersedes the failure as usual.
    doc = new_document()
    _run(doc, check_name="unit", conclusion="failure", completed_at="2026-07-10T12:00:00Z")
    _run(doc, check_name="unit", conclusion="cancelled", completed_at="2026-07-10T12:05:00Z")
    _run(doc, check_name="unit", conclusion="success", completed_at="2026-07-10T12:10:00Z")

    assert _group(doc)["runs"]["unit"]["conclusion"] == "success"
    assert timeline_events_from_doc(doc)[0]["payload"]["failing_check_names"] == []


def test_abort_only_group_still_reads_as_aborted() -> None:
    # Nothing to erase, so the abort is recorded — a PR closed mid-CI must not
    # derive a pass out of a suite that only ever cancelled.
    doc = new_document()
    _suite(doc, conclusion="cancelled", updated_at="2026-07-10T12:00:00Z")

    assert _group(doc)["suite_conclusion"] == "cancelled"
    assert timeline_events_from_doc(doc)[0]["payload"]["conclusion"] == "cancelled"


def test_timeline_recovered_run_excluded_from_failing_names() -> None:
    doc = new_document()
    _run(doc, check_name="flaky", conclusion="failure", completed_at="2026-07-10T12:00:00Z")
    _run(doc, check_name="flaky", conclusion="success", completed_at="2026-07-10T12:05:00Z")
    suite = timeline_events_from_doc(doc)[0]
    # The run recovered (latest conclusion success), so it isn't a failing name.
    assert suite["payload"]["failing_check_names"] == []
    # …but the failure it recovered from still reaches the judge via check_runs,
    # which is the whole point: the group reads plain "success" otherwise, and the
    # flakiness is unrecoverable downstream.
    assert suite["payload"]["check_runs"] == {
        "flaky": {"conclusion": "success", "failed_attempts": 1}
    }


def test_timeline_check_runs_carries_failure_counts_alongside_failing_names() -> None:
    doc = new_document()
    # `broken` is a live failure; `flaky` failed twice and came back green.
    _run(doc, check_name="broken", conclusion="failure", completed_at="2026-07-10T12:00:00Z")
    _run(doc, check_name="flaky", conclusion="failure", completed_at="2026-07-10T12:01:00Z")
    _run(doc, check_name="flaky", conclusion="failure", completed_at="2026-07-10T12:02:00Z")
    _run(doc, check_name="flaky", conclusion="success", completed_at="2026-07-10T12:05:00Z")

    payload = timeline_events_from_doc(doc)[0]["payload"]

    assert payload["failing_check_names"] == ["broken"]
    assert payload["check_runs"] == {
        "broken": {"conclusion": "failure", "failed_attempts": 1},
        "flaky": {"conclusion": "success", "failed_attempts": 2},
    }


def test_timeline_check_runs_is_empty_when_nothing_ever_failed() -> None:
    # Only ever-failed checks are tracked, so an all-green group forwards no
    # recovery detail — the common case costs nothing on the wire.
    doc = new_document()
    _suite(doc, conclusion="success", updated_at="2026-07-10T12:06:00Z")

    assert timeline_events_from_doc(doc)[0]["payload"]["check_runs"] == {}


def test_ci_head_outcomes_empty_doc() -> None:
    assert ci_head_outcomes_from_doc(new_document()) == {}


def test_ci_head_outcomes_pass_through_github_conclusions() -> None:
    # Whatever the suite concluded is what the head reports — including the
    # conclusions that are neither a pass nor a failure, which a synthesized
    # verdict would have flattened into one indistinguishable value.
    doc = new_document()
    _suite(doc, head_sha="sha_fail", conclusion="failure")
    _suite(doc, head_sha="sha_pass", conclusion="success", app_slug="pass-app")
    _suite(doc, head_sha="sha_abort", conclusion="cancelled", app_slug="abort-app")
    _suite(doc, head_sha="sha_timeout", conclusion="timed_out", app_slug="timeout-app")
    _suite(doc, head_sha="sha_blocked", conclusion="action_required", app_slug="blocked-app")

    assert ci_head_outcomes_from_doc(doc) == {
        "sha_fail": "failure",
        "sha_pass": "success",
        "sha_abort": "cancelled",
        "sha_timeout": "timed_out",
        "sha_blocked": "action_required",
    }


def test_ci_head_outcomes_any_failing_suite_from_same_app_wins() -> None:
    doc = new_document()
    _suite(doc, check_suite_id=101, conclusion="failure")
    _suite(doc, check_suite_id=202, conclusion="success", updated_at="2026-07-10T12:01:00Z")

    assert set(doc["checks"]) == {
        "sha1|github-actions|101",
        "sha1|github-actions|202",
    }
    assert ci_head_outcomes_from_doc(doc) == {"sha1": "failure"}


def test_ci_suite_rerun_updates_same_suite() -> None:
    doc = new_document()
    _suite(doc, check_suite_id=101, conclusion="failure")
    _suite(
        doc,
        check_suite_id=101,
        conclusion="success",
        updated_at="2026-07-10T12:01:00Z",
    )

    assert len(doc["checks"]) == 1
    assert ci_head_outcomes_from_doc(doc) == {"sha1": "success"}


def test_check_run_joins_suite_before_out_of_order_suite_event() -> None:
    doc = new_document()
    _run(doc, check_suite_id=101, check_name="tests", conclusion="failure")
    _suite(
        doc,
        check_suite_id=101,
        conclusion="failure",
        updated_at="2026-07-10T12:01:00Z",
    )

    assert len(doc["checks"]) == 1
    assert doc["checks"]["sha1|github-actions|101"]["runs"]["tests"]["conclusion"] == "failure"


def test_suite_id_does_not_reattribute_legacy_group() -> None:
    doc = new_document()
    _suite(doc, check_suite_id=None, conclusion="failure")
    _suite(
        doc,
        check_suite_id=101,
        conclusion="success",
        updated_at="2026-07-10T12:01:00Z",
    )

    assert set(doc["checks"]) == {
        "sha1|github-actions",
        "sha1|github-actions|101",
    }
    assert ci_head_outcomes_from_doc(doc) == {"sha1": "failure"}


def test_legacy_suite_without_id_keeps_legacy_key() -> None:
    doc = new_document()
    _suite(doc, check_suite_id=None, conclusion="failure")

    assert set(doc["checks"]) == {"sha1|github-actions"}
    assert ci_head_outcomes_from_doc(doc) == {"sha1": "failure"}


def test_ci_head_outcomes_any_failing_app_wins() -> None:
    # Two apps on the same SHA: one green, one red → the head is failed.
    doc = new_document()
    _suite(doc, head_sha="sha1", app_slug="github-actions", conclusion="success")
    _suite(doc, head_sha="sha1", app_slug="codecov", conclusion="failure")

    assert ci_head_outcomes_from_doc(doc) == {"sha1": "failure"}


def test_ci_head_outcomes_derives_failure_from_runs_without_suite() -> None:
    doc = new_document()
    _run(doc, check_name="tests", conclusion="failure", head_sha="sha1")

    assert ci_head_outcomes_from_doc(doc) == {"sha1": "failure"}


def test_opening_head_is_read_from_the_open_entry_not_the_sync_chain() -> None:
    doc = new_document()
    _entry(
        doc,
        event_type=PullRequestActivityType.OPENED,
        webhook_id="o1",
        head_sha="open1",
        sender_login="alice",
        sender_type="User",
    )
    _entry(
        doc,
        event_type=PullRequestActivityType.SYNCHRONIZED,
        webhook_id="s1",
        after_sha="sync1",
        before_sha="open1",
        sender_login="sentry[bot]",
        sender_type="Bot",
    )

    assert opening_head_from_doc(doc) == ("open1", "alice", "User")
    assert doc["sync_chain"] == [["sync1", "open1", "sentry[bot]", "Bot", "s1"]]


def test_opening_head_is_not_inferred_from_the_first_sync_link() -> None:
    # No OPENED entry — activity tracking started after the PR opened, or the
    # entry was evicted. The first link's ``before_sha`` names the head that push
    # replaced, which is the opening head only if it was the first push after
    # open — precisely what a document missing its OPENED entry can't promise. So
    # the PR has no opening head, and the results list starts at the first push.
    doc = new_document()
    _entry(
        doc,
        event_type=PullRequestActivityType.SYNCHRONIZED,
        webhook_id="s1",
        after_sha="sync1",
        before_sha="open1",
        sender_login="dependabot[bot]",
        sender_type="Bot",
    )
    _entry(
        doc,
        event_type=PullRequestActivityType.SYNCHRONIZED,
        webhook_id="s2",
        after_sha="sync2",
        before_sha="sync1",
        sender_login="alice",
        sender_type="User",
    )

    assert opening_head_from_doc(doc) is None
    assert [(result["head_sha"], result["actor"]) for result in ci_head_results_from_doc(doc)] == [
        ("sync1", "bot"),
        ("sync2", "human"),
    ]


def test_opening_head_is_none_when_nothing_records_it() -> None:
    doc = new_document()
    _entry(doc, event_type=PullRequestActivityType.REVIEW_SUBMITTED, webhook_id="r1")
    _entry(
        doc,
        event_type=PullRequestActivityType.SYNCHRONIZED,
        webhook_id="s1",
        after_sha="sync1",
    )

    assert opening_head_from_doc(doc) is None
    assert [result["head_sha"] for result in ci_head_results_from_doc(doc)] == ["sync1"]


def test_ci_head_results_preserve_chain_order_repeats_and_missing_ci() -> None:
    doc = new_document()
    for event_type, webhook_id, payload in (
        (
            PullRequestActivityType.OPENED,
            "o1",
            {"head_sha": "a", "sender_login": "alice", "sender_type": "User"},
        ),
        (
            PullRequestActivityType.SYNCHRONIZED,
            "s1",
            {
                "after_sha": "b",
                "before_sha": "a",
                "sender_login": "sentry[bot]",
                "sender_type": "Bot",
            },
        ),
        (
            PullRequestActivityType.SYNCHRONIZED,
            "s2",
            {"after_sha": "a", "before_sha": "b", "sender_login": "bob", "sender_type": "User"},
        ),
    ):
        apply_activity(
            doc,
            event_type=event_type,
            payload=payload,
            ts="2026-07-10T12:00:00Z",
            webhook_id=webhook_id,
        )
    _suite(doc, head_sha="a", conclusion="failure")
    _suite(doc, head_sha="orphan", conclusion="success", app_slug="other")

    results = ci_head_results_from_doc(doc)
    assert [item["head_sha"] for item in results] == ["a", "b", "a", "orphan"]
    assert [item["sequence"] for item in results] == [0, 1, 2, None]
    assert results[0]["actor"] == "human"
    assert results[1]["has_ci"] is False
    assert results[1]["outcome"] == "unknown"
    assert results[1]["actor"] == "seer"
    assert results[2]["actor"] == "human"
    assert results[3]["actor"] == "unknown"


def test_ci_head_results_never_carry_the_pusher_identity() -> None:
    # These rows are JSON-encoded onto the analytics event and land in BigQuery, so
    # the raw GitHub login stays in the document and only ``actor`` is forwarded.
    doc = new_document()
    apply_activity(
        doc,
        event_type=PullRequestActivityType.OPENED,
        payload={"head_sha": "a", "sender_login": "alice", "sender_type": "User"},
        ts="2026-07-10T12:00:00Z",
        webhook_id="o1",
    )
    apply_activity(
        doc,
        event_type=PullRequestActivityType.SYNCHRONIZED,
        payload={
            "after_sha": "b",
            "before_sha": "a",
            "sender_login": "dependabot[bot]",
            "sender_type": "Bot",
        },
        ts="2026-07-10T12:05:00Z",
        webhook_id="s1",
    )

    results = ci_head_results_from_doc(doc)

    assert [item["actor"] for item in results] == ["human", "bot"]
    assert not any(key.startswith("sender_") for item in results for key in item)
    assert "alice" not in json.dumps(results)
    assert "dependabot[bot]" not in json.dumps(results)
    # ...but the document still holds it, since that is what classifies the head.
    assert opening_head_from_doc(doc) == ("a", "alice", "User")


def test_classify_ci_head_actor_copilot_is_bot_despite_user_sender_type() -> None:
    assert classify_ci_head_actor("Copilot", "User") == "bot"


def test_classify_ci_head_actor_rejects_a_typed_sender_with_no_login() -> None:
    # Both fields come off the same webhook ``sender``, so a head carries both or
    # neither: no login and no type is the ``unknown`` case, while a type with no
    # login is malformed input that would otherwise be bucketed as ``human``.
    assert classify_ci_head_actor("", "") == "unknown"
    with pytest.raises(AssertionError):
        classify_ci_head_actor("", "User")


def test_ci_head_outcomes_aborted_runs_without_suite_are_unknown() -> None:
    doc = new_document()
    _run(doc, check_name="tests", conclusion="cancelled", head_sha="sha1")
    assert ci_head_outcomes_from_doc(doc) == {"sha1": "unknown"}


def test_outcome_and_timeline_agree_on_the_same_group() -> None:
    # The two readers used to run different vocabularies over one group, so
    # action_required collapsed to a synthesized "inconclusive" in the outcome while
    # the timeline read it as a failure. Both now forward GitHub's own string, so a
    # group GitHub concluded reads identically either way.
    doc = new_document()
    _suite(doc, conclusion="action_required")

    assert ci_head_outcomes_from_doc(doc) == {"sha1": "action_required"}
    assert timeline_events_from_doc(doc)[0]["payload"]["conclusion"] == "action_required"


def test_ci_head_outcomes_suite_conclusion_wins_over_runs() -> None:
    # The suite is GitHub's own aggregate over these runs, so it is reported as
    # given rather than second-guessed from the runs underneath it — in either
    # direction. The failing run is still carried to the judge in the timeline
    # payload's `failing_check_names`/`check_runs`.
    doc = new_document()
    _run(doc, check_name="tests", conclusion="failure")
    _suite(doc, conclusion="cancelled", updated_at="2026-07-10T12:01:00Z")

    assert ci_head_outcomes_from_doc(doc) == {"sha1": "cancelled"}
    assert timeline_events_from_doc(doc)[0]["payload"]["failing_check_names"] == ["tests"]


def test_recovered_runs_without_suite_are_unknown_to_both_readers() -> None:
    # Deriving from runs can only ever prove a failure: `runs` tracks nothing but
    # the checks that once failed, so a recovered one says nothing about the checks
    # in the suite that were never tracked at all. That is an absent conclusion,
    # not a pass — and the judge timeline says so too, since it describes the very
    # same group as the per-head outcome and must not report it green.
    doc = new_document()
    _run(doc, check_name="flaky", conclusion="failure")
    _run(doc, check_name="flaky", conclusion="success", completed_at="2026-07-10T12:01:00Z")

    assert ci_head_outcomes_from_doc(doc) == {"sha1": "unknown"}
    assert timeline_events_from_doc(doc)[0]["payload"]["conclusion"] == "unknown"


def test_ci_head_outcomes_verdict_suite_outranks_aborted_suite() -> None:
    # Two apps on one head: one was called off, the other actually decided. The
    # decision is the head's conclusion — an abort reports nothing to collapse to.
    doc = new_document()
    _suite(doc, app_slug="abort-app", conclusion="cancelled")
    _suite(doc, app_slug="pass-app", conclusion="success")

    assert ci_head_outcomes_from_doc(doc) == {"sha1": "success"}


def test_ci_head_outcomes_failing_suite_outranks_both() -> None:
    # ...and a failure outranks the pass, keeping any-failure-wins at the head.
    doc = new_document()
    _suite(doc, app_slug="abort-app", conclusion="cancelled")
    _suite(doc, app_slug="pass-app", conclusion="success")
    _suite(doc, app_slug="fail-app", conclusion="timed_out")

    assert ci_head_outcomes_from_doc(doc) == {"sha1": "timed_out"}


def test_ci_head_outcomes_latest_failure_wins_within_its_class() -> None:
    # Two apps failed differently. Both are failures, so neither outranks the other
    # by class and the later completion speaks — the same tie-break Seer's
    # `_combine_suite_conclusions` applies, so the head reads identically on both
    # sides. Document order is the reverse of completion order here, so a
    # first-seen-wins collapse would answer "failure".
    doc = new_document()
    _suite(doc, app_slug="slow-app", conclusion="timed_out", updated_at="2026-07-10T12:05:00Z")
    _suite(doc, app_slug="fail-app", conclusion="failure", updated_at="2026-07-10T12:01:00Z")

    assert ci_head_outcomes_from_doc(doc) == {"sha1": "timed_out"}


def test_ci_head_outcomes_order_reads_last_activity_not_the_suite_stamp() -> None:
    # "Latest" is the group's newest event of any kind, which is what Seer sorts its
    # suites by (`suite["ts"]`, a max over suite and run events): the slow app
    # concluded its suite first but kept reporting runs afterwards, so it is the
    # later of the two failures. Sorting on the suite stamp alone would answer
    # "failure" here.
    doc = new_document()
    _suite(doc, app_slug="fast-app", conclusion="failure", updated_at="2026-07-10T12:05:00Z")
    _suite(doc, app_slug="slow-app", conclusion="timed_out", updated_at="2026-07-10T12:01:00Z")
    _run(
        doc,
        app_slug="slow-app",
        check_name="tests",
        conclusion="failure",
        completed_at="2026-07-10T12:10:00Z",
    )

    assert ci_head_outcomes_from_doc(doc) == {"sha1": "timed_out"}
