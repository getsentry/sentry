from __future__ import annotations

import logging

from pydantic import BaseModel, ValidationError

from sentry.seer.agent.client_models import SeerRunState
from sentry.seer.autofix.constants import AutofixReferrer
from sentry.seer.autofix.pr_iteration.feedback import Feedback
from sentry.utils.redis import redis_clusters

logger = logging.getLogger(__name__)

_QUEUE_TTL_SECONDS = 60 * 60 * 24
_REDIS_CLUSTER = "default"


class QueuedAutofixFeedback(BaseModel):
    organization_id: int
    group_id: int
    feedback: Feedback
    referrer: AutofixReferrer


def _feedback_queue_key(run_id: int) -> str:
    return f"autofix:feedback:{run_id}"


def try_enqueue_autofix_feedback(
    *,
    run_id: int,
    organization_id: int,
    group_id: int,
    feedback: Feedback,
    referrer: AutofixReferrer,
    run_state: SeerRunState,
) -> bool:
    if not feedback.source.should_queue(run_state):
        logger.info(
            "autofix.feedback_queue.skipped_stale_feedback",
            extra={
                "organization_id": organization_id,
                "group_id": group_id,
                "run_id": run_id,
            },
        )
        return False

    redis = redis_clusters.get(_REDIS_CLUSTER)
    key = _feedback_queue_key(run_id)
    redis.rpush(
        key,
        QueuedAutofixFeedback(
            organization_id=organization_id,
            group_id=group_id,
            feedback=feedback,
            referrer=referrer,
        ).json(),
    )
    redis.expire(key, _QUEUE_TTL_SECONDS)
    return True


def _parse_queued_item(raw_item: str) -> QueuedAutofixFeedback | None:
    try:
        return QueuedAutofixFeedback.parse_raw(raw_item)
    except (ValidationError, ValueError):
        logger.warning("autofix.feedback_queue.skipped_unparseable_item")
        return None


def peek_queued_autofix_feedback(run_id: int) -> list[QueuedAutofixFeedback]:
    redis = redis_clusters.get(_REDIS_CLUSTER)
    key = _feedback_queue_key(run_id)
    items: list[QueuedAutofixFeedback] = []

    for raw_item in redis.lrange(key, 0, -1):
        if (item := _parse_queued_item(raw_item)) is not None:
            items.append(item)

    return items


def pop_queued_autofix_feedback(run_id: int) -> list[QueuedAutofixFeedback]:
    redis = redis_clusters.get(_REDIS_CLUSTER)
    key = _feedback_queue_key(run_id)
    items: list[QueuedAutofixFeedback] = []

    while raw_item := redis.lpop(key):
        if (item := _parse_queued_item(raw_item)) is not None:
            items.append(item)

    return items
