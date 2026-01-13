"""
Monkey patches for the arroyo library to fix thread-safety issues.

This module should be imported as early as possible in consumer initialization
to ensure patches are applied before any arroyo code runs.
"""

from __future__ import annotations

import logging
from typing import TYPE_CHECKING, Union

if TYPE_CHECKING:
    from arroyo.processing.processor import ConsumerCounter, ConsumerTiming

logger = logging.getLogger(__name__)


def patch_metrics_buffer_flush() -> None:
    """
    Patches the arroyo MetricsBuffer.flush() method to be thread-safe.

    The original implementation iterates over self.__timers and self.__counters
    dictionaries directly, which can raise "RuntimeError: dictionary changed size
    during iteration" when multiple threads access the MetricsBuffer concurrently.

    This patch creates snapshots of the dictionaries before iteration to prevent
    the race condition.

    See: https://github.com/getsentry/sentry/issues/...
    """
    try:
        from arroyo.processing.processor import MetricsBuffer

        original_flush = MetricsBuffer.flush

        def thread_safe_flush(self: MetricsBuffer) -> None:
            """Thread-safe version of MetricsBuffer.flush()."""
            # Create snapshots of the dictionaries to prevent race conditions
            # when other threads modify them during iteration
            timers_snapshot = dict(self._MetricsBuffer__timers)
            counters_snapshot = dict(self._MetricsBuffer__counters)

            metric: Union[ConsumerTiming, ConsumerCounter]
            value: Union[float, int]

            for metric, value in timers_snapshot.items():
                self.metrics.timing(metric, value)
            for metric, value in counters_snapshot.items():
                self.metrics.increment(metric, value)
            self._MetricsBuffer__reset()

        MetricsBuffer.flush = thread_safe_flush  # type: ignore[method-assign]
        logger.debug("Successfully patched arroyo MetricsBuffer.flush() for thread safety")
    except ImportError:
        logger.warning("Could not import arroyo.processing.processor.MetricsBuffer for patching")
    except Exception as e:
        logger.error("Failed to patch arroyo MetricsBuffer.flush(): %s", e, exc_info=True)


def apply_all_patches() -> None:
    """
    Apply all arroyo monkey patches.

    This should be called as early as possible in consumer initialization.
    """
    patch_metrics_buffer_flush()
