"""Pure reducer for the per-PR activity document.

One versioned JSONB document per PR, folded in place at webhook time, replacing
the per-event ``PullRequestActivity`` rows. There is no I/O here: every function
takes and mutates a plain ``dict``, so the reduction laws are trivially
unit-testable. The write path in ``webhooks.py`` extracts the provider fields
from each webhook and calls :func:`apply_activity`; the readers in
``emit``/``utils``/``judge`` project the document back into the counters and
timeline they used to derive from rows.

Three event families reduce differently:

- **entries** — low-volume lifecycle events (opened, synchronized, reviews,
  labels, the close itself, ...). Appended to ``events`` in arrival order, deduped
  by ``webhook_id`` containment, and counted once per delivery in ``counts``.
- **checks** — every ``check_run_completed`` / ``check_suite_completed`` collapses
  into a per-``(head_sha, app_slug)`` rollup. A pure monotone reducer: latest-wins
  on provider timestamps, ``min()`` for ``first_failure_at``, ``max()`` for counts,
  ``failed_attempts`` incremented only on failing conclusions. Redelivery- and
  reorder-safe without ``webhook_id`` dedup (a redelivered failing event double
  counts only the magnitude signal, which is accepted).
- **comments** — folded solely into the ``participants`` map; never stored as
  entries and never counted.
"""

from __future__ import annotations

import logging
from collections.abc import Mapping
from typing import Any

from sentry.models.pullrequest import PullRequestActivityType
from sentry.utils import metrics

logger = logging.getLogger(__name__)

DOC_VERSION = 1

# Entry-list cap. Lifecycle events are low-volume (checks and comments never land
# here), so 500 sits far above what a normal PR produces; reaching it is a
# pathology backstop, surfaced via ``events_dropped`` + a log/metric.
MAX_EVENTS = 500
# Check-rollup bounds: distinct ``(head_sha, app_slug)`` groups per PR, and
# ever-failing runs tracked per group. Both are pathology backstops.
MAX_CHECK_GROUPS = 100
MAX_RUNS_PER_GROUP = 50

# Conclusion vocabulary shared with Seer's ``timeline.py``: a clean pass, an
# aborted run that never reached a pass/fail verdict, and — everything else that
# is non-empty — a failure.
NON_FAILING_CONCLUSIONS = frozenset({"success", "neutral", "skipped"})
ABORTED_CONCLUSIONS = frozenset({"cancelled", "stale"})

# Comment webhooks fold into ``participants`` only — no entry, no count.
_COMMENT_EVENT_TYPES = frozenset(
    {
        PullRequestActivityType.COMMENT_CREATED,
        PullRequestActivityType.COMMENT_EDITED,
        PullRequestActivityType.COMMENT_DELETED,
    }
)


def is_failing_conclusion(conclusion: str | None) -> bool:
    """Whether a check conclusion counts as a failure.

    An empty/absent conclusion (a check that hasn't concluded) is not a failure;
    ``success``/``neutral``/``skipped`` pass; ``cancelled``/``stale`` aborted
    without a verdict; every other non-empty value is a failure.
    """
    if not conclusion:
        return False
    return conclusion not in NON_FAILING_CONCLUSIONS and conclusion not in ABORTED_CONCLUSIONS


def new_document() -> dict[str, Any]:
    """An empty activity document at the current version."""
    return {
        "version": DOC_VERSION,
        "events": [],
        "checks": {},
        "participants": {},
        "counts": {},
        "events_dropped": 0,
    }


def extract_event_at(event_type: str, event: Mapping[str, Any]) -> str | None:
    """The provider event-scoped timestamp for the types that carry one, else None.

    GitHub has no delivery sequence number and most ``pull_request`` actions carry
    no event timestamp, so only these four types have a real event time worth
    storing alongside the arrival ``ts``:

    - ``opened`` → ``pull_request.created_at``
    - ``closed`` → ``pull_request.closed_at``
    - ``merged`` → ``pull_request.merged_at``
    - ``review_submitted`` → ``review.submitted_at``

    Pure: reads only the passed webhook ``event`` mapping.
    """
    pull_request = event.get("pull_request") or {}
    if event_type == PullRequestActivityType.OPENED:
        return pull_request.get("created_at")
    if event_type == PullRequestActivityType.CLOSED:
        return pull_request.get("closed_at")
    if event_type == PullRequestActivityType.MERGED:
        return pull_request.get("merged_at")
    if event_type == PullRequestActivityType.REVIEW_SUBMITTED:
        return (event.get("review") or {}).get("submitted_at")
    return None


def apply_activity(
    doc: dict[str, Any],
    *,
    event_type: str,
    payload: Mapping[str, Any],
    ts: str,
    event_at: str | None = None,
    webhook_id: str | None = None,
    provider_ts: str | None = None,
) -> None:
    """Fold one processed webhook event into ``doc`` in place.

    Dispatches on ``event_type`` to the right family reducer:

    - comment types fold the sender into ``participants`` only;
    - ``check_*`` types update the checks rollup (``provider_ts`` is the check's
      ``completed_at`` for a run, or the suite's ``updated_at``);
    - everything else is an entry (appended + counted + participant-folded).

    ``ts`` is arrival time (mirrors the old row's ``date_added``); ``event_at`` is
    the provider event-scoped time from :func:`extract_event_at` (null for most
    types). All timestamps are stored and compared as the raw provider strings.
    """
    if event_type in _COMMENT_EVENT_TYPES:
        _fold_participant(doc, payload)
        return
    if event_type == PullRequestActivityType.CHECK_SUITE_COMPLETED:
        _apply_check_suite(doc, payload, provider_ts)
        return
    if event_type == PullRequestActivityType.CHECK_RUN_COMPLETED:
        _apply_check_run(doc, payload, provider_ts)
        return
    _apply_entry(
        doc,
        event_type=event_type,
        payload=payload,
        ts=ts,
        event_at=event_at,
        webhook_id=webhook_id,
    )


def _fold_participant(doc: dict[str, Any], payload: Mapping[str, Any]) -> None:
    """Union the event's sender into ``participants`` (login -> sender_type).

    Idempotent and order-free. A missing/empty login (check apps, malformed
    payloads) contributes nothing.
    """
    sender_login = payload.get("sender_login") or ""
    if not sender_login:
        return
    doc["participants"][sender_login] = payload.get("sender_type") or ""


def _apply_entry(
    doc: dict[str, Any],
    *,
    event_type: str,
    payload: Mapping[str, Any],
    ts: str,
    event_at: str | None,
    webhook_id: str | None,
) -> None:
    """Append a lifecycle entry, deduping redeliveries by ``webhook_id``.

    Dedup replaces the old table's unique constraint with a containment check over
    the (bounded) ``events`` list — the caller holds the row lock. Counts increment
    once per non-duplicate delivery, before the events cap, so ``select_verdict`` /
    ``reviews_count`` stay exact even when entries are dropped by the cap.
    """
    if webhook_id and _is_duplicate(doc, webhook_id):
        return

    doc["counts"][event_type] = doc["counts"].get(event_type, 0) + 1
    _fold_participant(doc, payload)

    if len(doc["events"]) >= MAX_EVENTS:
        doc["events_dropped"] = doc.get("events_dropped", 0) + 1
        logger.warning(
            "pr_metrics.activity_doc.events_capped",
            extra={"event_type": event_type, "events_dropped": doc["events_dropped"]},
        )
        metrics.incr("pr_metrics.activity_doc.events_capped")
        return

    doc["events"].append(
        {
            "event_type": event_type,
            "ts": ts,
            "event_at": event_at,
            "webhook_id": webhook_id,
            "payload": dict(payload),
        }
    )


def _is_duplicate(doc: dict[str, Any], webhook_id: str) -> bool:
    return any(entry.get("webhook_id") == webhook_id for entry in doc["events"])


def _apply_check_suite(
    doc: dict[str, Any], payload: Mapping[str, Any], suite_updated_at: str | None
) -> None:
    """Fold a completed ``check_suite`` into its ``(head_sha, app_slug)`` group.

    The suite carries the aggregate conclusion (latest wins on ``updated_at``) and
    the run count (``max`` of ``latest_check_runs_count``). A failing suite also
    lowers ``first_failure_at`` so the signal survives even for CI apps that only
    emit suite events.
    """
    group = _get_or_create_group(doc, payload)

    conclusion = payload.get("conclusion") or ""
    if _is_newer(suite_updated_at, group.get("suite_updated_at")):
        group["suite_conclusion"] = conclusion
        group["suite_updated_at"] = suite_updated_at
    group["check_runs_count"] = max(
        group.get("check_runs_count", 0), payload.get("check_runs_count") or 0
    )
    if is_failing_conclusion(conclusion):
        group["first_failure_at"] = _min_ts(group.get("first_failure_at"), suite_updated_at)
    _touch_last_event(group, suite_updated_at)


def _apply_check_run(
    doc: dict[str, Any], payload: Mapping[str, Any], completed_at: str | None
) -> None:
    """Fold a completed ``check_run`` into its group's ever-failing ``runs`` map.

    Only checks that have EVER failed are tracked. A failing run creates or bumps
    its entry (``failed_attempts`` += 1) and lowers ``first_failure_at``; a
    non-failing run updates an existing (previously-failing) entry in place so a
    fail→rerun-green at the same head reads as recovered rather than vanishing.
    Latest-wins on ``completed_at`` keeps out-of-order deliveries convergent.
    """
    group = _get_or_create_group(doc, payload)

    _touch_last_event(group, completed_at)
    name = payload.get("check_name") or ""
    if not name:
        return

    conclusion = payload.get("conclusion") or ""
    failing = is_failing_conclusion(conclusion)
    runs = group["runs"]
    entry = runs.get(name)

    if entry is not None:
        if failing:
            entry["failed_attempts"] = entry.get("failed_attempts", 0) + 1
        if _is_newer(completed_at, entry.get("completed_at")):
            entry["conclusion"] = conclusion
            entry["completed_at"] = completed_at
    elif failing:
        if len(runs) >= MAX_RUNS_PER_GROUP:
            logger.warning(
                "pr_metrics.activity_doc.check_runs_capped",
                extra={
                    "head_sha": group["head_sha"],
                    "app_slug": group["app_slug"],
                    "check_name": name,
                },
            )
            metrics.incr("pr_metrics.activity_doc.check_runs_capped")
            return
        runs[name] = {
            "conclusion": conclusion,
            "completed_at": completed_at,
            "failed_attempts": 1,
        }

    if failing:
        group["first_failure_at"] = _min_ts(group.get("first_failure_at"), completed_at)


def _get_or_create_group(doc: dict[str, Any], payload: Mapping[str, Any]) -> dict[str, Any]:
    """The rollup for a check payload's ``(head_sha, app_slug)``.

    Existing groups always resolve. A new group beyond ``MAX_CHECK_GROUPS`` evicts
    the least-recently-updated group (by ``last_event_at``) to make room rather than
    dropping the newcomer: the judge cares most about the *final* head's CI state, so
    a green-heavy PR that fills the cap must not freeze on stale SHAs and silently
    drop a failing check that lands on a newer one. Each eviction is a cap hit,
    surfaced via a log + metric — the cap is a pathology backstop, never silent.
    """
    head_sha = payload.get("head_sha") or ""
    app_slug = payload.get("app_slug") or ""
    key = f"{head_sha}|{app_slug}"
    checks = doc["checks"]
    group = checks.get(key)
    if group is not None:
        return group
    if len(checks) >= MAX_CHECK_GROUPS:
        evicted_key = min(checks, key=lambda existing: checks[existing].get("last_event_at") or "")
        del checks[evicted_key]
        logger.warning(
            "pr_metrics.activity_doc.check_groups_capped",
            extra={"head_sha": head_sha, "app_slug": app_slug, "evicted_key": evicted_key},
        )
        metrics.incr("pr_metrics.activity_doc.check_groups_capped")
    group = {
        "head_sha": head_sha,
        "app_slug": app_slug,
        "suite_conclusion": None,
        "suite_updated_at": None,
        "check_runs_count": 0,
        "runs": {},
        "first_failure_at": None,
        "last_event_at": None,
    }
    checks[key] = group
    return group


def _touch_last_event(group: dict[str, Any], ts: str | None) -> None:
    if _is_newer(ts, group.get("last_event_at")):
        group["last_event_at"] = ts


def _is_newer(candidate: str | None, current: str | None) -> bool:
    """Whether ``candidate`` should win a latest-wins comparison over ``current``.

    A missing candidate never wins; any candidate beats a missing current.
    Compares the raw provider timestamp strings lexicographically — safe because
    GitHub emits a single canonical UTC ISO-8601 format (``...Z``, second
    precision), for which lexical order is chronological order.
    """
    if not candidate:
        return False
    if not current:
        return True
    return candidate > current


def _min_ts(current: str | None, candidate: str | None) -> str | None:
    """The earlier of two provider timestamps (for ``first_failure_at``)."""
    if not candidate:
        return current
    if not current:
        return candidate
    return min(current, candidate)
