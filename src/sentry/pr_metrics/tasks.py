"""Async tasks for the PR metrics pipeline."""

from __future__ import annotations

import logging
from datetime import datetime, timedelta

from django.conf import settings
from django.db import Error as DjangoDBError
from django.db.models import Exists, OuterRef
from django.utils import timezone as dj_timezone
from taskbroker_client.retry import Retry
from urllib3.exceptions import HTTPError

from sentry import features
from sentry.models.organization import Organization
from sentry.models.pullrequest import (
    PullRequest,
    PullRequestActivity,
    PullRequestActivityLog,
    PullRequestActivityType,
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
from sentry.silo.base import SiloMode
from sentry.tasks.base import instrumented_task
from sentry.taskworker.namespaces import seer_code_review_tasks
from sentry.utils import metrics

logger = logging.getLogger(__name__)

MAX_RETRIES = 5
DELAY_BETWEEN_RETRIES = 60  # seconds

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
        logger.exception("pr_metrics.cooldown.pull_request_not_found", extra=log_extra)
        metrics.incr("pr_metrics.cooldown.skipped", tags={"reason": "pr_gone"})
        return

    PullRequestMetrics.objects.filter(
        pull_request=pull_request, verdict=PullRequestVerdict.WAITING_EVENT_COOLDOWN
    ).update(verdict=None)

    try:
        organization = Organization.objects.get(id=organization_id)
    except Organization.DoesNotExist:
        logger.exception("pr_metrics.cooldown.organization_not_found", extra=log_extra)
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

    Feature-gated per org by ``pr-metrics-emit`` and ``pr-metrics-activity``
    (both required — without activity tracking we can't tell an engaged PR
    from an untouched one).
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

            if not features.has("organizations:pr-metrics-emit", org):
                continue

            if not features.has("organizations:pr-metrics-activity", org):
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
