"""Idempotency guard for self-chaining taskworker tasks.

Self-chaining tasks (e.g. ``merge_groups``, ``unmerge``) produce their next activation via
``.delay()`` before the worker records the current one COMPLETE. Because taskbroker is
at-least-once, an activation whose COMPLETE does not reach the broker before its processing
deadline is re-pent (redelivered). A re-pend of an activation that already produced its child
yields a *duplicate* child, turning a linear chain into an exponential branching process.

This module provides two abstractions to guard against duplicate children:

``@selfchaining_task(key=...)``
    Decorator (applied *below* ``@instrumented_task``) that checks ``already_spawned`` at the
    top of the task and early-returns on duplicate redelivery. It also sets a contextvar so that
    ``selfchain()`` can mark the activation as spawned without the caller threading IDs around.

``selfchain(task)``
    Returns a thin proxy around a ``Task`` whose ``.delay()`` / ``.apply_async()`` call the
    real method *and then* mark the current activation as spawned. The proxy preserves the
    ``Task[P, R]`` type, so ``.delay()`` calls remain fully type-checked.

The guard is best-effort de-amplification, not exactly-once: it fails open (never blocks or drops
a chain) on Redis errors or when disabled.
"""

from __future__ import annotations

import functools
import logging
from collections.abc import Callable
from contextvars import ContextVar
from typing import Any, Generic

from django.conf import settings
from redis.client import StrictRedis
from redis.exceptions import RedisError
from sentry_redis_tools.clients import RedisCluster
from taskbroker_client.task import P, R, Task

from sentry import options
from sentry.utils import metrics, redis

logger = logging.getLogger(__name__)

_selfchain_ctx: ContextVar[tuple[str, str] | None] = ContextVar("_selfchain_ctx", default=None)


def _client() -> RedisCluster[str] | StrictRedis[str]:
    return redis.redis_clusters.get(settings.SENTRY_SELFCHAIN_IDEMPOTENCY_REDIS_CLUSTER)


def _redis_key(task_key: str, activation_id: str) -> str:
    return f"tw:selfchain:{task_key}:{activation_id}"


def already_spawned(task_key: str, activation_id: str) -> bool:
    """Return True if this activation already produced its chained child in a prior delivery.

    Fails open (returns False) on any Redis error or when disabled.
    """
    if not options.get("taskworker.selfchain_idempotency.enabled"):
        return False
    try:
        return _client().get(_redis_key(task_key, activation_id)) is not None
    except RedisError:
        logger.warning("taskworker.selfchain.redis_error", exc_info=True)
        return False


def mark_spawned(task_key: str, activation_id: str) -> None:
    """Record that this activation has produced its chained child.

    Fails open (no-op) on any Redis error or when disabled.
    """
    if not options.get("taskworker.selfchain_idempotency.enabled"):
        return
    ttl = options.get("taskworker.selfchain_idempotency.ttl")
    try:
        _client().set(_redis_key(task_key, activation_id), "1", nx=True, ex=ttl)
    except RedisError:
        logger.warning("taskworker.selfchain.redis_error", exc_info=True)


def _mark_spawned_from_ctx() -> None:
    """Mark the current activation as spawned using the contextvar set by ``@selfchaining_task``."""
    ctx = _selfchain_ctx.get()
    if ctx is not None:
        mark_spawned(*ctx)


# ---------------------------------------------------------------------------
# Decorator
# ---------------------------------------------------------------------------


def selfchaining_task(key: str | None = None) -> Callable[[Callable[P, R]], Callable[P, R]]:
    """Decorator that guards a task against duplicate redelivery.

    Apply *below* ``@instrumented_task`` so it receives the ``Task``::

        @instrumented_task(name="...", namespace=..., ...)
        @selfchaining_task()
        def my_task(project_id: int, ...) -> None:
            ...
            selfchain(my_task).delay(project_id=project_id, ...)

    ``key`` defaults to the task's registered name. Pass it explicitly only for
    backward compatibility with existing Redis markers.
    """

    def decorator(func: Callable[P, R]) -> Callable[P, R]:
        # At runtime func is a Task (applied below @instrumented_task).
        # The signature uses Callable so mypy sees correct types at both
        # decoration time (before @instrumented_task runs) and call sites.
        task: Task[P, R] = func  # type: ignore[assignment]
        resolved_key = key if key is not None else task.name
        original = task._func

        @functools.wraps(original)
        def wrapper(*args: P.args, **kwargs: P.kwargs) -> R:
            from taskbroker_client.state import current_task

            task_state = current_task()
            activation_id = task_state.id if task_state else None

            if activation_id and already_spawned(resolved_key, activation_id):
                logger.info(
                    "taskworker.selfchain.duplicate_skipped",
                    extra={"task_key": resolved_key, "activation_id": activation_id},
                )
                metrics.incr("taskworker.selfchain.duplicate_skipped", tags={"task": resolved_key})
                return None  # type: ignore[return-value]

            token = _selfchain_ctx.set((resolved_key, activation_id) if activation_id else None)
            try:
                return original(*args, **kwargs)
            finally:
                _selfchain_ctx.reset(token)

        task._func = wrapper
        return task

    return decorator


# ---------------------------------------------------------------------------
# Typed spawn proxy
# ---------------------------------------------------------------------------


class SelfchainProxy(Generic[P, R]):
    """Proxy that calls ``mark_spawned`` after dispatching a task.

    Preserves the ``Task[P, R]`` type signature on ``.delay()``.
    """

    __slots__ = ("_task",)

    def __init__(self, task: Task[P, R]) -> None:
        self._task = task

    def delay(self, *args: P.args, **kwargs: P.kwargs) -> None:
        self._task.delay(*args, **kwargs)
        _mark_spawned_from_ctx()

    def apply_async(self, **kwargs: Any) -> None:
        self._task.apply_async(**kwargs)
        _mark_spawned_from_ctx()


def selfchain(task: Task[P, R]) -> SelfchainProxy[P, R]:
    """Wrap a task so that ``.delay()`` / ``.apply_async()`` also marks the
    current activation as spawned.

    Must be called inside a ``@selfchaining_task``-decorated function.
    """
    return SelfchainProxy(task)
