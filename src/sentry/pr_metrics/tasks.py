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
from sentry.pr_metrics.emit import emit_pr_metrics_row
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


_STALE_BATCH_SIZE = 500
STALENESS_WINDOW = timedelta(weeks=4)

# Activity types that count as "engagement" for staleness purposes.
# Chosen for low bot-risk: all four require deliberate human action on the PR.
_ENGAGING_ACTIVITY_TYPES = (
    PullRequestActivityType.SYNCHRONIZED,
    PullRequestActivityType.REVIEW_SUBMITTED,
    PullRequestActivityType.READY_FOR_REVIEW,
    PullRequestActivityType.REVIEW_REQUESTED,
)


def find_stale_pull_requests(*, cutoff: datetime) -> list[int]:
    """IDs of tracked open PRs with no engaging activity since ``cutoff``.

    A PR is a staleness candidate when:
    - It has ≥1 valid ``PullRequestAttribution`` row (tracked).
    - Its ``PullRequestMetrics.verdict`` is ``NULL`` — not yet judged or closed.
      ``JUDGE_IN_PROGRESS`` is non-NULL so those PRs are excluded naturally.
    - It was opened in the window (cutoff - STALENESS_WINDOW, cutoff) — between
      one and two staleness windows ago. PRs older than 2× the window are ignored:
      they've had long enough to be caught by a previous run.
    - It has no engaging activity (SYNCHRONIZED, REVIEW_SUBMITTED, READY_FOR_REVIEW,
      REVIEW_REQUESTED) with ``date_added >= cutoff``.

    The activity check is a correlated ``Exists`` subquery so the whole scan
    stays in the DB — no Python-side iteration over candidates.

    Returns a list of ``PullRequest`` primary keys, not ORM instances, so the
    caller can process them in batches without holding a large queryset open.
    """
    recent_engaging_activity = PullRequestActivity.objects.filter(
        pull_request=OuterRef("pk"),
        event_type__in=_ENGAGING_ACTIVITY_TYPES,
        date_added__gte=cutoff,
    )

    qs = (
        PullRequest.objects.filter(
            state="open",
            date_added__lt=cutoff,
            date_added__gte=cutoff - STALENESS_WINDOW,
            pullrequestattribution__is_valid=True,
            metrics__verdict__isnull=True,
        )
        .filter(~Exists(recent_engaging_activity))
        .values_list("id", flat=True)
        .distinct()
    )
    return list(qs)


@instrumented_task(
    name="sentry.pr_metrics.tasks.detect_stale_pull_requests",
    namespace=seer_code_review_tasks,
    silo_mode=SiloMode.CELL,
)
def detect_stale_pull_requests_task() -> None:
    """Find and settle tracked PRs with no engaging activity since ``cutoff``.

    Each candidate is claimed as ``abandoned`` and emitted directly. The judge
    path does not support open PRs (requires ``closed_at``), so all stale PRs
    are settled here regardless of historical engagement.

    Each candidate is guarded by a compare-and-set claim before any action, so
    an overlapping run or redelivery won't double-process.

    Feature-gated per organization by ``organizations:pr-metrics-emit`` and
    ``organizations:pr-metrics-activity`` — both must be on. Without activity
    tracking we can't distinguish an engaged PR from an untouched one.
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

            # Without activity tracking we can't distinguish an engaged PR from
            # an untouched one, so we can't safely emit an abandoned verdict.
            if not features.has("organizations:pr-metrics-activity", org):
                continue

            # Ensure the metrics row exists before any compare-and-set claim.
            # A stale PR may never have reached a close/merge webhook so the
            # row may not exist yet.
            PullRequestMetrics.objects.get_or_create(pull_request=pr)

            if not _claim_terminal_event(pr, PullRequestVerdict.ABANDONED):
                metrics.incr("pr_metrics.stale.skipped", tags={"reason": "already_claimed"})
                continue
            if emit_pr_metrics_row(pull_request=pr):
                emitted += 1

    metrics.incr("pr_metrics.stale.emitted", amount=emitted)
    logger.info("pr_metrics.stale.emitted", extra={"count": emitted})
