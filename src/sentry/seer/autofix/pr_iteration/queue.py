from __future__ import annotations

import logging
import uuid
from typing import ContextManager

from pydantic import BaseModel, Field, ValidationError

from sentry.locks import locks
from sentry.seer.agent.client_models import SeerRunState
from sentry.seer.autofix.constants import AutofixReferrer
from sentry.seer.autofix.pr_iteration.emit import emit_pr_iteration_details_started
from sentry.seer.autofix.pr_iteration.feedback import Feedback
from sentry.seer.autofix.pr_iteration.logs import PrIterationLogContext
from sentry.utils.locking import UnableToAcquireLock
from sentry.utils.locking.lock import Lock
from sentry.utils.redis import redis_clusters

logger = logging.getLogger(__name__)

_QUEUE_TTL_SECONDS = 60 * 60 * 24
_REDIS_CLUSTER = "default"
_QUEUE_LOCK_DURATION = 5
_QUEUE_LOCK_INITIAL_DELAY = 0.05
_QUEUE_LOCK_TIMEOUT = 2


def new_consume_id() -> str:
    return uuid.uuid4().hex


class QueuedAutofixFeedback(BaseModel):
    organization_id: int
    group_id: int
    feedback: Feedback
    referrer: AutofixReferrer
    actor_user_id: int | None = None
    consume_id: str = Field(default_factory=new_consume_id)


def _feedback_queue_key(run_id: int) -> str:
    return f"autofix:feedback:{run_id}"


def _queue_lock(run_id: int) -> Lock:
    return locks.get(
        f"autofix:feedback:queue:{run_id}",
        duration=_QUEUE_LOCK_DURATION,
        name="autofix_feedback_queue",
    )


def _holding_queue_lock(run_id: int) -> ContextManager[None]:
    return _queue_lock(run_id).blocking_acquire(
        initial_delay=_QUEUE_LOCK_INITIAL_DELAY,
        timeout=_QUEUE_LOCK_TIMEOUT,
    )


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
        payload = item.json()
        try:
            with _holding_queue_lock(run_id):
                queue_length = redis.rpush(key, payload)
                redis.expire(key, _QUEUE_TTL_SECONDS)
        except UnableToAcquireLock:
            logger.warning(
                "autofix.feedback_queue.lock_timeout",
                extra={"run_id": run_id, "organization_id": organization_id},
            )
            queue_length = redis.rpush(key, payload)
            redis.expire(key, _QUEUE_TTL_SECONDS)

        if queue_length == 1:
            _emit_started(run_id=run_id, item=item)

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


def _emit_started(*, run_id: int, item: QueuedAutofixFeedback) -> None:
    try:
        emit_pr_iteration_details_started(
            run_id=run_id,
            organization_id=item.organization_id,
            group_id=item.group_id,
            consume_id=item.consume_id,
            feedback=item.feedback,
            referrer=item.referrer.value,
        )
    except Exception:
        logger.exception(
            "autofix.feedback_queue.started_emit_failed",
            extra={"run_id": run_id, "organization_id": item.organization_id},
        )


def clear_queued_autofix_feedback(run_id: int) -> None:
    redis = redis_clusters.get(_REDIS_CLUSTER)
    with _holding_queue_lock(run_id):
        redis.delete(_feedback_queue_key(run_id))


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
    redis = redis_clusters.get(_REDIS_CLUSTER)
    key = _feedback_queue_key(run_id)
    with _holding_queue_lock(run_id):
        raw_items = redis.lrange(key, 0, -1)
        if raw_items:
            redis.delete(key)

    return [item for item in (_parse_queued_item(raw) for raw in raw_items) if item is not None]
