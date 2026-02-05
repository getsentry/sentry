"""
Tests for Arroyo MetricsBuffer thread-safety monkey patch.

This test ensures that the monkey patch in src/sentry/monkey/__init__.py
correctly prevents RuntimeError when multiple threads concurrently modify
the metrics dictionaries while flush() is iterating over them.
"""

from __future__ import annotations

import threading
import time
from unittest.mock import MagicMock

import pytest


@pytest.fixture
def metrics_buffer():
    """Create a MetricsBuffer instance for testing."""
    try:
        from arroyo.processing.processor import MetricsBuffer
        from arroyo.utils.metrics import Metrics
    except ImportError:
        pytest.skip("Arroyo is not installed")

    # Create a mock metrics backend
    mock_metrics = MagicMock(spec=Metrics)
    mock_metrics.timing = MagicMock()
    mock_metrics.increment = MagicMock()

    buffer = MetricsBuffer(mock_metrics)
    return buffer


def test_concurrent_incr_counter_and_flush(metrics_buffer):
    """
    Test that concurrent incr_counter calls and flush calls don't cause RuntimeError.

    This simulates the scenario where:
    1. Multiple Kafka delivery callbacks execute on separate threads
    2. Callbacks invoke metrics_delivery_callback which modifies __counters
    3. While one thread iterates __counters in flush, another callback modifies it
    """
    errors = []
    iterations = 100
    threads_per_operation = 5

    def increment_counters():
        """Simulate concurrent delivery callbacks incrementing counters."""
        try:
            for i in range(iterations):
                metrics_buffer.incr_counter(f"metric_{i % 10}", 1)
                time.sleep(0.0001)  # Small delay to increase race condition likelihood
        except Exception as e:
            errors.append(e)

    def flush_metrics():
        """Simulate concurrent flush operations."""
        try:
            for _ in range(iterations):
                metrics_buffer.flush()
                time.sleep(0.0001)  # Small delay to increase race condition likelihood
        except Exception as e:
            errors.append(e)

    # Create threads for incrementing counters
    increment_threads = [
        threading.Thread(target=increment_counters) for _ in range(threads_per_operation)
    ]

    # Create threads for flushing
    flush_threads = [threading.Thread(target=flush_metrics) for _ in range(threads_per_operation)]

    # Start all threads
    all_threads = increment_threads + flush_threads
    for thread in all_threads:
        thread.start()

    # Wait for all threads to complete
    for thread in all_threads:
        thread.join()

    # Check that no RuntimeError occurred
    assert not errors, f"Errors occurred during concurrent operations: {errors}"


def test_concurrent_incr_timer_and_flush(metrics_buffer):
    """
    Test that concurrent incr_timer calls and flush calls don't cause RuntimeError.
    """
    errors = []
    iterations = 100
    threads_per_operation = 5

    def increment_timers():
        """Simulate concurrent timer increments."""
        try:
            for i in range(iterations):
                metrics_buffer.incr_timer(f"timer_{i % 10}", float(i))
                time.sleep(0.0001)
        except Exception as e:
            errors.append(e)

    def flush_metrics():
        """Simulate concurrent flush operations."""
        try:
            for _ in range(iterations):
                metrics_buffer.flush()
                time.sleep(0.0001)
        except Exception as e:
            errors.append(e)

    # Create threads
    timer_threads = [threading.Thread(target=increment_timers) for _ in range(threads_per_operation)]
    flush_threads = [threading.Thread(target=flush_metrics) for _ in range(threads_per_operation)]

    # Start all threads
    all_threads = timer_threads + flush_threads
    for thread in all_threads:
        thread.start()

    # Wait for all threads to complete
    for thread in all_threads:
        thread.join()

    # Check that no RuntimeError occurred
    assert not errors, f"Errors occurred during concurrent operations: {errors}"


def test_metrics_are_flushed_correctly(metrics_buffer):
    """
    Test that metrics are still correctly flushed after patching.
    """
    # Add some counters and timers
    metrics_buffer.incr_counter("test_counter", 5)
    metrics_buffer.incr_counter("test_counter", 3)
    metrics_buffer.incr_timer("test_timer", 1.5)

    # Flush the metrics
    metrics_buffer.flush()

    # Verify the mock was called with the correct values
    metrics_buffer.metrics.increment.assert_called()
    metrics_buffer.metrics.timing.assert_called_with("test_timer", 1.5)

    # After flush, dictionaries should be empty
    assert len(metrics_buffer._MetricsBuffer__counters) == 0
    assert len(metrics_buffer._MetricsBuffer__timers) == 0


def test_multiple_flushes_with_concurrent_modifications(metrics_buffer):
    """
    Test the specific scenario from the bug report:
    - Start monitor consumer with high throughput check-ins
    - Multiple Kafka producers emit messages asynchronously
    - Delivery callbacks fire concurrently, calling metrics_delivery_callback
    - One callback's __throttled_record triggers __flush_metrics
    - Another concurrent callback modifies __produce_counters dictionary
    """
    errors = []
    num_workers = 10
    operations_per_worker = 50

    def simulate_kafka_callback():
        """
        Simulate Kafka delivery callback that increments metrics
        and occasionally triggers a flush.
        """
        try:
            for i in range(operations_per_worker):
                # Simulate metrics_delivery_callback incrementing counters
                metrics_buffer.incr_counter("delivery_success", 1)
                metrics_buffer.incr_counter("delivery_latency", i)

                # Occasionally trigger a flush (simulating __throttled_record)
                if i % 10 == 0:
                    metrics_buffer.flush()

                time.sleep(0.0001)  # Simulate async processing
        except Exception as e:
            errors.append(e)

    # Create multiple worker threads simulating concurrent Kafka callbacks
    threads = [threading.Thread(target=simulate_kafka_callback) for _ in range(num_workers)]

    # Start all threads
    for thread in threads:
        thread.start()

    # Wait for all threads to complete
    for thread in threads:
        thread.join()

    # Final flush to ensure all metrics are processed
    metrics_buffer.flush()

    # Check that no RuntimeError occurred
    assert not errors, f"RuntimeError occurred during concurrent dictionary iteration: {errors}"


def test_lock_per_instance():
    """
    Test that different MetricsBuffer instances have different locks
    and don't interfere with each other.
    """
    try:
        from arroyo.processing.processor import MetricsBuffer
        from arroyo.utils.metrics import Metrics
    except ImportError:
        pytest.skip("Arroyo is not installed")

    mock_metrics1 = MagicMock(spec=Metrics)
    mock_metrics2 = MagicMock(spec=Metrics)

    buffer1 = MetricsBuffer(mock_metrics1)
    buffer2 = MetricsBuffer(mock_metrics2)

    errors = []

    def operate_on_buffer1():
        try:
            for i in range(100):
                buffer1.incr_counter(f"buffer1_metric_{i}", 1)
                if i % 10 == 0:
                    buffer1.flush()
        except Exception as e:
            errors.append(e)

    def operate_on_buffer2():
        try:
            for i in range(100):
                buffer2.incr_counter(f"buffer2_metric_{i}", 1)
                if i % 10 == 0:
                    buffer2.flush()
        except Exception as e:
            errors.append(e)

    # Run operations on both buffers concurrently
    thread1 = threading.Thread(target=operate_on_buffer1)
    thread2 = threading.Thread(target=operate_on_buffer2)

    thread1.start()
    thread2.start()

    thread1.join()
    thread2.join()

    # Verify no errors occurred
    assert not errors, f"Errors occurred: {errors}"
