"""Async tasks for the PR metrics pipeline."""

from __future__ import annotations

import logging

from django.conf import settings
from django.db import Error as DjangoDBError
from taskbroker_client.retry import Retry
from urllib3.exceptions import HTTPError

from sentry.models.organization import Organization
from sentry.models.pullrequest import (
    PullRequest,
    PullRequestActivity,
    PullRequestMetrics,
    PullRequestVerdict,
)
from sentry.models.repository import Repository
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
    """Delete PullRequestActivity rows for a PR whose scm.pr.closed event has been emitted.

    Enqueued by ``emit_pr_metrics_row`` once emission succeeds. The rows are no
    longer needed: the judge path has consumed what it needed, and the activity
    table is not reread after a terminal event. A failure here is safe to drop —
    the existing 30-day age-based cleanup in the cleanup command will sweep any
    rows that survive.
    """
    logger.info("pr_metrics.cleanup_activity", extra={"pull_request_id": pull_request_id})
    deleted, _ = PullRequestActivity.objects.filter(pull_request_id=pull_request_id).delete()
    metrics.incr("pr_metrics.cleanup_activity.deleted", amount=deleted)


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
