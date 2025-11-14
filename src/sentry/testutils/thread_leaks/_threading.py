from typing import int
"""Utility functions for thread operations."""

from threading import Thread


def get_thread_function_name(thread: Thread) -> str:
    """Extract fully qualified function name from thread target.

    Handles cases where thread target is None or wrapped (e.g., functools.partial).
    Returns a string representation suitable for debugging output.
    """
    func = getattr(thread, "_target", None)
    if func is None:
        return "None"

    # Use __qualname__ if available, fallback to str() for complex objects like functools.partial
    func_name = getattr(func, "__qualname__", str(func))
    return f"{func.__module__}.{func_name}"
