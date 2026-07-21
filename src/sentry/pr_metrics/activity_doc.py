"""One versioned JSONB document per PR, updated in place by webhook events
instead of per-event ``PullRequestActivity`` rows.

No DB access in this module: functions take and mutate plain dicts, so stored
docs can be re-folded through the same reducer (emit-time parity check, corpus
rebuilds). :func:`apply_activity` dispatches three event families: lifecycle
**entries** (appended to ``events`` in arrival order, deduped by ``webhook_id``,
synchronize links folded into ``sync_chain``), **checks** (collapsed into
per-``(head_sha, app_slug)`` rollups), and **comments** (folded into
``participants`` only, never stored).
"""

from __future__ import annotations

import logging
from collections import Counter
from collections.abc import Mapping
from typing import Any, TypedDict

from sentry.models.pullrequest import PullRequestActivityType
from sentry.utils import metrics

logger = logging.getLogger(__name__)

DOC_VERSION = 1

# Entry-list cap. Lifecycle events are low-volume (checks and comments never land
# here), so 500 sits far above what a normal PR produces; reaching it is a
# pathology backstop, surfaced via ``events_dropped`` + a log/metric.
MAX_EVENTS = 500
# The synchronize before/after chain gets its own bounded reduction so it survives
# the events cap: below MAX_SYNC_CHAIN the chain is complete; past it the NEWEST
# links — the ones the head-anchored commit-chain walk starts from — are retained.
MAX_SYNC_CHAIN = 500
# Check-rollup bounds: distinct ``(head_sha, app_slug)`` groups per PR, and
# ever-failing runs tracked per group. Both are pathology backstops.
MAX_CHECK_GROUPS = 100
MAX_RUNS_PER_GROUP = 50

# Conclusion vocabulary shared with Seer's ``timeline.py``: a clean pass, an
# aborted run that never reached a pass/fail verdict, and — everything else that
# is non-empty — a failure.
NON_FAILING_CONCLUSIONS = frozenset({"success", "neutral", "skipped"})
ABORTED_CONCLUSIONS = frozenset({"cancelled", "stale"})

# Comment events fold into ``participants`` only — no entry, no count — because
# their per-comment volume is exactly what this design sheds.
_COMMENT_EVENT_TYPES = frozenset(
    {
        PullRequestActivityType.COMMENT_CREATED,
        PullRequestActivityType.COMMENT_EDITED,
    }
)


class CheckRun(TypedDict):
    conclusion: str
    completed_at: str | None
    failed_attempts: int


class CheckGroup(TypedDict):
    head_sha: str
    app_slug: str
    suite_conclusion: str | None
    suite_updated_at: str | None
    check_runs_count: int
    runs: dict[str, CheckRun]
    first_failure_at: str | None
    last_event_at: str | None


class ActivityEntry(TypedDict):
    event_type: str
    ts: str
    event_at: str | None
    webhook_id: str | None
    payload: dict[str, Any]


class ActivityDoc(TypedDict):
    """The JSON-round-tripped storage shape of the activity document.

    These types describe what is persisted and read back, not the live objects: a
    stored/loaded doc is plain ``dict``/``list`` values (the TypedDict types are
    erased at runtime) with every timestamp kept as the raw provider string.
    Doc-shape evolution is versioned via the ``version`` field.
    """

    version: int
    events: list[ActivityEntry]
    checks: dict[str, CheckGroup]
    participants: dict[str, str]
    counts: dict[str, int]
    events_dropped: int
    # A list of ``[after_sha, before_sha_or_null]`` pairs in arrival order, NOT an
    # object keyed by after_sha: Postgres jsonb does not preserve object key order,
    # and eviction at the cap must drop the OLDEST link, which needs insertion
    # order. jsonb preserves array order, so a list keeps eviction correct.
    sync_chain: list[list[str | None]]


def is_failing_conclusion(conclusion: str | None) -> bool:
    """Whether a check conclusion counts as a failure.

    An empty/absent conclusion (a check that hasn't concluded) is not a failure;
    ``success``/``neutral``/``skipped`` pass; ``cancelled``/``stale`` aborted
    without a verdict; every other non-empty value is a failure.
    """
    if not conclusion:
        return False
    return conclusion not in NON_FAILING_CONCLUSIONS and conclusion not in ABORTED_CONCLUSIONS


def has_verdict(conclusion: str | None) -> bool:
    """Whether a conclusion reports an outcome at all — a pass or a failure.

    ``cancelled``/``stale`` and an empty conclusion are the *absence* of a result,
    not a result: the run was abandoned before CI decided anything.
    """
    return bool(conclusion) and conclusion not in ABORTED_CONCLUSIONS


def _wins_conclusion(candidate: str | None, current: str | None) -> bool:
    """Whether a newer conclusion may replace the stored one.

    Latest-wins is the right rule only between verdicts. A rerun that was cancelled
    reports nothing, so it must not erase what CI already decided: a check that
    failed and whose rerun was then cancelled is still failing, and letting the
    cancellation win drops it from ``failing_check_names`` — and, where the app
    emits no suite event, flips the whole group to ``success``.

    A no-verdict conclusion is still recorded when there is nothing to erase, so a
    run that only ever aborted (a PR closed mid-CI) reads as aborted rather than
    silently deriving a pass.
    """
    return has_verdict(candidate) or not has_verdict(current)


def new_document() -> ActivityDoc:
    """An empty activity document at the current version."""
    return {
        "version": DOC_VERSION,
        "events": [],
        "checks": {},
        "participants": {},
        "counts": {},
        "events_dropped": 0,
        "sync_chain": [],
    }


def extract_event_at(event_type: PullRequestActivityType, event: Mapping[str, Any]) -> str | None:
    """The provider event-scoped timestamp for the types that carry one, else None.

    GitHub has no delivery sequence number and most ``pull_request`` actions carry
    no event timestamp, so only these four types have a real event time worth
    storing alongside the arrival ``ts``.
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
    doc: ActivityDoc,
    *,
    event_type: PullRequestActivityType,
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


def _fold_participant(doc: ActivityDoc, payload: Mapping[str, Any]) -> None:
    """Union the event's sender into ``participants`` (login -> sender_type).

    Idempotent and order-free. A missing/empty login (check apps, malformed
    payloads) contributes nothing.
    """
    sender_login = payload.get("sender_login") or ""
    if not sender_login:
        return
    doc["participants"][sender_login] = payload.get("sender_type") or ""


def _apply_entry(
    doc: ActivityDoc,
    *,
    event_type: PullRequestActivityType,
    payload: Mapping[str, Any],
    ts: str,
    event_at: str | None,
    webhook_id: str | None,
) -> None:
    """Append a lifecycle entry, deduping redeliveries by ``webhook_id``.

    Dedup replaces the old table's unique constraint with a containment check over
    the (bounded) ``events`` list — the caller holds the row lock. Counts increment
    once per non-duplicate delivery, before the events cap, so ``select_verdict`` /
    ``reviews_count`` stay exact even when entries are dropped by the cap. A
    synchronize entry also folds its before/after link into ``sync_chain`` before
    the cap, so the commit-chain walk survives even if the entry itself is dropped.

    The one exactness gap is a pathology-on-a-pathology: once the cap is reached a
    dropped entry keeps no stored ``webhook_id``, so a later redelivery of that same
    capped event can't be deduped and increments ``counts`` a second time. Retaining
    the dropped ids would reintroduce exactly the unbounded per-event growth the cap
    exists to stop, so the rare over-count on a 500+-entry PR is accepted, not fixed.
    """
    if webhook_id and _is_duplicate(doc, webhook_id):
        return

    if event_type == PullRequestActivityType.SYNCHRONIZED:
        _fold_sync_chain(doc, payload)

    doc["counts"][event_type] = doc["counts"].get(event_type, 0) + 1
    _fold_participant(doc, payload)

    if len(doc["events"]) >= MAX_EVENTS:
        # Past the cap the entry (and its webhook_id) isn't retained, so a redelivery
        # re-increments counts — the accepted dedup gap documented above.
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


def _is_duplicate(doc: ActivityDoc, webhook_id: str) -> bool:
    return any(entry.get("webhook_id") == webhook_id for entry in doc["events"])


def _fold_sync_chain(doc: ActivityDoc, payload: Mapping[str, Any]) -> None:
    """Record a synchronize's ``before_sha`` → ``after_sha`` link in ``sync_chain``.

    A reader chain-follows these links backward from the PR's current head to
    recover the pushed commits, so the chain has its own bounded reduction,
    independent of the events cap: the newest links — the ones the head-anchored
    walk starts from — must survive even when the synchronize entry is dropped from
    ``events`` (an auto-rebase bot is exactly the synchronize-heavy pathology that
    fills the cap). Idempotent: a redelivery or a re-reported ``after_sha`` already
    present is a no-op. At the cap the oldest pair is evicted (logged + metered,
    like every cap in this module). ``setdefault`` because a stored document written
    by a build predating this field lacks the key; the fold creates it in place.
    """
    after = payload.get("after_sha") or ""
    if not after:
        return
    chain = doc.setdefault("sync_chain", [])
    if any(pair[0] == after for pair in chain):
        return
    if len(chain) >= MAX_SYNC_CHAIN:
        chain.pop(0)
        logger.warning(
            "pr_metrics.activity_doc.sync_chain_capped",
            extra={"after_sha": after},
        )
        metrics.incr("pr_metrics.activity_doc.sync_chain_capped")
    chain.append([after, payload.get("before_sha") or None])


def _apply_check_suite(
    doc: ActivityDoc, payload: Mapping[str, Any], suite_updated_at: str | None
) -> None:
    """Fold a completed ``check_suite`` into its ``(head_sha, app_slug)`` group.

    The suite carries the aggregate conclusion (latest verdict wins on
    ``updated_at`` — see :func:`_wins_conclusion` for why an aborted suite does not
    count) and the run count (``max`` of ``latest_check_runs_count``). A failing
    suite also lowers ``first_failure_at`` so the signal survives even for CI apps
    that only emit suite events.
    """
    group = _get_or_create_group(doc, payload)

    conclusion = payload.get("conclusion") or ""
    if _is_newer(suite_updated_at, group.get("suite_updated_at")) and _wins_conclusion(
        conclusion, group.get("suite_conclusion")
    ):
        group["suite_conclusion"] = conclusion
        group["suite_updated_at"] = suite_updated_at
    group["check_runs_count"] = max(
        group.get("check_runs_count", 0), payload.get("check_runs_count") or 0
    )
    if is_failing_conclusion(conclusion):
        group["first_failure_at"] = _min_ts(group.get("first_failure_at"), suite_updated_at)
    _touch_last_event(group, suite_updated_at)


def _apply_check_run(
    doc: ActivityDoc, payload: Mapping[str, Any], completed_at: str | None
) -> None:
    """Fold a completed ``check_run`` into its group's ever-failing ``runs`` map.

    Only checks that have EVER failed are tracked. A failing run creates or bumps
    its entry (``failed_attempts`` += 1) and lowers ``first_failure_at``; a
    non-failing run updates an existing (previously-failing) entry in place so a
    fail→rerun-green at the same head reads as recovered rather than vanishing.
    Latest-*verdict*-wins on ``completed_at`` keeps out-of-order deliveries
    convergent while leaving a stored result intact when a rerun aborts without
    reaching one (see :func:`_wins_conclusion`).
    Redelivery-safe without ``webhook_id`` dedup: a redelivered failing event
    double counts only the magnitude signal, which is accepted.
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
        if _is_newer(completed_at, entry.get("completed_at")) and _wins_conclusion(
            conclusion, entry.get("conclusion")
        ):
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


def _get_or_create_group(doc: ActivityDoc, payload: Mapping[str, Any]) -> CheckGroup:
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


def _touch_last_event(group: CheckGroup, ts: str | None) -> None:
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


# --- readers: pure projections of a stored document -----------------------

# The judge forward collapses each checks group into one synthesized event and
# caps the number forwarded, mirroring the legacy row cap. The write-time group
# cap already bounds this; the forward cap is a defensive backstop.
MAX_FORWARDED_CHECK_GROUPS = 100


def has_commits_after_open(doc: ActivityDoc) -> bool:
    """Whether any push landed after the PR opened — ``select_verdict``'s signal."""
    return doc.get("counts", {}).get(PullRequestActivityType.SYNCHRONIZED, 0) > 0


def human_participant_count(doc: ActivityDoc) -> int:
    """Distinct non-bot participants (CI apps and automation excluded)."""
    return sum(1 for sender_type in doc.get("participants", {}).values() if sender_type != "Bot")


def _entry_sender(entry: ActivityEntry) -> tuple[str, str | None]:
    payload = entry.get("payload") or {}
    return payload.get("sender_login") or "", payload.get("sender_type")


def _bot_human_counts(
    events: list[ActivityEntry], event_types: tuple[PullRequestActivityType, ...]
) -> Counter[str]:
    """Senders behind the given entry types, split into ``bot``/``human`` counts."""
    counts: Counter[str] = Counter()
    for event in events:
        if event["event_type"] in event_types:
            _login, sender_type = _entry_sender(event)
            counts["bot" if sender_type == "Bot" else "human"] += 1
    return counts


def derived_metrics_from_doc(doc: ActivityDoc) -> dict[str, Any]:
    """The activity-derived counters, projected from the document.

    Field-for-field the same shape ``emit._activity_derived_metrics`` produces
    from rows: reviews/participants totals plus the human-involvement splits.
    Totals that must survive the events cap (``reviews_count``) come from
    ``counts``; the account-class splits come from the stored entries.
    """
    events = doc.get("events", [])

    review_counts = _bot_human_counts(events, (PullRequestActivityType.REVIEW_SUBMITTED,))
    push_counts = _bot_human_counts(
        events, (PullRequestActivityType.OPENED, PullRequestActivityType.SYNCHRONIZED)
    )

    # Earliest opener, latest closer (events are in arrival order).
    opened = next(
        (
            _entry_sender(event)
            for event in events
            if event["event_type"] == PullRequestActivityType.OPENED
        ),
        None,
    )
    closed = None
    for event in events:
        if event["event_type"] in (
            PullRequestActivityType.CLOSED,
            PullRequestActivityType.MERGED,
        ):
            closed = _entry_sender(event)
    same_actor = (opened[0] == closed[0]) if opened and closed and opened[0] and closed[0] else None

    return {
        "participants_count": human_participant_count(doc),
        "reviews_count": doc.get("counts", {}).get(PullRequestActivityType.REVIEW_SUBMITTED, 0),
        "reviews_bot_count": review_counts["bot"],
        "reviews_human_count": review_counts["human"],
        "pushes_bot_count": push_counts["bot"],
        "pushes_human_count": push_counts["human"],
        "opened_by_bot": (opened[1] == "Bot") if opened else None,
        "closed_by_bot": (closed[1] == "Bot") if closed else None,
        "opened_and_closed_by_same_actor": same_actor,
    }


def commit_shas_from_doc(doc: ActivityDoc, head_sha: str | None) -> set[str]:
    """Post-open commit SHAs, by chain-following ``sync_chain`` backward from the head.

    Reassembles the ``before_sha`` → ``after_sha`` linked list from the reducer's
    ``sync_chain`` — not from the ``events`` entries — and walks it backward from the
    PR's current head. The chain map is fed by the reducer independently of the
    entries cap, so the walk stays anchored at the head even under cap pressure that
    drops the newest synchronize entries; scanning ``events`` instead would lose the
    head the moment the latest synchronize was capped, emptying the result. Being
    order-independent, out-of-order sync deliveries no longer read as a force push; a
    genuine force push — a head that doesn't chain back — surfaces as the walk
    terminating early, dropping the abandoned commits. Eviction of the oldest links
    once ``sync_chain`` fills degrades identically: the walk stops at the horizon.
    Returns an empty set when the head isn't reachable from any push (e.g. no pushes
    after open).
    """
    before_by_after: dict[str, str | None] = {}
    for pair in doc.get("sync_chain") or []:
        after = pair[0]
        if not after:
            continue
        before_by_after[after] = pair[1]

    shas: set[str] = set()
    current = head_sha or ""
    while current and current in before_by_after and current not in shas:
        shas.add(current)
        current = before_by_after[current] or ""
    return shas


def _synthesized_suite_conclusion(group: CheckGroup) -> str:
    """The group's aggregate conclusion: the latest suite conclusion, or one derived
    from the failing runs when no suite event was ever seen."""
    conclusion = group.get("suite_conclusion")
    if conclusion:
        return conclusion
    runs = group.get("runs", {})
    if any(is_failing_conclusion(run.get("conclusion")) for run in runs.values()):
        return "failure"
    return "success"


def _synthesized_check_suite_payload(group: CheckGroup) -> dict[str, Any]:
    runs = group.get("runs", {})
    return {
        "action": "completed",
        "conclusion": _synthesized_suite_conclusion(group),
        "app_slug": group.get("app_slug", ""),
        "check_runs_count": group.get("check_runs_count", 0),
        # Additive keys the legacy row forward never carried (Seer ignores unknown
        # payload keys, so this doesn't change the wire contract).
        "head_sha": group.get("head_sha", ""),
        "failing_check_names": sorted(
            name for name, run in runs.items() if is_failing_conclusion(run.get("conclusion"))
        ),
        "first_failure_at": group.get("first_failure_at"),
    }


def timeline_events_from_doc(doc: ActivityDoc) -> list[dict[str, Any]]:
    """Project the document into the judge's activity timeline, oldest first.

    Lifecycle entries pass through unchanged (``event_type``, ``timestamp`` = the
    arrival ``ts``, ``payload``); each checks group collapses into one synthesized
    ``check_suite_completed`` timestamped at its ``last_event_at``. The merged list
    is sorted by timestamp, matching the legacy forward's shape — only the check
    events are pre-collapsed (what Seer's timeline does anyway).
    """
    events: list[dict[str, Any]] = [
        {
            "event_type": entry["event_type"],
            "timestamp": entry["ts"],
            "payload": entry.get("payload") or {},
        }
        for entry in doc.get("events", [])
    ]

    groups = list(doc.get("checks", {}).values())
    if len(groups) > MAX_FORWARDED_CHECK_GROUPS:
        dropped = len(groups) - MAX_FORWARDED_CHECK_GROUPS
        logger.warning(
            "pr_metrics.activity_doc.forward_groups_capped",
            extra={"check_groups": len(groups), "dropped": dropped},
        )
        metrics.incr("pr_metrics.activity_doc.forward_groups_capped")
        groups = sorted(groups, key=lambda group: group.get("last_event_at") or "")[
            -MAX_FORWARDED_CHECK_GROUPS:
        ]

    for group in groups:
        events.append(
            {
                "event_type": PullRequestActivityType.CHECK_SUITE_COMPLETED,
                "timestamp": group.get("last_event_at") or "",
                "payload": _synthesized_check_suite_payload(group),
            }
        )

    events.sort(key=lambda event: event["timestamp"] or "")
    return events
