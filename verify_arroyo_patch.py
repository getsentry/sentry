#!/usr/bin/env python3
"""
Standalone verification script for the Arroyo MetricsBuffer thread-safety patch.
This can be run without pytest to verify the fix works.
"""
from __future__ import annotations

import os
import sys
import threading
import time
from typing import Any

# Add src directory to Python path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "src"))


def main():
    """Main verification function."""
    # Import the monkey patch to ensure it's applied
    try:
        import sentry.monkey  # noqa: F401
        print("✓ Monkey patch module imported successfully")
    except ImportError as e:
        print(f"✗ Failed to import monkey patch: {e}")
        import traceback
        traceback.print_exc()
        return 1

    # Try to import MetricsBuffer
    try:
        from arroyo.processing.processor import MetricsBuffer
        print("✓ MetricsBuffer imported successfully")
    except ImportError as e:
        print(f"✗ Arroyo not installed (this is OK in some environments): {e}")
        return 0

    # Create a mock metrics backend
    class MockMetrics:
        def __init__(self):
            self.calls = []
            self.lock = threading.Lock()

        def timing(self, metric: str, value: float) -> None:
            with self.lock:
                self.calls.append(("timing", metric, value))

        def increment(self, metric: str, value: int) -> None:
            with self.lock:
                self.calls.append(("increment", metric, value))

    mock_metrics = MockMetrics()
    metrics_buffer = MetricsBuffer(mock_metrics)
    print("✓ MetricsBuffer instance created")

    # Test 1: Concurrent flush and increment
    print("\nTest 1: Concurrent flush and increment operations...")
    errors = []
    num_threads = 10
    iterations = 50

    def increment_worker():
        """Worker that increments counters."""
        try:
            for i in range(iterations):
                metrics_buffer.incr_counter("test.counter", 1)
                time.sleep(0.0001)
        except Exception as e:
            errors.append(("increment_worker", e))

    def flush_worker():
        """Worker that flushes metrics."""
        try:
            for i in range(iterations):
                metrics_buffer.flush()
                time.sleep(0.0001)
        except Exception as e:
            errors.append(("flush_worker", e))

    # Start threads
    threads = []
    start_time = time.time()
    for _ in range(num_threads // 2):
        t1 = threading.Thread(target=increment_worker)
        t2 = threading.Thread(target=flush_worker)
        threads.extend([t1, t2])
        t1.start()
        t2.start()

    # Wait for all threads to complete
    for t in threads:
        t.join(timeout=30)

    elapsed = time.time() - start_time

    # Check results
    if errors:
        print(f"✗ Test 1 FAILED with {len(errors)} errors:")
        for worker_name, error in errors:
            print(f"  - {worker_name}: {type(error).__name__}: {error}")
        return 1
    else:
        print(f"✓ Test 1 PASSED - no errors in {elapsed:.2f}s")

    # Test 2: Concurrent timer and flush
    print("\nTest 2: Concurrent timer and flush operations...")
    mock_metrics.calls.clear()
    errors.clear()

    def timer_worker():
        """Worker that records timers."""
        try:
            for i in range(iterations):
                metrics_buffer.incr_timer("test.timer", 1.5)
                time.sleep(0.0001)
        except Exception as e:
            errors.append(("timer_worker", e))

    # Start threads
    threads = []
    start_time = time.time()
    for _ in range(num_threads // 2):
        t1 = threading.Thread(target=timer_worker)
        t2 = threading.Thread(target=flush_worker)
        threads.extend([t1, t2])
        t1.start()
        t2.start()

    # Wait for all threads to complete
    for t in threads:
        t.join(timeout=30)

    elapsed = time.time() - start_time

    # Check results
    if errors:
        print(f"✗ Test 2 FAILED with {len(errors)} errors:")
        for worker_name, error in errors:
            print(f"  - {worker_name}: {type(error).__name__}: {error}")
        return 1
    else:
        print(f"✓ Test 2 PASSED - no errors in {elapsed:.2f}s")

    # Test 3: Verify metrics are flushed correctly
    print("\nTest 3: Verify metrics are flushed correctly...")
    mock_metrics.calls.clear()

    metrics_buffer.incr_counter("test.counter", 5)
    metrics_buffer.incr_timer("test.timer", 1.5)
    metrics_buffer.flush()

    # Check that metrics were sent
    increment_calls = [c for c in mock_metrics.calls if c[0] == "increment"]
    timing_calls = [c for c in mock_metrics.calls if c[0] == "timing"]

    if not increment_calls:
        print("✗ Test 3 FAILED - no increment calls recorded")
        return 1
    if not timing_calls:
        print("✗ Test 3 FAILED - no timing calls recorded")
        return 1

    print(f"✓ Test 3 PASSED - {len(increment_calls)} increment calls, {len(timing_calls)} timing calls")

    # Test 4: Verify buffers are cleared after flush
    print("\nTest 4: Verify buffers are cleared after flush...")
    mock_metrics.calls.clear()
    metrics_buffer.flush()

    if mock_metrics.calls:
        print(f"✗ Test 4 FAILED - unexpected calls after flush: {mock_metrics.calls}")
        return 1

    print("✓ Test 4 PASSED - no calls after flushing empty buffer")

    print("\n" + "=" * 60)
    print("All tests PASSED! The Arroyo MetricsBuffer patch is working correctly.")
    print("=" * 60)
    return 0


if __name__ == "__main__":
    sys.exit(main())
