"""
Tests for the Arroyo MetricsBuffer thread-safety patch.
"""
from __future__ import annotations

import threading
import time
from typing import Any
from unittest.mock import Mock

import pytest


@pytest.fixture
def metrics_buffer():
    """Create a MetricsBuffer instance for testing."""
    try:
        from arroyo.processing.processor import MetricsBuffer
    except ImportError:
        pytest.skip("Arroyo not installed")

    mock_metrics = Mock()
    return MetricsBuffer(mock_metrics)


def test_concurrent_flush_and_increment(metrics_buffer):
    """
    Test that concurrent flush() and incr_counter() calls don't cause
    RuntimeError: dictionary changed size during iteration.
    """
    errors = []
    num_threads = 10
    iterations = 100

    def increment_worker():
        """Worker that increments counters."""
        try:
            for i in range(iterations):
                metrics_buffer.incr_counter("test.counter", 1)
                time.sleep(0.0001)  # Small delay to increase contention
        except Exception as e:
            errors.append(e)

    def flush_worker():
        """Worker that flushes metrics."""
        try:
            for i in range(iterations):
                metrics_buffer.flush()
                time.sleep(0.0001)  # Small delay to increase contention
        except Exception as e:
            errors.append(e)

    # Start threads
    threads = []
    for _ in range(num_threads // 2):
        t1 = threading.Thread(target=increment_worker)
        t2 = threading.Thread(target=flush_worker)
        threads.extend([t1, t2])
        t1.start()
        t2.start()

    # Wait for all threads to complete
    for t in threads:
        t.join(timeout=10)

    # Check that no RuntimeError occurred
    runtime_errors = [e for e in errors if isinstance(e, RuntimeError)]
    assert not runtime_errors, f"RuntimeError occurred: {runtime_errors}"
    assert not errors, f"Unexpected errors: {errors}"


def test_concurrent_timer_and_flush(metrics_buffer):
    """
    Test that concurrent flush() and incr_timer() calls don't cause
    RuntimeError: dictionary changed size during iteration.
    """
    errors = []
    num_threads = 10
    iterations = 100

    def timer_worker():
        """Worker that records timers."""
        try:
            for i in range(iterations):
                metrics_buffer.incr_timer("test.timer", 1.5)
                time.sleep(0.0001)
        except Exception as e:
            errors.append(e)

    def flush_worker():
        """Worker that flushes metrics."""
        try:
            for i in range(iterations):
                metrics_buffer.flush()
                time.sleep(0.0001)
        except Exception as e:
            errors.append(e)

    # Start threads
    threads = []
    for _ in range(num_threads // 2):
        t1 = threading.Thread(target=timer_worker)
        t2 = threading.Thread(target=flush_worker)
        threads.extend([t1, t2])
        t1.start()
        t2.start()

    # Wait for all threads to complete
    for t in threads:
        t.join(timeout=10)

    # Check that no RuntimeError occurred
    runtime_errors = [e for e in errors if isinstance(e, RuntimeError)]
    assert not runtime_errors, f"RuntimeError occurred: {runtime_errors}"
    assert not errors, f"Unexpected errors: {errors}"


def test_all_metrics_eventually_sent(metrics_buffer):
    """
    Test that all metrics are eventually sent even with concurrent access.
    """
    mock_metrics = metrics_buffer.metrics
    num_increments = 100

    def increment_worker():
        """Worker that increments counters."""
        for i in range(num_increments):
            metrics_buffer.incr_counter("test.counter", 1)

    # Run increment worker
    t = threading.Thread(target=increment_worker)
    t.start()
    t.join()

    # Flush to send all metrics
    metrics_buffer.flush()

    # Check that increment was called (possibly multiple times due to flushes)
    # The total should be num_increments
    total_sent = sum(
        call[0][1] for call in mock_metrics.increment.call_args_list if call[0][0] == "test.counter"
    )
    assert total_sent == num_increments, f"Expected {num_increments} total, got {total_sent}"


def test_flush_clears_buffers(metrics_buffer):
    """Test that flush() properly clears the buffers."""
    # Add some metrics
    metrics_buffer.incr_counter("test.counter", 5)
    metrics_buffer.incr_timer("test.timer", 1.5)

    # Flush
    metrics_buffer.flush()

    # Verify metrics were sent
    metrics_buffer.metrics.increment.assert_called_once_with("test.counter", 5)
    metrics_buffer.metrics.timing.assert_called_once_with("test.timer", 1.5)

    # Reset mock
    metrics_buffer.metrics.reset_mock()

    # Flush again - should not send anything as buffers are cleared
    metrics_buffer.flush()

    # Verify nothing was sent
    metrics_buffer.metrics.increment.assert_not_called()
    metrics_buffer.metrics.timing.assert_not_called()
