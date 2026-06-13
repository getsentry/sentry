"""Async tasks for the PR metrics pipeline."""

from __future__ import annotations

import logging

from taskbroker_client.retry import Retry
from urllib3.exceptions import HTTPError

from sentry.models.pullrequest import PullRequest
from sentry.models.repository import Repository
from sentry.pr_metrics.judge import forward_pr_to_seer_judge
from sentry.silo.base import SiloMode
from sentry.tasks.base import instrumented_task
from sentry.taskworker.namespaces import seer_code_review_tasks
from sentry.utils import metrics

logger = logging.getLogger(__name__)

MAX_RETRIES = 5
DELAY_BETWEEN_RETRIES = 60  # seconds


@instrumented_task(
    name="sentry.pr_metrics.tasks.forward_pr_to_seer",
    # PR metrics shares the prevent-AI namespace with code review rather than
    # introducing an unrouted one; both forward PR events to the same Seer host.
    namespace=seer_code_review_tasks,
    retry=Retry(times=MAX_RETRIES, delay=DELAY_BETWEEN_RETRIES, on=(HTTPError,)),
    silo_mode=SiloMode.CELL,
)
def forward_pr_to_seer(
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
