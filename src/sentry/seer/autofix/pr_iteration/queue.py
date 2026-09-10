from __future__ import annotations

import logging

from pydantic import BaseModel, ValidationError

from sentry.seer.agent.client_models import SeerRunState
from sentry.seer.autofix.constants import AutofixReferrer
from sentry.seer.autofix.pr_iteration.emit import open_pr_iteration_details
from sentry.seer.autofix.pr_iteration.feedback import Feedback
from sentry.seer.autofix.pr_iteration.logs import PrIterationLogContext
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


def try_enqueue_autofix_feedback(
    *,
    log_ctx: PrIterationLogContext,
    run_id: int,
    organization_id: int,
    group_id: int,
    feedback: Feedback,
    referrer: AutofixReferrer,
    run_state: SeerRunState,
    actor_user_id: int | None = None,
) -> bool:
    decision = feedback.source.should_queue(run_state)

    if decision.ok:
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
            queue_length, _ = pipe.execute()

        # Landing on an empty queue starts an iteration; later feedback joins the
        # one already open, which is why the buffer is opened only here.
        if queue_length == 1:
            open_pr_iteration_details(
                log_ctx=log_ctx,
                run_state=run_state,
                organization_id=organization_id,
                group_id=group_id,
            )

    # One log name for both branches, emitted after the push so ``queued`` means
    # the feedback is actually in Redis: ``outcome`` says which way it went and
    # ``reason`` says what the gate read to get there.
    log_ctx.info(
        "autofix.pr_iteration.feedback.queue",
        outcome="queued" if decision.ok else "not_queued",
        reason=decision.reason,
        feedback_source=feedback.source.type,
        feedback_id=feedback.feedback_id,
        referrer=referrer.value,
        actor_user_id=actor_user_id,
        **feedback.source.log_fields(run_state),
    )
    return decision.ok


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
