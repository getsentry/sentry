"""
Database utilities for handling statement timeouts and query errors.
"""

from __future__ import annotations

import logging
from contextlib import contextmanager
from typing import TYPE_CHECKING, Any, Callable, TypeVar

if TYPE_CHECKING:
    from collections.abc import Generator

    from django.db.utils import OperationalError

logger = logging.getLogger(__name__)

T = TypeVar("T")


@contextmanager
def handle_statement_timeout(
    *,
    fallback_value: Any = None,
    log_message: str | None = None,
    capture_exception: bool = True,
    reraise: bool = False,
) -> Generator[None, None, None]:
    """
    Context manager to handle PostgreSQL statement timeouts gracefully.
    
    This is useful for long-running queries that might exceed statement_timeout
    and need to be handled without failing the entire task.
    
    Args:
        fallback_value: Value to return if a statement timeout occurs (only meaningful
                       if used with a function wrapper)
        log_message: Optional custom log message to use when timeout occurs
        capture_exception: Whether to capture the exception to Sentry (default: True)
        reraise: Whether to re-raise the exception after handling (default: False)
    
    Example:
        ```python
        with handle_statement_timeout(log_message="Query timeout in repair task"):
            results = Subscription.objects.raw(slow_query)
            for result in results:
                process(result)
        # If timeout occurs, execution continues after the with block
        ```
    
    Example with function wrapper:
        ```python
        def get_results():
            with handle_statement_timeout(fallback_value=[]):
                return list(Subscription.objects.raw(slow_query))
            # Returns [] if timeout occurs
        ```
    """
    try:
        yield
    except Exception as exc:
        # Import here to avoid circular dependency
        from sentry.db.postgres.helpers import is_statement_timeout

        if is_statement_timeout(exc):
            if log_message:
                logger.warning(log_message, exc_info=True)
            else:
                logger.warning(
                    "Statement timeout occurred",
                    extra={
                        "error_message": str(exc),
                    },
                    exc_info=True,
                )

            if capture_exception:
                import sentry_sdk

                sentry_sdk.set_tag("db.error_type", "statement_timeout")
                sentry_sdk.capture_exception(exc, level="warning")

            if reraise:
                raise
        else:
            # Not a statement timeout, re-raise the original exception
            raise


def with_statement_timeout_handling(
    fallback_value: T | None = None,
    log_message: str | None = None,
    capture_exception: bool = True,
) -> Callable[[Callable[..., T]], Callable[..., T | None]]:
    """
    Decorator to handle PostgreSQL statement timeouts in a function.
    
    Args:
        fallback_value: Value to return if a statement timeout occurs
        log_message: Optional custom log message to use when timeout occurs
        capture_exception: Whether to capture the exception to Sentry (default: True)
    
    Example:
        ```python
        @with_statement_timeout_handling(fallback_value=[], log_message="Repair query timed out")
        def get_subscriptions():
            return list(Subscription.objects.raw(slow_query))
        
        # If timeout occurs, returns [] instead of raising
        ```
    """

    def decorator(func: Callable[..., T]) -> Callable[..., T | None]:
        def wrapper(*args: Any, **kwargs: Any) -> T | None:
            try:
                return func(*args, **kwargs)
            except Exception as exc:
                from sentry.db.postgres.helpers import is_statement_timeout

                if is_statement_timeout(exc):
                    if log_message:
                        logger.warning(log_message, exc_info=True)
                    else:
                        logger.warning(
                            f"Statement timeout in {func.__name__}",
                            extra={"error_message": str(exc)},
                            exc_info=True,
                        )

                    if capture_exception:
                        import sentry_sdk

                        sentry_sdk.set_tag("db.error_type", "statement_timeout")
                        sentry_sdk.set_context(
                            "statement_timeout",
                            {
                                "function": func.__name__,
                                "fallback_value_type": type(fallback_value).__name__,
                            },
                        )
                        sentry_sdk.capture_exception(exc, level="warning")

                    return fallback_value
                else:
                    raise

        return wrapper

    return decorator


def execute_with_timeout_handling(
    func: Callable[..., T],
    *args: Any,
    fallback_value: T | None = None,
    log_message: str | None = None,
    capture_exception: bool = True,
    **kwargs: Any,
) -> T | None:
    """
    Execute a function with statement timeout handling.
    
    This is a functional alternative to the decorator when you need to wrap
    a function call without decorating the function itself.
    
    Args:
        func: The function to execute
        *args: Positional arguments to pass to the function
        fallback_value: Value to return if a statement timeout occurs
        log_message: Optional custom log message to use when timeout occurs
        capture_exception: Whether to capture the exception to Sentry (default: True)
        **kwargs: Keyword arguments to pass to the function
    
    Returns:
        The result of the function, or fallback_value if a statement timeout occurs
    
    Example:
        ```python
        results = execute_with_timeout_handling(
            list,
            Subscription.objects.raw(slow_query),
            fallback_value=[],
            log_message="Repair query timed out"
        )
        # Returns [] if timeout occurs
        ```
    """
    try:
        return func(*args, **kwargs)
    except Exception as exc:
        from sentry.db.postgres.helpers import is_statement_timeout

        if is_statement_timeout(exc):
            if log_message:
                logger.warning(log_message, exc_info=True)
            else:
                logger.warning(
                    f"Statement timeout in {func.__name__ if hasattr(func, '__name__') else 'function'}",
                    extra={"error_message": str(exc)},
                    exc_info=True,
                )

            if capture_exception:
                import sentry_sdk

                sentry_sdk.set_tag("db.error_type", "statement_timeout")
                sentry_sdk.set_context(
                    "statement_timeout",
                    {
                        "function": func.__name__ if hasattr(func, "__name__") else str(func),
                        "fallback_value_type": type(fallback_value).__name__,
                    },
                )
                sentry_sdk.capture_exception(exc, level="warning")

            return fallback_value
        else:
            raise
