from __future__ import annotations

import logging
from collections.abc import Sequence

from pydantic import BaseModel, PrivateAttr, ValidationError

from sentry.seer.agent.client_models import SeerRunState
from sentry.seer.autofix.constants import AutofixReferrer
from sentry.seer.autofix.pr_iteration.feedback import Feedback, feedback_kind
from sentry.seer.autofix.pr_iteration.logs import PrIterationLogContext
from sentry.utils import metrics
from sentry.utils.redis import load_redis_script, redis_clusters

logger = logging.getLogger(__name__)

drain_list_into = load_redis_script("utils/drain_list_into.lua")

_QUEUE_TTL_SECONDS = 60 * 60 * 24
# As long as the consume task's processing deadline: Seer has the feedback, or
# the task is gone, by then. Each drain restarts it for the whole list.
_IN_FLIGHT_TTL_SECONDS = 60
_REDIS_CLUSTER = "default"


class QueuedAutofixFeedback(BaseModel):
    organization_id: int
    group_id: int
    feedback: Feedback
    referrer: AutofixReferrer
    actor_user_id: int | None = None
    # The exact string read from Redis, so the item can be removed from a list
    # by value. Re-serializing may not match it byte for byte.
    _raw: str | None = PrivateAttr(default=None)


def _feedback_queue_key(run_id: int) -> str:
    return f"autofix:feedback:{run_id}"


def _in_flight_key(run_id: int) -> str:
    # The hash tag puts this key in the queue key's cluster slot, so one script
    # can move items between them.
    return f"{{{_feedback_queue_key(run_id)}}}:inflight"


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
    ``should_consume`` and ``automated_iteration_allowed`` keep such items out
    of the agent at drain time.
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
    client = redis_clusters.get(_REDIS_CLUSTER)
    client.delete(_feedback_queue_key(run_id))
    client.delete(_in_flight_key(run_id))


def _parse_queued_item(raw_item: str) -> QueuedAutofixFeedback | None:
    try:
        item = QueuedAutofixFeedback.parse_raw(raw_item)
    except (ValidationError, ValueError):
        logger.warning("autofix.feedback_queue.skipped_unparseable_item")
        return None
    item._raw = raw_item
    return item


def count_queued_autofix_feedback(run_id: int) -> int:
    """How many items are on this run's queue, without reading or removing them."""
    return redis_clusters.get(_REDIS_CLUSTER).llen(_feedback_queue_key(run_id))


def _read_list(key: str) -> list[QueuedAutofixFeedback]:
    redis = redis_clusters.get(_REDIS_CLUSTER)
    items: list[QueuedAutofixFeedback] = []

    for raw_item in redis.lrange(key, 0, -1):
        if (item := _parse_queued_item(raw_item)) is not None:
            items.append(item)

    return items


def peek_queued_autofix_feedback(run_id: int) -> list[QueuedAutofixFeedback]:
    return _read_list(_feedback_queue_key(run_id))


def peek_in_flight_autofix_feedback(run_id: int) -> list[QueuedAutofixFeedback]:
    """Feedback popped by a drain that Seer may not have recorded yet.

    For display only. Nothing consumes this list, so feedback in it can't run twice.
    """
    return _read_list(_in_flight_key(run_id))


def pop_queued_autofix_feedback(run_id: int) -> list[QueuedAutofixFeedback]:
    """Drain the queue, moving its items to the in-flight list for the UI.

    Without that list, feedback is in neither the queue nor a Seer block between
    this pop and Seer recording the iteration. A poll landing there sees an idle
    run with nothing queued, so the UI hides the item and slows its polling.

    The move is one script, so a poll never sees the items in neither list. Once
    Seer has an item, the UI state stops showing it (see ``ui_state``). Items
    that won't reach Seer must be taken off with
    ``release_in_flight_autofix_feedback``; the rest are left to expire.
    """
    client = redis_clusters.get(_REDIS_CLUSTER)
    raw_items = drain_list_into(
        [_feedback_queue_key(run_id), _in_flight_key(run_id)],
        [_IN_FLIGHT_TTL_SECONDS],
        client,
    )

    return [item for item in (_parse_queued_item(raw) for raw in raw_items) if item is not None]


def release_in_flight_autofix_feedback(run_id: int, items: Sequence[QueuedAutofixFeedback]) -> None:
    """Take drained feedback that won't reach Seer off the in-flight list.

    The UI shows in-flight items that no Seer block has, so without this a
    dropped item stays "queued" until the list expires, and every later drain
    restarts that clock. Removes one copy per item, by its exact Redis value.

    Display only, so a failure is logged rather than raised: it must not fail
    the drain or replace the error the drain is already handling.
    """
    if not items:
        return

    key = _in_flight_key(run_id)
    try:
        with redis_clusters.get(_REDIS_CLUSTER).pipeline() as pipe:
            for item in items:
                pipe.lrem(key, 1, item._raw if item._raw is not None else item.json())
            pipe.execute()
    except Exception:
        logger.warning("autofix.feedback_queue.release_in_flight_failed", exc_info=True)
