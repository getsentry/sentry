"""Async tasks for the PR metrics pipeline."""

from __future__ import annotations

import logging
import time
from datetime import datetime, timedelta
from typing import TypeVar

from django.conf import settings
from django.db import Error as DjangoDBError
from django.db import OperationalError, router
from django.db.models import Exists, OuterRef, QuerySet
from django.utils import timezone as dj_timezone
from taskbroker_client.retry import Retry
from urllib3.exceptions import HTTPError

from sentry import features, options
from sentry.models.organization import Organization
from sentry.models.pullrequest import (
    PullRequest,
    PullRequestActivity,
    PullRequestActivityLog,
    PullRequestActivityType,
    PullRequestAttribution,
    PullRequestMetrics,
    PullRequestVerdict,
)
from sentry.models.repository import Repository
from sentry.pr_metrics.activity_doc import (
    REVIEWER_ENGAGEMENT_ACTIVITY_TYPES,
    has_reviewer_engagement,
)
from sentry.pr_metrics.emit import NO_REVIEWER_ENGAGEMENT, emit_pr_metrics_row
from sentry.pr_metrics.judge import forward_pr_to_seer_judge, reap_stuck_judge_verdicts
from sentry.pr_metrics.utils import unattributed_activity_cutoff
from sentry.silo.base import SiloMode
from sentry.tasks.base import instrumented_task
from sentry.taskworker.namespaces import seer_code_review_tasks
from sentry.utils import metrics
from sentry.utils.db import statement_timeout

logger = logging.getLogger(__name__)

MAX_RETRIES = 5
DELAY_BETWEEN_RETRIES = 60  # seconds

# The two activity stores are structurally identical for sweeping purposes: both
# hang off a PR and carry a date to age them by.
_ActivityStore = TypeVar("_ActivityStore", PullRequestActivity, PullRequestActivityLog)

# Per-run bounds on one store's sweep. The batch bounds cap the delete pressure a
# run applies (50k rows); the budget caps how long it may spend applying it. Size
# them off backlog_lag_seconds — a run pinned at the batch cap says more work
# exists, not how much.
_SWEEP_BATCH_SIZE = 1000
_SWEEP_MAX_BATCHES = 50
SWEEP_STORE_BUDGET = timedelta(seconds=240)

# Both stores' budgets plus room to report on them. An overrun is a broker kill,
# which raises BaseException and takes the run's counters and log line with it.
SWEEP_PROCESSING_DEADLINE = int(2 * SWEEP_STORE_BUDGET.total_seconds()) + 60

# Ceiling on each backlog lookup. A pathological table should cost the gauges, not
# the deleting.
SWEEP_BACKLOG_QUERY_TIMEOUT = timedelta(seconds=5)

# forward_pr_to_seer_task's Seer call blocks for up to settings.SEER_DEFAULT_TIMEOUT.
# Give the task headroom past that instead of the taskbroker client's 10s default —
# otherwise the broker can decide the worker is dead (and redeliver the task to
# another worker) while the call is still legitimately in flight.
FORWARD_PROCESSING_DEADLINE = settings.SEER_DEFAULT_TIMEOUT + 15


@instrumented_task(
    name="sentry.pr_metrics.tasks.forward_pr_to_seer",
    # PR metrics shares the prevent-AI namespace with code review rather than
    # introducing an unrouted one; both forward PR events to the same Seer host.
    namespace=seer_code_review_tasks,
    retry=Retry(times=MAX_RETRIES, delay=DELAY_BETWEEN_RETRIES, on=(HTTPError,)),
    processing_deadline_duration=FORWARD_PROCESSING_DEADLINE,
    silo_mode=SiloMode.CELL,
)
def forward_pr_to_seer_task(
    *,
    pull_request_id: int,
    organization_id: int,
    repository_id: int,
) -> None:
    """Forward a needs-judge terminal PR event to Seer, off the webhook request path.

    The webhook claims the ``JUDGE_IN_PROGRESS`` sentinel and enqueues this; the
    forward itself is a blocking signed HTTP call, so it can't run inline in the
    webhook. Retries on a retryable Seer status (via ``forward_pr_to_seer_judge``);
    a PR or repo that vanished between enqueue and run is permanent and dropped.
    """
    log_extra = {
        "pull_request_id": pull_request_id,
        "organization_id": organization_id,
        "repository_id": repository_id,
    }
    # Scope to the claimed org+repo. The ids come from our own enqueue, but keeping
    # the lookup tenant-scoped matches the rest of the pipeline (and the callback).
    try:
        pull_request = PullRequest.objects.get(
            id=pull_request_id,
            organization_id=organization_id,
            repository_id=repository_id,
        )
    except PullRequest.DoesNotExist:
        logger.warning("pr_metrics.judge.pull_request_not_found", extra=log_extra)
        metrics.incr("pr_metrics.judge.forward_failed", tags={"reason": "pr_not_found"})
        return

    try:
        repository = Repository.objects.get(id=repository_id, organization_id=organization_id)
    except Repository.DoesNotExist:
        logger.warning("pr_metrics.judge.repository_not_found", extra=log_extra)
        metrics.incr("pr_metrics.judge.forward_failed", tags={"reason": "repo_not_found"})
        return

    forward_pr_to_seer_judge(pull_request, repository)


@instrumented_task(
    name="sentry.pr_metrics.tasks.emit_pr_metrics_cooldown",
    namespace=seer_code_review_tasks,
    retry=Retry(times=MAX_RETRIES, delay=DELAY_BETWEEN_RETRIES, on=(DjangoDBError, HTTPError)),
    silo_mode=SiloMode.CELL,
)
def emit_pr_metrics_cooldown_task(
    *,
    pull_request_id: int,
    organization_id: int,
    repository_id: int,
) -> None:
    """Settle and emit a PR's ``scm.pr.closed`` row after the post-close cooldown.

    Scheduled by ``handle_emission`` when a close/merge webhook claims the
    ``WAITING_EVENT_COOLDOWN`` sentinel. Deferring emission by the cooldown lets
    late attribution and activity settle before the verdict is chosen and the row
    read (see ``run_deferred_emission``).
    """
    log_extra = {
        "pull_request_id": pull_request_id,
        "organization_id": organization_id,
        "repository_id": repository_id,
    }

    # Scope to the claimed org+repo, matching the rest of the pipeline.
    try:
        pull_request = PullRequest.objects.get(
            id=pull_request_id,
            organization_id=organization_id,
            repository_id=repository_id,
        )
    except PullRequest.DoesNotExist:
        logger.warning("pr_metrics.cooldown.pull_request_not_found", extra=log_extra)
        metrics.incr("pr_metrics.cooldown.skipped", tags={"reason": "pr_gone"})
        return

    PullRequestMetrics.objects.filter(
        pull_request=pull_request, verdict=PullRequestVerdict.WAITING_EVENT_COOLDOWN
    ).update(verdict=None)

    try:
        organization = Organization.objects.get(id=organization_id)
    except Organization.DoesNotExist:
        logger.warning("pr_metrics.cooldown.organization_not_found", extra=log_extra)
        metrics.incr("pr_metrics.cooldown.skipped", tags={"reason": "org_gone"})
        return

    # Imported here to avoid a circular import: webhooks imports this module.
    from sentry.pr_metrics.webhooks import run_deferred_emission

    run_deferred_emission(pull_request, organization)


@instrumented_task(
    name="sentry.pr_metrics.tasks.cleanup_pr_activity",
    namespace=seer_code_review_tasks,
    silo_mode=SiloMode.CELL,
)
def cleanup_pr_activity_task(*, pull_request_id: int) -> None:
    """Delete a PR's activity after its scm.pr.closed event has been emitted.

    Enqueued by ``emit_pr_metrics_row`` once emission succeeds, and sweeps both
    stores: the legacy ``PullRequestActivity`` rows and the reduced
    ``PullRequestActivityLog`` document (only one exists for a given PR, per the
    per-PR routing). The data is no longer needed — the judge path has consumed
    it and neither store is reread after a terminal event. A failure here is safe
    to drop: the age-based cleanup command sweeps any survivors (the document
    keyed on ``date_updated``).
    """
    logger.info("pr_metrics.cleanup_activity", extra={"pull_request_id": pull_request_id})
    deleted, _ = PullRequestActivity.objects.filter(pull_request_id=pull_request_id).delete()
    metrics.incr("pr_metrics.cleanup_activity.deleted", amount=deleted)
    doc_deleted, _ = PullRequestActivityLog.objects.filter(pull_request_id=pull_request_id).delete()
    metrics.incr("pr_metrics.cleanup_activity.doc_deleted", amount=doc_deleted)


def _unswept(
    model: type[_ActivityStore], date_field: str, cutoff: datetime, frontier: datetime | None
) -> QuerySet[_ActivityStore]:
    """The rows this sweep may still delete, oldest first.

    Attributed PRs are excluded in the query rather than after it so they can't
    occupy batch slots. They cluster at the head, since the emit path sweeps them
    once they emit.

    ``frontier`` is how far this run has advanced. Everything before it is deleted
    or attributed, so resuming there stops a run costing the square of its batch
    count. Inclusive, so rows sharing the boundary timestamp are re-read, not
    skipped.
    """
    attributed = PullRequestAttribution.objects.filter(
        pull_request_id=OuterRef("pull_request_id"), is_valid=True
    )
    queryset = model.objects.filter(**{f"{date_field}__lt": cutoff})
    if frontier is not None:
        queryset = queryset.filter(**{f"{date_field}__gte": frontier})
    return queryset.exclude(Exists(attributed)).order_by(date_field)


def _oldest_date(
    queryset: QuerySet[_ActivityStore], date_field: str, alias: str
) -> datetime | None:
    """One date off the head of the index, bounded. Raises ``OperationalError`` on expiry."""
    with statement_timeout(alias, SWEEP_BACKLOG_QUERY_TIMEOUT):
        return queryset.using(alias).values_list(date_field, flat=True).first()


def _report_backlog_query_failure(store: str, lookup: str) -> None:
    # `lookup` stays out of the tags: it would be a new tag key, which Datadog drops
    # until its tag config allows it. The log line carries it instead.
    metrics.incr(
        "pr_metrics.activity_sweep.backlog_query_failed",
        tags={"store": store},
        sample_rate=1.0,
    )
    logger.exception(
        "pr_metrics.activity_sweep.backlog_query_failed",
        extra={"store": store, "lookup": lookup},
    )


def _report_backlog_depth(
    model: type[_ActivityStore],
    date_field: str,
    cutoff: datetime,
    frontier: datetime | None,
    store: str,
) -> dict[str, float | None]:
    """Emit how much is left, and return it for the log line.

    ``deleted`` and ``capped`` describe flow only: a run that fills its budget
    reports the same whether fifty thousand rows remain or fifty million.

    - ``backlog_lag_seconds`` — how far the deletion frontier trails the cutoff.
      Zero is drained, and since the cutoff advances an hour per hour, the slope is
      the drain ETA. The existing ``postgresql.live_rows`` gauge cannot stand in: it
      counts the whole table, so it floors at the attributed and under-cutoff rows
      the sweep may never delete, and never reads drained.
    - ``oldest_row_age_seconds`` — age of the oldest row of any kind. The sweep can
      never delete an attributed row, so a large age against a zero lag names the
      prefix every batch query walks past.

    Each lookup is bounded and degrades on its own: measuring the backlog must not
    cost us the draining of it. The age lookup earns its own bound by starting at the
    head of the index, dead entries and all, rather than at the frontier.
    """
    alias = router.db_for_read(model)

    lag: float | None = None
    try:
        oldest_unswept = _oldest_date(
            _unswept(model, date_field, cutoff, frontier), date_field, alias
        )
    except OperationalError:
        _report_backlog_query_failure(store, "lag")
    else:
        # A drained store has no unswept row: that is a lag of zero, not an absent
        # reading — the gauge is meant to bottom out.
        lag = (cutoff - oldest_unswept).total_seconds() if oldest_unswept is not None else 0.0
        metrics.gauge(
            "pr_metrics.activity_sweep.backlog_lag_seconds",
            lag,
            tags={"store": store},
            sample_rate=1.0,
            unit="second",
        )

    age: float | None = None
    try:
        oldest_row = _oldest_date(model.objects.order_by(date_field), date_field, alias)
    except OperationalError:
        _report_backlog_query_failure(store, "age")
    else:
        # An empty store has no oldest row; zero would read as "a row arrived just now".
        if oldest_row is not None:
            age = (dj_timezone.now() - oldest_row).total_seconds()
            metrics.gauge(
                "pr_metrics.activity_sweep.oldest_row_age_seconds",
                age,
                tags={"store": store},
                sample_rate=1.0,
                unit="second",
            )

    return {"backlog_lag_seconds": lag, "oldest_row_age_seconds": age}


def _sweep_activity_store(model: type[_ActivityStore], date_field: str, cutoff: datetime) -> None:
    """Delete one store's rows for unattributed PRs, oldest first, within budget.

    The four ways a run can end report distinctly, because they call for different
    responses: drained is healthy, ``capped`` wants a bigger batch cap, ``timed_out``
    says the database slowed rather than that the backlog grew, and ``aborted`` says
    someone switched the sweep off. Only ``_report_backlog_depth`` says how far
    behind any of them leaves us.

    The batch cap alone cannot hold the run inside its processing deadline — a batch
    costs whatever the database charges for it that minute — so the run also carries
    a wall-clock budget, checked between batches.

    ``cleanup.abort_execution`` stops the sweep — the switch the cleanup command
    honours, re-read per batch so it halts a run already in flight.

    Counters are unsampled: ``deleted`` passes an ``amount``, which the default 10%
    rate restates as ten times one surviving packet.
    """
    store = model.__name__
    started = time.monotonic()
    deadline = started + SWEEP_STORE_BUDGET.total_seconds()
    deleted_total = 0
    batches = 0
    frontier: datetime | None = None
    capped = True
    aborted = False
    timed_out = False
    for _ in range(_SWEEP_MAX_BATCHES):
        if options.get("cleanup.abort_execution"):
            aborted = True
            capped = False
            break
        if time.monotonic() >= deadline:
            timed_out = True
            capped = False
            break
        rows = list(
            _unswept(model, date_field, cutoff, frontier).values_list("id", date_field)[
                :_SWEEP_BATCH_SIZE
            ]
        )
        if not rows:
            capped = False
            break
        deleted, _ = model.objects.filter(id__in=[row[0] for row in rows]).delete()
        deleted_total += deleted
        batches += 1
        frontier = rows[-1][1]
        if len(rows) < _SWEEP_BATCH_SIZE:
            # A short batch drains the queue; stop rather than re-query, and don't
            # report a cap that isn't real when work ends on the last iteration.
            capped = False
            break

    backlog = _report_backlog_depth(model, date_field, cutoff, frontier, store)

    metrics.incr(
        "pr_metrics.activity_sweep.deleted",
        amount=deleted_total,
        tags={"store": store},
        sample_rate=1.0,
    )
    # `capped` is binary; the batch count is what separates a backlog draining from a
    # store idling well under its cap.
    metrics.gauge(
        "pr_metrics.activity_sweep.batches_used", batches, tags={"store": store}, sample_rate=1.0
    )
    if aborted:
        metrics.incr("pr_metrics.activity_sweep.aborted", tags={"store": store}, sample_rate=1.0)
    elif timed_out:
        metrics.incr("pr_metrics.activity_sweep.timed_out", tags={"store": store}, sample_rate=1.0)
    elif capped:
        metrics.incr("pr_metrics.activity_sweep.capped", tags={"store": store}, sample_rate=1.0)
    logger.info(
        "pr_metrics.activity_sweep",
        extra={
            "store": store,
            "deleted": deleted_total,
            "batches": batches,
            "capped": capped,
            "timed_out": timed_out,
            "aborted": aborted,
            "duration_ms": int((time.monotonic() - started) * 1000),
            "cutoff": cutoff.isoformat(),
            **backlog,
        },
    )


@instrumented_task(
    name="sentry.pr_metrics.tasks.sweep_unattributed_pr_activity",
    namespace=seer_code_review_tasks,
    processing_deadline_duration=SWEEP_PROCESSING_DEADLINE,
    silo_mode=SiloMode.CELL,
)
def sweep_unattributed_pr_activity_task() -> None:
    """Delete activity belonging to PRs that never earned attribution.

    Emission is gated on a valid ``PullRequestAttribution``, so an unattributed PR
    can never emit and no reader ever consumes its activity: the judge only runs
    off emission, and ``find_stale_pull_requests`` filters to attributed PRs.
    ``is_activity_tracking_enabled`` nonetheless collects for *every* PR inside the
    attribution buffer, and untracked PRs are the overwhelming majority of the
    webhook firehose — so absent this sweep they are the overwhelming majority of
    both stores, held until the cleanup command reaps them as children of a PR row
    that itself has to go 90 days cold first.

    Only activity that has been quiet for a full attribution buffer is swept. That
    window is what makes "unattributed" durable rather than merely current:
    attribution had a complete chance to arrive and didn't, and the tracking gate
    has since stopped writing, so the set can neither grow nor become readable. A
    PR that beats that — attribution landing after the sweep, then a redelivered
    close — would emit off an empty store, which reads as a hollow row rather than
    no row (``load_activity_document`` treats a missing document as "fall back to
    the legacy rows"). Requiring the quiet window is what keeps that off the table.

    Deliberately not driven off the terminal-event webhook: doing it there would
    cost one task per untracked closed PR, and would still miss PRs that never
    close and orgs running activity collection without emission.
    """
    cutoff = unattributed_activity_cutoff()
    # Each store ages by its own clock: a legacy row is one immutable event, while
    # the document is rewritten in place, so only its last write dates it.
    _sweep_activity_store(PullRequestActivity, "date_added", cutoff)
    _sweep_activity_store(PullRequestActivityLog, "date_updated", cutoff)


@instrumented_task(
    name="sentry.pr_metrics.tasks.reap_stuck_judge_verdicts",
    namespace=seer_code_review_tasks,
    silo_mode=SiloMode.CELL,
)
def reap_stuck_judge_verdicts_task() -> None:
    """Daily sweep settling ``PullRequestMetrics`` rows stuck at ``JUDGE_IN_PROGRESS``.

    See ``reap_stuck_judge_verdicts`` for the settling logic and its bounds.
    """
    reap_stuck_judge_verdicts()


# Batch size for the per-candidate settle loop in detect_stale_pull_requests_task.
_STALE_BATCH_SIZE = 100
# Mirrors reap_stuck_judge_verdicts's _REAP_BATCH_SIZE: caps a first/backlogged
# run so it can't pull an unbounded candidate set into memory at once.
_STALE_SCAN_LIMIT = 500
STALENESS_WINDOW = timedelta(weeks=4)

# Resets the stale clock in find_stale_pull_requests. Narrower reviewer-only
# subset: REVIEWER_ENGAGEMENT_ACTIVITY_TYPES (activity_doc), used for the
# NO_REVIEWER_ENGAGEMENT label.
ENGAGING_ACTIVITY_TYPES = frozenset(
    {
        PullRequestActivityType.SYNCHRONIZED,
        PullRequestActivityType.REVIEW_SUBMITTED,
        PullRequestActivityType.READY_FOR_REVIEW,
        PullRequestActivityType.REVIEW_REQUESTED,
    }
)


def find_stale_pull_requests(*, cutoff: datetime) -> list[int]:
    """IDs of tracked, open, unverdicted PRs opened before ``cutoff`` with no
    engaging activity since then, from either activity store.

    Legacy ``PullRequestActivity`` rows are checked directly; a document-track
    PR (see ``webhooks._use_activity_document``) never writes those rows, so
    it's checked via ``PullRequestActivityLog.date_updated`` instead — coarser,
    since any write (not just an engaging one) resets it, but a false negative
    here only delays detection, whereas a false positive would wrongly abandon
    an engaged PR.

    Capped at ``_STALE_SCAN_LIMIT``, oldest-opened first, so an unbounded
    backlog can't be pulled into memory in one run; settled PRs drop out of
    future scans as their verdict is written.
    """
    recent_engaging_activity = PullRequestActivity.objects.filter(
        pull_request=OuterRef("pk"),
        event_type__in=ENGAGING_ACTIVITY_TYPES,
        date_added__gte=cutoff,
    )
    recently_updated_activity_log = PullRequestActivityLog.objects.filter(
        pull_request=OuterRef("pk"),
        date_updated__gte=cutoff,
    )

    qs = (
        PullRequest.objects.filter(
            state="open",
            date_added__lt=cutoff,
            pullrequestattribution__is_valid=True,
            metrics__verdict__isnull=True,
        )
        .filter(~Exists(recent_engaging_activity))
        .filter(~Exists(recently_updated_activity_log))
        .order_by("date_added")
        .values_list("id", flat=True)
        .distinct()[:_STALE_SCAN_LIMIT]
    )
    return list(qs)


@instrumented_task(
    name="sentry.pr_metrics.tasks.detect_stale_pull_requests",
    namespace=seer_code_review_tasks,
    silo_mode=SiloMode.CELL,
)
def detect_stale_pull_requests_task() -> None:
    """Claim each stale-candidate PR as ``abandoned`` and emit it directly —
    the judge path requires ``closed_at`` and doesn't support open PRs.

    ``NO_REVIEWER_ENGAGEMENT`` diagnosis checks each PR's full history, not
    just the detection window: ``has_reviewer_engagement`` on the document, or
    ``REVIEWER_ENGAGEMENT_ACTIVITY_TYPES`` against legacy rows otherwise —
    fetched per batch since pulling every document at once isn't bounded.

    Feature-gated per org by ``pr-metrics``.
    """
    # Imported here to avoid a circular import: webhooks imports this module.
    from sentry.pr_metrics.webhooks import _claim_terminal_event

    cutoff = dj_timezone.now() - STALENESS_WINDOW
    pr_ids = find_stale_pull_requests(cutoff=cutoff)
    metrics.incr("pr_metrics.stale.candidates", amount=len(pr_ids))
    logger.info("pr_metrics.stale.candidates", extra={"count": len(pr_ids)})

    emitted = 0
    for batch_start in range(0, len(pr_ids), _STALE_BATCH_SIZE):
        batch = pr_ids[batch_start : batch_start + _STALE_BATCH_SIZE]
        pull_requests = list(PullRequest.objects.filter(id__in=batch))
        org_ids = {pr.organization_id for pr in pull_requests}
        orgs_by_id = {o.id: o for o in Organization.objects.filter(id__in=org_ids)}

        candidate_prs = []
        for pr in pull_requests:
            org = orgs_by_id.get(pr.organization_id)
            if org is None:
                logger.warning(
                    "pr_metrics.stale.org_not_found",
                    extra={"pull_request_id": pr.id, "organization_id": pr.organization_id},
                )
                continue

            if not features.has("organizations:pr-metrics", org):
                continue

            candidate_prs.append(pr)

        doc_by_pr_id = dict(
            PullRequestActivityLog.objects.filter(
                pull_request_id__in=[pr.id for pr in candidate_prs]
            ).values_list("pull_request_id", "data")
        )

        # One query for all legacy-track candidates rather than one Exists()
        # per PR, mirroring the doc fetch above.
        legacy_candidate_ids = [pr.id for pr in candidate_prs if pr.id not in doc_by_pr_id]
        engaged_legacy_pr_ids = set(
            PullRequestActivity.objects.filter(
                pull_request_id__in=legacy_candidate_ids,
                event_type__in=REVIEWER_ENGAGEMENT_ACTIVITY_TYPES,
            )
            .values_list("pull_request_id", flat=True)
            .distinct()
        )

        for pr in candidate_prs:
            # A stale PR may never have reached a close/merge webhook, so the
            # metrics row may not exist yet.
            PullRequestMetrics.objects.get_or_create(pull_request=pr)

            if not _claim_terminal_event(pr, PullRequestVerdict.ABANDONED):
                metrics.incr("pr_metrics.stale.skipped", tags={"reason": "already_claimed"})
                continue

            diagnosis_labels = []
            doc = doc_by_pr_id.get(pr.id)
            if doc is not None:
                if not has_reviewer_engagement(doc):
                    diagnosis_labels.append(NO_REVIEWER_ENGAGEMENT)
            elif pr.id not in engaged_legacy_pr_ids:
                diagnosis_labels.append(NO_REVIEWER_ENGAGEMENT)

            # The claim above stands regardless of what happens here, so a
            # failed emission isn't retried — same trade-off as
            # webhooks._claim_and_emit. Guarded so one bad candidate can't
            # abort the rest of the batch.
            try:
                if emit_pr_metrics_row(pull_request=pr, diagnosis_labels=diagnosis_labels):
                    emitted += 1
            except Exception:
                logger.exception("pr_metrics.stale.emit_failed", extra={"pull_request_id": pr.id})
                metrics.incr("pr_metrics.stale.emit_failed")

    metrics.incr("pr_metrics.stale.emitted", amount=emitted)
    logger.info("pr_metrics.stale.emitted", extra={"count": emitted})
