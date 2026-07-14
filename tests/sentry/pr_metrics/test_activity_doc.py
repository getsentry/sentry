"""Unit tests for the pure per-PR activity-document reducer.

No DB: every case builds a plain ``dict`` and folds events through
``apply_activity``, asserting the reduction laws directly.
"""

from __future__ import annotations

import copy
import itertools
from typing import Any
from unittest.mock import patch

from sentry.models.pullrequest import PullRequestActivityType
from sentry.pr_metrics.activity_doc import (
    DOC_VERSION,
    MAX_CHECK_GROUPS,
    MAX_EVENTS,
    MAX_RUNS_PER_GROUP,
    apply_activity,
    extract_event_at,
    is_failing_conclusion,
    new_document,
)

MODULE = "sentry.pr_metrics.activity_doc"


# --- small builders -------------------------------------------------------


def _entry(
    doc: dict[str, Any],
    *,
    event_type: str = PullRequestActivityType.SYNCHRONIZED,
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
    doc: dict[str, Any],
    *,
    event_type: str = PullRequestActivityType.COMMENT_CREATED,
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
    doc: dict[str, Any],
    *,
    conclusion: str = "success",
    head_sha: str = "sha1",
    app_slug: str = "github-actions",
    check_runs_count: int = 4,
    updated_at: str = "2026-07-10T12:00:00Z",
) -> None:
    apply_activity(
        doc,
        event_type=PullRequestActivityType.CHECK_SUITE_COMPLETED,
        payload={
            "conclusion": conclusion,
            "app_slug": app_slug,
            "check_runs_count": check_runs_count,
            "head_sha": head_sha,
        },
        ts="2026-07-10T12:00:00Z",
        provider_ts=updated_at,
    )


def _run(
    doc: dict[str, Any],
    *,
    check_name: str = "test",
    conclusion: str = "failure",
    head_sha: str = "sha1",
    app_slug: str = "github-actions",
    completed_at: str = "2026-07-10T12:00:00Z",
) -> None:
    apply_activity(
        doc,
        event_type=PullRequestActivityType.CHECK_RUN_COMPLETED,
        payload={
            "check_name": check_name,
            "conclusion": conclusion,
            "app_slug": app_slug,
            "head_sha": head_sha,
        },
        ts="2026-07-10T12:00:00Z",
        provider_ts=completed_at,
    )


def _group(doc: dict[str, Any], head_sha: str = "sha1", app_slug: str = "github-actions") -> Any:
    return doc["checks"][f"{head_sha}|{app_slug}"]


# --- document shape -------------------------------------------------------


def test_new_document_shape() -> None:
    assert new_document() == {
        "version": DOC_VERSION,
        "events": [],
        "checks": {},
        "participants": {},
        "counts": {},
        "events_dropped": 0,
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


def test_comment_deleted_and_edited_are_participant_only() -> None:
    doc = new_document()
    _comment(doc, event_type=PullRequestActivityType.COMMENT_DELETED, sender_login="alice")
    _comment(doc, event_type=PullRequestActivityType.COMMENT_EDITED, sender_login="bob")
    assert doc["participants"] == {"alice": "User", "bob": "User"}
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


def test_distinct_head_sha_and_app_slug_are_distinct_groups() -> None:
    doc = new_document()
    _run(doc, head_sha="sha1", app_slug="github-actions", check_name="t")
    _run(doc, head_sha="sha2", app_slug="github-actions", check_name="t")
    _run(doc, head_sha="sha1", app_slug="circleci", check_name="t")
    assert set(doc["checks"].keys()) == {
        "sha1|github-actions",
        "sha2|github-actions",
        "sha1|circleci",
    }


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
    assert after["sha1|github-actions"]["runs"]["test"]["failed_attempts"] == 2
    before["sha1|github-actions"]["runs"]["test"]["failed_attempts"] = 2
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
    group = baseline["sha1|github-actions"]
    assert group["suite_conclusion"] == "success"  # latest updated_at
    assert group["check_runs_count"] == 8  # max
    assert group["first_failure_at"] == "2026-07-10T12:00:00Z"  # min failing ts
    assert group["last_event_at"] == "2026-07-10T12:07:00Z"  # max ts
    assert group["runs"]["a"]["failed_attempts"] == 1
    assert group["runs"]["b"]["conclusion"] == "failure"  # still failing
    assert group["runs"]["b"]["failed_attempts"] == 2
    assert "c" not in group["runs"]  # passing-only check never retained


# --- checks: caps ----------------------------------------------------------


def test_check_group_cap_drops_new_groups() -> None:
    doc = new_document()
    with patch(f"{MODULE}.metrics") as mock_metrics, patch(f"{MODULE}.logger") as mock_logger:
        for i in range(MAX_CHECK_GROUPS + 2):
            _run(doc, head_sha=f"sha{i}", check_name="t", conclusion="failure")
    assert len(doc["checks"]) == MAX_CHECK_GROUPS
    mock_metrics.incr.assert_any_call("pr_metrics.activity_doc.check_groups_capped")
    assert mock_logger.warning.call_count == 2


def test_existing_group_still_updates_after_group_cap() -> None:
    doc = new_document()
    for i in range(MAX_CHECK_GROUPS):
        _run(doc, head_sha=f"sha{i}", check_name="t", conclusion="failure")
    # A new event for an EXISTING group is not a new group — it must still apply.
    _run(doc, head_sha="sha0", check_name="t", conclusion="failure")
    assert doc["checks"]["sha0|github-actions"]["runs"]["t"]["failed_attempts"] == 2


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
    def build(double: bool) -> dict[str, Any]:
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
