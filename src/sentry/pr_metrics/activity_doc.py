"""One versioned JSONB document per PR, updated in place by webhook events
instead of per-event ``PullRequestActivity`` rows.

No DB access in this module: functions take and mutate plain dicts, so stored
docs can be re-folded through the same reducer (emit-time parity check, corpus
rebuilds). :func:`apply_activity` dispatches three event families: lifecycle
**entries** (appended to ``events`` in arrival order, deduped by ``webhook_id``,
with synchronize links also folded into ``sync_chain``), **checks** (collapsed into
per-``(head_sha, app_slug, check_suite_id)`` rollups), and **comments** (folded
into ``participants`` only, never stored).
"""

from __future__ import annotations

import logging
from collections import Counter
from collections.abc import Iterable, Mapping
from typing import Any, Literal, TypedDict

from sentry.integrations.github.utils import is_github_bot_login
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
# Check-rollup caps, each eviction surfaced via log + metric. MAX_GROUPS_PER_HEAD
# bounds one head's suite fan-out (the busiest observed repo emits ~26 suites per
# head across all apps) so suite spam can't evict other heads; MAX_CHECK_GROUPS
# bounds the document across heads; MAX_RUNS_PER_GROUP bounds the ever-failing
# runs tracked per group.
MAX_CHECK_GROUPS = 300
MAX_GROUPS_PER_HEAD = 40
MAX_RUNS_PER_GROUP = 50

# Conclusion vocabulary shared with Seer's ``timeline.py``: a clean pass, an
# aborted run that never reached a pass/fail verdict, and — everything else that
# is non-empty — a failure.
NON_FAILING_CONCLUSIONS = frozenset({"success", "neutral", "skipped"})
ABORTED_CONCLUSIONS = frozenset({"cancelled", "stale"})

# Conclusions that unambiguously mean the check errored out, as opposed to
# cancelled/skipped/stale (never ran to completion, not a failure verdict),
# neutral (a soft pass), or action_required (blocked on approval, not broken).
# Narrower than ``is_failing_conclusion``, which treats every unrecognized
# conclusion as a failure; use this where a false failure would be misread.
FAILING_CHECK_CONCLUSIONS = frozenset({"failure", "timed_out", "startup_failure"})

# The one CI conclusion value GitHub never sends: no suite reported a conclusion
# and no tracked run failed, so there is nothing to pass through. Kept distinct
# from ``cancelled``/``stale`` — "CI told us nothing" is not "CI was called off".
# Spelled the same as Seer's ``_UNKNOWN_CONCLUSION`` so one vocabulary covers both
# sides of the wire; ``is_failing_conclusion`` excludes it explicitly, since it
# would otherwise fall through as an unrecognized — therefore failing — value.
UNKNOWN_CONCLUSION = "unknown"

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
    # Numeric id of the owning check suite (``check_suite.id``); None when the
    # payload carried none. Absent entirely in groups persisted before the
    # per-suite split — readers must ``.get``.
    check_suite_id: int | None
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
    # A list of ``[after_sha, before_sha_or_null, sender_login, sender_type,
    # webhook_id]`` entries in arrival order, NOT an object keyed by after_sha:
    # Postgres jsonb does not preserve object key order, and eviction at the cap must
    # drop the OLDEST link, which needs insertion order. jsonb preserves array order,
    # so a list keeps eviction correct. Slots were added over time and older entries
    # are never backfilled, so one chain can hold several widths at once: entries
    # written before the sender slots have length 2 and read as an unknown pusher,
    # and anything shorter than 5 predates the delivery-id slot and dedupes against
    # nothing (see :func:`_fold_sync_chain`). Every reader therefore guards on
    # ``len(link)`` rather than assuming a fixed width.
    sync_chain: list[list[str | None]]


def is_failing_conclusion(conclusion: str | None) -> bool:
    """Whether a check conclusion counts as a failure.

    An empty/absent conclusion (a check that hasn't concluded) is not a failure;
    ``success``/``neutral``/``skipped`` pass; ``cancelled``/``stale`` aborted
    without a verdict; ``UNKNOWN_CONCLUSION`` is our own "CI said nothing" marker
    rather than something CI reported; every other non-empty value is a failure.
    """
    if not conclusion or conclusion == UNKNOWN_CONCLUSION:
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
    ``sync_chain`` is deliberately outside that gap: it survives the cap, so it
    carries its own copy of the delivery id and dedupes on it (see
    :func:`_fold_sync_chain`) rather than inheriting this one's blind spot.
    """
    if webhook_id and _is_duplicate(doc, webhook_id):
        return

    if event_type == PullRequestActivityType.SYNCHRONIZED:
        _fold_sync_chain(doc, payload, webhook_id=webhook_id)

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
        metrics.incr("pr_metrics.activity_doc.events_capped", sample_rate=1.0)
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


def _fold_sync_chain(
    doc: ActivityDoc, payload: Mapping[str, Any], *, webhook_id: str | None
) -> None:
    """Record a synchronize's ``before_sha`` → ``after_sha`` link in ``sync_chain``.

    A reader chain-follows these links backward from the PR's current head to
    recover the pushed commits, so the chain has its own bounded reduction,
    independent of the events cap: the newest links — the ones the head-anchored
    walk starts from — must survive even when the synchronize entry is dropped from
    ``events`` (an auto-rebase bot is exactly the synchronize-heavy pathology that
    fills the cap). Distinct synchronize events with the same ``after_sha`` are
    intentionally retained as separate head observations, such as when the head
    returns to a prior SHA. At the cap the oldest link is evicted (logged + metered,
    like every cap in this module). ``setdefault`` because a stored document written
    by a build predating this field lacks the key; the fold creates it in place.

    Because repeated SHAs are legitimate, redelivery is caught by delivery id alone —
    and the chain dedupes on its OWN stored ``webhook_id`` rather than relying on the
    caller's ``events`` scan, which stops catching anything once the events cap is
    reached and stored ids stop accruing. That is precisely the regime the chain is
    built to outlive, so a redelivered synchronize past the cap would otherwise append
    a second link for a push that happened once: a phantom head observation in
    ``ci_head_results_from_doc`` and a wasted slot against ``MAX_SYNC_CHAIN``, which
    pulls the commit-walk horizon in.

    The dedup only covers links that carry an id, so a document open across the
    deploy that added the slot keeps a blind prefix: a synchronize stored before the
    deploy and redelivered after it matches nothing here. Below the events cap the
    entry-level dedup still catches it (the pre-deploy entry kept its ``webhook_id``
    in ``events``), so the exposure is a PR already at ``MAX_EVENTS`` when the deploy
    lands, and it heals as soon as the next push writes a link with an id.
    """
    after = payload.get("after_sha") or ""
    if not after:
        return

    chain = doc.setdefault("sync_chain", [])
    if webhook_id and any(len(link) > 4 and link[4] == webhook_id for link in chain):
        return

    if len(chain) >= MAX_SYNC_CHAIN:
        chain.pop(0)
        logger.warning(
            "pr_metrics.activity_doc.sync_chain_capped",
            extra={"after_sha": after},
        )
        metrics.incr("pr_metrics.activity_doc.sync_chain_capped", sample_rate=1.0)

    chain.append(
        [
            after,
            payload.get("before_sha") or None,
            payload.get("sender_login") or None,
            payload.get("sender_type") or None,
            webhook_id or None,
        ]
    )


def _apply_check_suite(
    doc: ActivityDoc, payload: Mapping[str, Any], suite_updated_at: str | None
) -> None:
    """Fold a completed ``check_suite`` into its ``(head_sha, app_slug,
    check_suite_id)`` group.

    The suite carries the aggregate conclusion (latest verdict wins on
    ``updated_at`` — see :func:`_wins_conclusion`; per-suite grouping means this
    only ever arbitrates reruns of the same suite) and the run count (``max`` of
    ``latest_check_runs_count``). A failing suite also lowers ``first_failure_at``
    so the signal survives even for CI apps that only emit suite events.
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
            metrics.incr("pr_metrics.activity_doc.check_runs_capped", sample_rate=1.0)
            return
        runs[name] = {
            "conclusion": conclusion,
            "completed_at": completed_at,
            "failed_attempts": 1,
        }

    if failing:
        group["first_failure_at"] = _min_ts(group.get("first_failure_at"), completed_at)


def _forward_priority(group: CheckGroup) -> tuple[bool, str]:
    """Sort key shared by the within-head eviction and the judge-forward trim:
    failing (ever-failed) groups last, then most recent — so ``min()`` evicts and
    ``[-N:]`` drops non-failing stale groups first, and a recorded failure is
    never displaced by a fresher green."""
    failed = is_failing_conclusion(group.get("suite_conclusion")) or bool(
        group.get("first_failure_at")
    )
    return (failed, group.get("last_event_at") or "")


def _get_or_create_group(doc: ActivityDoc, payload: Mapping[str, Any]) -> CheckGroup:
    """The rollup for a check payload's ``(head_sha, app_slug, check_suite_id)``.

    Per-suite, not per-app: nothing limits an app to one suite per head — GitHub
    Actions raises one per workflow run — so folding an app's suites together let
    the last suite to complete overwrite every other suite's conclusion, run
    count, and same-named runs.

    A payload without a suite id falls back to the suite-less legacy key, so
    pre-split documents — and id-less events from not-yet-updated processors
    during the rolling deploy — keep folding into their merged groups with no
    migration. Suite-scoped events never fold into a merged group: it freezes and
    persists until the post-emit sweep, so readers that scan every group (e.g.
    ``_any_group_failing``) see such a head+app twice and a frozen failure is not
    cleared by suite-scoped greens — accepted over erasing a recorded failure.

    A newcomer past a cap evicts an existing group rather than being dropped
    (the judge cares most about the *final* head's CI state), non-failing and
    stalest first (``_forward_priority``) so a recorded failure is never
    displaced by fresher greens: ``MAX_GROUPS_PER_HEAD`` evicts within the
    newcomer's head, so suite spam degrades only that head; ``MAX_CHECK_GROUPS``
    evicts document-wide, shedding stale heads' greens first.
    """
    head_sha = payload.get("head_sha") or ""
    app_slug = payload.get("app_slug") or ""
    check_suite_id = payload.get("check_suite_id")
    key = (
        f"{head_sha}|{app_slug}"
        if check_suite_id is None
        else f"{head_sha}|{app_slug}|{check_suite_id}"
    )
    checks = doc["checks"]
    group = checks.get(key)
    if group is not None:
        return group
    same_head = [
        existing
        for existing, existing_group in checks.items()
        if existing_group.get("head_sha") == head_sha
    ]
    if len(same_head) >= MAX_GROUPS_PER_HEAD:
        evicted_key = min(same_head, key=lambda existing: _forward_priority(checks[existing]))
        del checks[evicted_key]
        logger.warning(
            "pr_metrics.activity_doc.check_head_groups_capped",
            extra={"head_sha": head_sha, "app_slug": app_slug, "evicted_key": evicted_key},
        )
        # Ambient rate: both group caps bite on every CI-heavy PR, so the trend is what
        # matters and sampling resolves it. The forward-path caps below are the rare ones.
        metrics.incr("pr_metrics.activity_doc.check_head_groups_capped")
    elif len(checks) >= MAX_CHECK_GROUPS:
        evicted_key = min(checks, key=lambda existing: _forward_priority(checks[existing]))
        del checks[evicted_key]
        logger.warning(
            "pr_metrics.activity_doc.check_groups_capped",
            extra={"head_sha": head_sha, "app_slug": app_slug, "evicted_key": evicted_key},
        )
        metrics.incr("pr_metrics.activity_doc.check_groups_capped")

    group = {
        "head_sha": head_sha,
        "app_slug": app_slug,
        "check_suite_id": check_suite_id,
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

# The judge forward collapses each checks group into one synthesized event,
# trimmed per head so every head stays represented — the fail → push → green
# iteration story must reach the judge — keeping failures over fresher greens
# (_forward_priority). The flat cap is a backstop only: the store already
# bounds groups to MAX_CHECK_GROUPS.
MAX_FORWARDED_GROUPS_PER_HEAD = 20
MAX_FORWARDED_CHECK_GROUPS = MAX_CHECK_GROUPS


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


def reviews_requested_count_from_doc(doc: ActivityDoc) -> int:
    """Net outstanding review requests: ``REVIEW_REQUESTED`` minus
    ``REVIEW_REQUEST_REMOVED``, floored at 0.

    Not part of ``derived_metrics_from_doc``'s persisted-counters dict — unlike
    ``reviews_count`` and friends, nothing downstream re-reads this off
    ``PullRequestMetrics`` after emission, so it's read straight from the doc at
    emit time (see ``emit.review_activity``) rather than written through
    to the model.

    Both counts come from ``counts`` (not the ``events`` list) so the total
    survives the events cap the same way ``reviews_count`` does. Floored
    because a removal can't be matched to which earlier request it revoked —
    e.g. a second reviewer's request outliving the first's removal — so the
    net can't go negative; 0 just means "no request outstanding", not "one too
    many removals".
    """
    counts = doc.get("counts", {})
    requested = counts.get(PullRequestActivityType.REVIEW_REQUESTED, 0)
    removed = counts.get(PullRequestActivityType.REVIEW_REQUEST_REMOVED, 0)
    return max(requested - removed, 0)


# GitHub's review-submission vocabulary — mirrors emit.REVIEW_STATES. Duplicated
# rather than imported to avoid a circular import (emit.py imports this module).
_REVIEW_STATES = ("approved", "changes_requested", "commented")


def review_activity_from_doc(doc: ActivityDoc) -> dict[str, Any]:
    """Review-submission facts, projected from the document: the same shape as
    ``emit.review_activity``, returned as a plain dict for that function to
    wrap into its ``ReviewActivity`` NamedTuple.

    ``requested_count`` reuses ``reviews_requested_count_from_doc`` (from
    ``counts``, cap-surviving). ``results`` tallies each ``REVIEW_SUBMITTED``
    entry's ``review_state`` from the stored entries — like the bot/human
    splits in ``derived_metrics_from_doc``, this is *not* cap-surviving (no
    per-state totals are kept in ``counts``), so a PR past the events cap
    undercounts here the same way it already does for
    ``reviews_bot_count``/``reviews_human_count``.
    """
    results: Counter[str] = Counter()
    for event in doc.get("events", []):
        if event["event_type"] != PullRequestActivityType.REVIEW_SUBMITTED:
            continue
        review_state = (event.get("payload") or {}).get("review_state")
        if review_state in _REVIEW_STATES:
            results[review_state] += 1
    return {
        "requested_count": reviews_requested_count_from_doc(doc),
        "results": {state: results[state] for state in _REVIEW_STATES},
    }


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

    ``sync_chain`` keeps every head observation, so one ``after_sha`` can carry
    several ``before_sha`` values — a force push back onto an earlier head reports
    the abandoned head as its ``before``. Only the first observation of a SHA
    describes how it was actually built; later ones link it to whatever the branch
    happened to point at. So the first link wins, which keeps the walk on real
    ancestry instead of following an ``A → B → A`` loop into abandoned commits.
    """
    before_by_after: dict[str, str | None] = {}
    for link in doc.get("sync_chain") or []:
        after = link[0]
        if not after:
            continue
        before_by_after.setdefault(after, link[1])

    shas: set[str] = set()
    current = head_sha or ""
    while current and current in before_by_after and current not in shas:
        shas.add(current)
        current = before_by_after[current] or ""
    return shas


def _synthesized_suite_conclusion(group: CheckGroup) -> str:
    """The group's conclusion: GitHub's own suite conclusion when the app emitted
    one, else derived from the tracked runs.

    Forwards the provider's string as-is — ``cancelled`` stays ``cancelled``,
    ``action_required`` stays ``action_required`` — rather than collapsing it into a
    synthesized pass/fail/inconclusive verdict. The synthesized form was both lossy
    (every non-verdict conclusion arrived as one indistinguishable ``inconclusive``)
    and a second vocabulary that could, and did, disagree with what the judge
    timeline reported for the very same group.

    ``runs`` only tracks checks that have EVER failed, so with no suite event it can
    prove a failure and nothing else: a group holding a currently-failing run is a
    ``failure``, and everything else — no runs at all, or runs that all recovered —
    is ``UNKNOWN_CONCLUSION`` rather than a fabricated ``success``. Both readers get
    that same answer: the per-head CI outcome and the judge timeline describe the
    same group, so a group that concluded nothing must not read as green on one side
    and unknown on the other.
    """
    suite_conclusion = group.get("suite_conclusion")
    if suite_conclusion:
        return suite_conclusion

    runs = group.get("runs", {})
    if any(is_failing_conclusion(run.get("conclusion")) for run in runs.values()):
        return "failure"

    return UNKNOWN_CONCLUSION


def _completion_order(group: CheckGroup) -> str:
    """When a group last saw activity, for "latest wins" among equally strong suites.

    The group's newest event of any kind, not its suite conclusion stamp — matching
    how Seer orders the same suites (``suite["ts"]``, a max over suite *and* run
    events): a workflow can start early and still finish last, and a group
    synthesized from runs alone has no suite stamp to sort on at all.
    """
    return group.get("last_event_at") or ""


def _head_conclusion(groups: Iterable[CheckGroup]) -> str:
    """Collapse one head's suite groups into a single conclusion, any-failure-wins.

    Deliberately the same reduction Seer's ``_combine_suite_conclusions`` applies
    over the timeline's suites, so a head reads the same on both sides of the wire:
    a failure beats a pass, a pass beats an abort (``cancelled``/``stale`` decided
    nothing, so a suite that did decide speaks for the head), an abort beats
    silence — and within a class the latest completion wins, which keeps the value a
    conclusion GitHub actually reported (``timed_out``, not a flattened ``failure``).
    """
    by_class: dict[str, list[str]] = {"failing": [], "passed": [], "aborted": []}
    for group in sorted(groups, key=_completion_order):
        conclusion = _synthesized_suite_conclusion(group)
        if is_failing_conclusion(conclusion):
            by_class["failing"].append(conclusion)
        elif conclusion in NON_FAILING_CONCLUSIONS:
            by_class["passed"].append(conclusion)
        elif conclusion in ABORTED_CONCLUSIONS:
            by_class["aborted"].append(conclusion)
        # Anything left is ``UNKNOWN_CONCLUSION``: a group that concluded nothing
        # can't speak for the head, so it drops out and lets a real conclusion win.

    for conclusions in by_class.values():
        if conclusions:
            return conclusions[-1]
    return UNKNOWN_CONCLUSION


# Normalized (lowercase, ``[bot]`` stripped) GitHub logins for our apps. Login is
# all the activity doc stores — user-id matching from attribution isn't available
# at this grain. Includes the short ``seer`` form tests/fixtures use.
_OUR_GITHUB_BOT_LOGINS = frozenset(
    {
        "sentry",
        "seer-by-sentry",
        "seer-dev-testing",
        "seer",
    }
)


def _normalize_github_login(login: str) -> str:
    return login.lower().removesuffix("[bot]")


def ci_head_outcomes_from_doc(doc: ActivityDoc) -> dict[str, str]:
    """Map each check-rollup ``head_sha`` to a single CI conclusion.

    Values are GitHub's own conclusion strings — ``success``, ``failure``,
    ``timed_out``, ``cancelled``, ``action_required``, or whatever GitHub adds next
    — read the same way the judge timeline reads them, plus ``UNKNOWN_CONCLUSION``
    when a head has check groups but none of them concluded anything. All of a
    SHA's suite groups collapse to one value; see :func:`_head_conclusion`. Empty
    ``head_sha`` groups are skipped.
    """
    groups_by_sha: dict[str, list[CheckGroup]] = {}
    for group in doc.get("checks", {}).values():
        sha = group.get("head_sha") or ""
        if not sha:
            continue
        groups_by_sha.setdefault(sha, []).append(group)

    return {sha: _head_conclusion(groups) for sha, groups in groups_by_sha.items()}


def classify_ci_head_actor(
    sender_login: str, sender_type: str
) -> Literal["seer", "human", "bot", "unknown"]:
    """Bucket a head's webhook sender into seer / human / bot / unknown.

    Both fields are read off the same webhook ``sender`` object and stored on the
    head together, so a head carries both or neither: an empty ``sender_type`` is
    the one "we don't know who pushed this" state, and past that guard the login
    is non-empty too. A typed sender with a blank login is asserted against rather
    than bucketed — ``sender_type`` alone would send it to ``human``, which is a
    wrong answer where the input is really malformed.
    """
    if not sender_type:
        return "unknown"

    assert sender_login, "a head with a sender_type must carry a sender_login"

    if sender_type != "Bot" and not is_github_bot_login(sender_login):
        return "human"

    if _normalize_github_login(sender_login) in _OUR_GITHUB_BOT_LOGINS:
        return "seer"

    return "bot"


class CiHeadResult(TypedDict):
    """One observed PR head, retaining order and its resolved actor.

    Neither ``sender_login`` nor ``sender_type`` is carried here: both are inputs
    to ``classify_ci_head_actor`` only, and ``actor`` is the whole output we want
    downstream. The raw login identifies a specific GitHub person, and these rows
    are JSON-encoded onto ``PrCloseMetricsEvent.ci_head_results`` and land in
    BigQuery, so forwarding it would put per-person identities in durable
    analytics for a question — ours vs. someone else's iteration — that
    ``seer``/``human``/``bot``/``unknown`` already answers. Keeping it for our own
    bots only would be redundant with ``actor == "seer"``, and keeping it for
    third-party bots is the same identity forwarding. Group on ``actor``; the
    document still holds the login for classification.

    ``outcome`` is a free string, not an enum: it forwards GitHub's own check
    conclusion (see :func:`ci_head_outcomes_from_doc`), so a conclusion GitHub adds
    later lands in the warehouse as itself instead of being flattened into a
    verdict this module invented.
    """

    sequence: int | None
    head_sha: str
    before_sha: str | None
    outcome: str
    has_ci: bool
    actor: Literal["seer", "human", "bot", "unknown"]


def opening_head_from_doc(doc: ActivityDoc) -> tuple[str, str | None, str | None] | None:
    """The head the PR opened with as ``(head_sha, sender_login, sender_type)``.

    The ``OPENED`` entry carries all three, and no dedicated field duplicates them:
    the entry is the PR's oldest event and the events cap drops the NEWEST arrivals,
    so it outlives every later entry it shares the document with.

    Returns ``None`` when the document never recorded one — activity tracking
    enabled after the PR opened — i.e. there is no reliable opening head to key
    checks off. The first ``sync_chain`` link's ``before_sha`` is deliberately not
    used as a fallback: it names the head the PR opened with only if that
    synchronize was the first push after open, and a document with no ``OPENED``
    entry is exactly the one that cannot promise it — the oldest links may have
    been evicted at ``MAX_SYNC_CHAIN``, or tracking may have begun mid-PR.
    """
    for entry in doc.get("events") or ():
        if entry.get("event_type") != PullRequestActivityType.OPENED:
            continue
        payload = entry.get("payload") or {}
        head_sha = payload.get("head_sha") or ""
        if head_sha:
            return (
                head_sha,
                payload.get("sender_login") or None,
                payload.get("sender_type") or None,
            )

    return None


def ci_head_results_from_doc(doc: ActivityDoc) -> list[CiHeadResult]:
    """Return the opening head followed by synchronize heads in insertion order.

    Every head observation is retained, including repeated SHAs caused by force
    pushes. Heads without checks are explicit ``has_ci=False`` /
    ``UNKNOWN_CONCLUSION``.
    Check heads absent from the bounded history are appended in sorted SHA order
    with ``sequence=None`` so CI data is not silently lost and no false arrival
    order is invented. Legacy documents may lack sender slots.

    The opening head comes from :func:`opening_head_from_doc`; every head after it
    is attributed from the sender slots on ``sync_chain`` rather than from the
    matching ``events`` entry, because the events cap drops the newest entries —
    exactly the pushes a synchronize-heavy PR needs attributed — while
    ``sync_chain`` drops the oldest.
    """
    outcomes = ci_head_outcomes_from_doc(doc)
    results: list[CiHeadResult] = []
    observed_shas: set[str] = set()

    observations: list[tuple[str, str | None, str | None, str | None]] = []
    opening_head = opening_head_from_doc(doc)
    if opening_head:
        head_sha, sender_login, sender_type = opening_head
        observations.append((head_sha, None, sender_login, sender_type))

    observations.extend(
        (
            link[0] or "",
            link[1] if len(link) > 1 else None,
            link[2] if len(link) > 2 else None,
            link[3] if len(link) > 3 else None,
        )
        for link in doc.get("sync_chain") or []
    )

    for sequence, (head_sha, before_sha, sender_login, sender_type) in enumerate(observations):
        if not head_sha:
            continue
        observed_shas.add(head_sha)
        results.append(
            {
                "sequence": sequence,
                "head_sha": head_sha,
                "before_sha": before_sha,
                "outcome": outcomes.get(head_sha, UNKNOWN_CONCLUSION),
                "has_ci": head_sha in outcomes,
                "actor": classify_ci_head_actor(sender_login or "", sender_type or ""),
            }
        )

    for head_sha in sorted(outcomes.keys() - observed_shas):
        results.append(
            {
                "sequence": None,
                "head_sha": head_sha,
                "before_sha": None,
                "outcome": outcomes[head_sha],
                "has_ci": True,
                "actor": "unknown",
            }
        )
    return results


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
        # None for pre-split merged groups and payloads without a suite id.
        "check_suite_id": group.get("check_suite_id"),
        "failing_check_names": sorted(
            name for name, run in runs.items() if is_failing_conclusion(run.get("conclusion"))
        ),
        "first_failure_at": group.get("first_failure_at"),
        # Every check that has EVER failed in this group, with its current
        # conclusion and failure count. `failing_check_names` above is the
        # currently-failing subset; the rest are checks that went red and came back
        # green at the same SHA — flaky CI, which the collapse would otherwise
        # destroy (the group reads plain "success"). `completed_at` is deliberately
        # not forwarded: the judge orders by the group's own timestamp and has no
        # use for per-run times.
        "check_runs": {
            name: {
                "conclusion": run.get("conclusion") or "",
                "failed_attempts": run.get("failed_attempts", 0),
            }
            for name, run in runs.items()
        },
    }


def timeline_events_from_doc(doc: ActivityDoc) -> list[dict[str, Any]]:
    """Project the document into the judge's activity timeline, oldest first.

    Lifecycle entries pass through unchanged (``event_type``, ``timestamp`` = the
    arrival ``ts``, ``payload``); each checks group — one per check suite, mirroring
    GitHub's own completion events — collapses into one synthesized
    ``check_suite_completed`` timestamped at its ``last_event_at``. The merged list
    is sorted by timestamp, matching the legacy forward's shape — only the check
    events are pre-collapsed (what Seer's timeline does anyway).

    Check groups are trimmed per head (``MAX_FORWARDED_GROUPS_PER_HEAD``,
    failures kept first — see ``_forward_priority``); no head is ever dropped.
    """
    events: list[dict[str, Any]] = [
        {
            "event_type": entry["event_type"],
            "timestamp": entry["ts"],
            "payload": entry.get("payload") or {},
        }
        for entry in doc.get("events", [])
    ]

    by_head: dict[str, list[CheckGroup]] = {}
    for group in doc.get("checks", {}).values():
        by_head.setdefault(group.get("head_sha") or "", []).append(group)

    groups: list[CheckGroup] = []
    for head_sha, head_groups in by_head.items():
        if len(head_groups) > MAX_FORWARDED_GROUPS_PER_HEAD:
            logger.warning(
                "pr_metrics.activity_doc.forward_head_groups_capped",
                extra={
                    "head_sha": head_sha,
                    "dropped": len(head_groups) - MAX_FORWARDED_GROUPS_PER_HEAD,
                },
            )
            metrics.incr("pr_metrics.activity_doc.forward_head_groups_capped", sample_rate=1.0)
            head_groups = sorted(head_groups, key=_forward_priority)[
                -MAX_FORWARDED_GROUPS_PER_HEAD:
            ]
        groups.extend(head_groups)

    if len(groups) > MAX_FORWARDED_CHECK_GROUPS:
        dropped = len(groups) - MAX_FORWARDED_CHECK_GROUPS
        logger.warning(
            "pr_metrics.activity_doc.forward_groups_capped",
            extra={"check_groups": len(groups), "dropped": dropped},
        )
        metrics.incr("pr_metrics.activity_doc.forward_groups_capped", sample_rate=1.0)
        groups = sorted(groups, key=_forward_priority)[-MAX_FORWARDED_CHECK_GROUPS:]

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


# Reviewer engagement for the NO_REVIEWER_ENGAGEMENT diagnosis label. Narrower
# than tasks.ENGAGING_ACTIVITY_TYPES, which also counts PR-author actions with
# no reviewer involved. Shared by has_reviewer_engagement (document) and
# detect_stale_pull_requests_task's legacy-track check (PullRequestActivity
# rows), so both tracks use the same definition.
REVIEWER_ENGAGEMENT_ACTIVITY_TYPES = frozenset(
    {
        PullRequestActivityType.REVIEW_SUBMITTED,
        PullRequestActivityType.REVIEW_REQUESTED,
    }
)


def has_reviewer_engagement(doc: Mapping[str, Any]) -> bool:
    """Whether ``doc`` records any reviewer engagement throughout the PR's lifetime.

    A capped ``events_dropped`` doc reads as engaged rather than risk a false
    NO_REVIEWER_ENGAGEMENT label off an incomplete record.
    """
    if doc.get("events_dropped"):
        return True

    for entry in doc.get("events") or ():
        if entry.get("event_type") in REVIEWER_ENGAGEMENT_ACTIVITY_TYPES:
            return True
    return False
