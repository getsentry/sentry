from __future__ import annotations

from typing import Any


def register_scheme(name: str) -> None:
    from urllib import parse as urlparse

    uses = urlparse.uses_netloc, urlparse.uses_query, urlparse.uses_relative, urlparse.uses_fragment
    for use in uses:
        if name not in use:
            use.append(name)


register_scheme("app")
register_scheme("chrome-extension")


def _add_class_getitem(cls: Any) -> None:
    cls.__class_getitem__ = classmethod(lambda cls, *a: cls)


def _patch_generics() -> None:
    for modname, clsname in (
        # not all django types are generic at runtime
        # this is a lightweight version of `django-stubs-ext`
        ("django.db.models.fields", "Field"),
        # only generic in stubs
        ("parsimonious.nodes", "NodeVisitor"),
    ):
        try:
            mod = __import__(modname, fromlist=["_trash"])
        except ImportError:
            pass
        else:
            getattr(mod, clsname).__class_getitem__ = classmethod(lambda cls, *a: cls)


_patch_generics()


def _patch_arroyo_metrics_buffer() -> None:
    """
    Patch Arroyo's MetricsBuffer to be thread-safe.

    The original implementation iterates over self.__counters and self.__timers
    dictionaries without synchronization, causing "RuntimeError: dictionary changed
    size during iteration" when other threads modify these dictionaries concurrently.

    This patch wraps the critical sections with a lock to ensure thread safety.
    """
    try:
        from threading import Lock

        from arroyo.processing.processor import MetricsBuffer
    except ImportError:
        # Arroyo is not installed, skip patching
        return

    # Store locks per MetricsBuffer instance using a WeakKeyDictionary
    # to avoid memory leaks when MetricsBuffer instances are garbage collected
    import weakref

    _locks: Any = weakref.WeakKeyDictionary()

    def _get_lock(self: Any) -> Lock:
        """Get or create a lock for this MetricsBuffer instance."""
        if self not in _locks:
            _locks[self] = Lock()
        return _locks[self]

    # Patch the flush method
    original_flush = MetricsBuffer.flush

    def thread_safe_flush(self: Any) -> None:
        lock = _get_lock(self)
        with lock:
            # Atomically swap out the dictionaries with new empty ones.
            # This prevents concurrent modifications during iteration.
            timers_to_flush = self._MetricsBuffer__timers
            counters_to_flush = self._MetricsBuffer__counters

            # Reset with new empty dictionaries
            self._MetricsBuffer__timers = {}
            self._MetricsBuffer__counters = {}

        # Iterate outside the lock to avoid blocking other threads
        # while sending metrics to the backend
        for metric, value in timers_to_flush.items():
            self.metrics.timing(metric, value)
        for metric, value in counters_to_flush.items():
            self.metrics.increment(metric, value)

    # Patch the incr_counter and incr_timer methods
    original_incr_counter = MetricsBuffer.incr_counter
    original_incr_timer = MetricsBuffer.incr_timer

    def thread_safe_incr_counter(self: Any, metric: Any, value: int) -> None:
        lock = _get_lock(self)
        with lock:
            self._MetricsBuffer__counters[metric] = (
                self._MetricsBuffer__counters.get(metric, 0) + value
            )

    def thread_safe_incr_timer(self: Any, metric: Any, value: float) -> None:
        lock = _get_lock(self)
        with lock:
            self._MetricsBuffer__timers[metric] = value

    MetricsBuffer.flush = thread_safe_flush
    MetricsBuffer.incr_counter = thread_safe_incr_counter
    MetricsBuffer.incr_timer = thread_safe_incr_timer


_patch_arroyo_metrics_buffer()
