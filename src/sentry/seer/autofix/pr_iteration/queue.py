from __future__ import annotations

import logging

from pydantic import BaseModel, ValidationError

from sentry.seer.agent.client_models import SeerRunState
from sentry.seer.autofix.constants import AutofixReferrer
from sentry.seer.autofix.pr_iteration.feedback import Feedback, feedback_kind
from sentry.seer.autofix.pr_iteration.logs import PrIterationLogContext
from sentry.utils import metrics
from sentry.utils.redis import load_redis_script, redis_clusters

logger = logging.getLogger(__name__)

drain_list = load_redis_script("utils/drain_list.lua")

_QUEUE_TTL_SECONDS = 60 * 60 * 24
_REDIS_CLUSTER = "default"


class QueuedAutofixFeedback(BaseModel):
    organization_id: int
    group_id: int
    feedback: Feedback
    referrer: AutofixReferrer
    actor_user_id: int | None = None


def _feedback_queue_key(run_id: int) -> str:
    return f"autofix:feedback:{run_id}"


def enqueue_autofix_feedback(
    *,
    log_ctx: PrIterationLogContext,
    run_id: int,
    organization_id: int,
    group_id: int,
    feedback: Feedback,
    referrer: AutofixReferrer,
    run_state: SeerRunState,
    actor_user_id: int | None = None,
) -> None:
    """Push one feedback item onto the run's queue. Unconditional.

    Nothing is filtered here: feedback that turns out to be stale or over the
    cap is still queued, so that every item reaches ``should_trigger`` and the
    reason it went nowhere is written down rather than dropped on arrival.
    ``should_consume`` keeps such items out of the agent at drain time.
    """
    item = QueuedAutofixFeedback(
        organization_id=organization_id,
        group_id=group_id,
        feedback=feedback,
        referrer=referrer,
        actor_user_id=actor_user_id,
    )

    redis = redis_clusters.get(_REDIS_CLUSTER)
    key = _feedback_queue_key(run_id)
    with redis.pipeline() as pipe:
        pipe.rpush(key, item.json())
        pipe.expire(key, _QUEUE_TTL_SECONDS)
        pipe.execute()

    metrics.incr(
        "autofix.pr_iteration.step",
        tags={
            "checkpoint": "enqueued",
            "referrer": referrer.value,
            "feedback_kind": feedback_kind([feedback]),
        },
        sample_rate=1.0,
    )

    # Emitted after the push so ``queued`` means the feedback is actually in
    # Redis.
    log_ctx.info(
        "autofix.pr_iteration.feedback.queue",
        outcome="queued",
        feedback_source=feedback.source.type,
        feedback_id=feedback.feedback_id,
        referrer=referrer.value,
        actor_user_id=actor_user_id,
        **feedback.source.log_fields(run_state),
    )


def clear_queued_autofix_feedback(run_id: int) -> None:
    redis_clusters.get(_REDIS_CLUSTER).delete(_feedback_queue_key(run_id))


def _parse_queued_item(raw_item: str) -> QueuedAutofixFeedback | None:
    try:
        return QueuedAutofixFeedback.parse_raw(raw_item)
    except (ValidationError, ValueError):
        logger.warning("autofix.feedback_queue.skipped_unparseable_item")
        return None


def count_queued_autofix_feedback(run_id: int) -> int:
    """How many items are on this run's queue, without reading or removing them."""
    return redis_clusters.get(_REDIS_CLUSTER).llen(_feedback_queue_key(run_id))


def peek_queued_autofix_feedback(run_id: int) -> list[QueuedAutofixFeedback]:
    redis = redis_clusters.get(_REDIS_CLUSTER)
    key = _feedback_queue_key(run_id)
    items: list[QueuedAutofixFeedback] = []

    for raw_item in redis.lrange(key, 0, -1):
        if (item := _parse_queued_item(raw_item)) is not None:
            items.append(item)

    return items


def pop_queued_autofix_feedback(run_id: int) -> list[QueuedAutofixFeedback]:
    client = redis_clusters.get(_REDIS_CLUSTER)
    raw_items = drain_list([_feedback_queue_key(run_id)], [], client)

    return [item for item in (_parse_queued_item(raw) for raw in raw_items) if item is not None]
