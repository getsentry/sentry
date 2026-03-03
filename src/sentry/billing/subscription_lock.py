"""
Subscription locking decorator to prevent race conditions in concurrent subscription updates.

This module provides the subscription_lock decorator which ensures that subscription
state is refreshed after acquiring a lock, preventing stale WHERE conditions in
conditional UPDATE statements.
"""

from __future__ import annotations

import functools
import logging
from collections.abc import Callable
from typing import Any, TypeVar

from sentry.locks import locks
from sentry.utils.retries import TimedRetryPolicy

logger = logging.getLogger(__name__)

F = TypeVar("F", bound=Callable[..., Any])


def subscription_lock(timeout: int = 10, name: str = "subscription_update") -> Callable[[F], F]:
    """
    Decorator to acquire a lock on a subscription before executing the wrapped function.

    This decorator:
    1. Acquires a distributed lock on the subscription
    2. Refreshes the subscription state from the database to ensure fresh values
    3. Clears any cached options to prevent stale data
    4. Executes the wrapped function with the lock held

    This prevents race conditions where:
    - Process A reads subscription state (plan=old, billing_period_end=T1)
    - Process B modifies subscription (plan=new, billing_period_end=T2)
    - Process A tries to UPDATE with WHERE conditions matching (plan=old, billing_period_end=T1)
    - The UPDATE fails because the row has changed

    Args:
        timeout: Lock acquisition timeout in seconds
        name: Lock name for debugging/metrics

    Usage:
        @subscription_lock(timeout=10)
        def update_subscription(subscription, **kwargs):
            # subscription is now guaranteed to have fresh database values
            updates.apply(subscription)
    """

    def decorator(func: F) -> F:
        @functools.wraps(func)
        def wrapper(*args: Any, **kwargs: Any) -> Any:
            # Find the subscription in the arguments
            subscription = None
            if args and hasattr(args[0], "id") and hasattr(args[0], "plan"):
                # First positional arg looks like a subscription
                subscription = args[0]
            elif "subscription" in kwargs:
                subscription = kwargs["subscription"]

            if subscription is None:
                logger.warning(
                    "subscription_lock decorator could not find subscription in arguments"
                )
                return func(*args, **kwargs)

            # Acquire lock on the subscription
            lock_key = f"subscription:{subscription.__class__.__name__}:{subscription.id}"
            lock = locks.get(lock_key, duration=timeout, name=name)

            with TimedRetryPolicy(timeout)(lock.acquire):
                # CRITICAL FIX: Refresh subscription state after acquiring lock
                # This ensures that the subscription object has the latest values from the
                # database, preventing stale WHERE conditions in conditional UPDATEs
                subscription.refresh_from_db()

                # Also clear the options cache if the model has one
                # This prevents using stale cached subscription options
                if hasattr(subscription, "_SubscriptionModel__options"):
                    delattr(subscription, "_SubscriptionModel__options")

                # Now execute the function with fresh subscription state
                return func(*args, **kwargs)

        return wrapper  # type: ignore[return-value]

    return decorator


class SubscriptionIntegrityError(Exception):
    """
    Raised when a conditional UPDATE on a subscription fails due to stale state.

    This typically indicates a race condition where the subscription was modified
    between when it was read and when the UPDATE was attempted.
    """

    pass
