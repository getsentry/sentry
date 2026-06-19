from __future__ import annotations

import logging

from pydantic import BaseModel, ValidationError

from sentry.seer.autofix.autofix_agent import Feedback
from sentry.seer.autofix.constants import AutofixReferrer
from sentry.utils import json
from sentry.utils.redis import redis_clusters

logger = logging.getLogger(__name__)

_QUEUE_TTL_SECONDS = 60 * 60 * 24
_REDIS_CLUSTER = "default"


class QueuedAutofixFeedback(BaseModel):
    organization_id: int
    group_id: int
    feedback: Feedback
    referrer: AutofixReferrer


def _get_feedback_queue_key(run_id: int) -> str:
    return f"autofix:feedback:{run_id}"


def enqueue_autofix_feedback(
    *,
    run_id: int,
    organization_id: int,
    group_id: int,
    feedback: Feedback,
    referrer: AutofixReferrer,
) -> None:
    redis = redis_clusters.get(_REDIS_CLUSTER)
    key = _get_feedback_queue_key(run_id)
    redis.rpush(
        key,
        json.dumps(
            QueuedAutofixFeedback(
                organization_id=organization_id,
                group_id=group_id,
                feedback=feedback,
                referrer=referrer,
            ).dict()
        ),
    )
    redis.expire(key, _QUEUE_TTL_SECONDS)


def peek_queued_autofix_feedback(run_id: int) -> list[QueuedAutofixFeedback]:
    """Read the queued feedback for a run without removing it."""
    redis = redis_clusters.get(_REDIS_CLUSTER)
    key = _get_feedback_queue_key(run_id)
    items: list[QueuedAutofixFeedback] = []

    for raw_item in redis.lrange(key, 0, -1):
        try:
            items.append(QueuedAutofixFeedback(**json.loads(raw_item)))
        except (TypeError, ValueError, ValidationError):
            logger.warning("autofix.feedback_queue.invalid_item", extra={"run_id": run_id})

    return items


def pop_queued_autofix_feedback(run_id: int) -> list[QueuedAutofixFeedback]:
    redis = redis_clusters.get(_REDIS_CLUSTER)
    key = _get_feedback_queue_key(run_id)
    items: list[QueuedAutofixFeedback] = []

    while raw_item := redis.lpop(key):
        try:
            items.append(QueuedAutofixFeedback(**json.loads(raw_item)))
        except (TypeError, ValueError, ValidationError):
            logger.warning("autofix.feedback_queue.invalid_item", extra={"run_id": run_id})

    return items
