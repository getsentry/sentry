"""
Tests for arroyo monkey patches that fix thread-safety issues.
"""

from __future__ import annotations

import threading
import time
from unittest.mock import Mock

import pytest


class TestMetricsBufferPatch:
    """Tests for the MetricsBuffer.flush() thread-safety patch."""

    def test_concurrent_flush_and_incr_counter(self):
        """
        Test that concurrent flush() and incr_counter() calls don't cause
        RuntimeError: dictionary changed size during iteration.

        This simulates the race condition that occurs when:
        1. flush() starts iterating over __counters
        2. Another thread calls incr_counter() which modifies __counters
        3. flush() raises RuntimeError
        """
        from sentry.utils.arroyo_patches import apply_all_patches

        # Apply the patches
        apply_all_patches()

        # Import after patching to get the patched version
        from arroyo.processing.processor import MetricsBuffer

        # Create a mock metrics backend
        mock_metrics = Mock()
        mock_metrics.timing = Mock()
        mock_metrics.increment = Mock()

        # Create the MetricsBuffer
        buffer = MetricsBuffer(mock_metrics)

        # Add some initial metrics
        for i in range(10):
            buffer.incr_counter(f"test.counter.{i}", 1)
            buffer.record_timer(f"test.timer.{i}", 1.0)

        errors = []
        success_count = [0]  # Use list for mutability in nested function

        def flush_continuously():
            """Continuously flush metrics."""
            try:
                for _ in range(50):
                    buffer.flush()
                    time.sleep(0.001)  # Small delay
                success_count[0] += 1
            except Exception as e:
                errors.append(("flush", e))

        def incr_continuously():
            """Continuously increment counters."""
            try:
                for i in range(50):
                    buffer.incr_counter(f"test.counter.{i % 10}", 1)
                    time.sleep(0.001)  # Small delay
                success_count[0] += 1
            except Exception as e:
                errors.append(("incr", e))

        # Start multiple threads that concurrently flush and increment
        threads = []
        for _ in range(3):
            t1 = threading.Thread(target=flush_continuously)
            t2 = threading.Thread(target=incr_continuously)
            threads.extend([t1, t2])
            t1.start()
            t2.start()

        # Wait for all threads to complete
        for t in threads:
            t.join(timeout=5.0)

        # Check that no RuntimeError occurred
        runtime_errors = [e for source, e in errors if isinstance(e, RuntimeError)]
        assert not runtime_errors, f"RuntimeError occurred: {runtime_errors}"
        assert not errors, f"Unexpected errors occurred: {errors}"
        assert success_count[0] == 6, f"Expected 6 successful threads, got {success_count[0]}"

    def test_concurrent_flush_and_record_timer(self):
        """
        Test that concurrent flush() and record_timer() calls don't cause
        RuntimeError: dictionary changed size during iteration.
        """
        from sentry.utils.arroyo_patches import apply_all_patches

        # Apply the patches
        apply_all_patches()

        # Import after patching to get the patched version
        from arroyo.processing.processor import MetricsBuffer

        # Create a mock metrics backend
        mock_metrics = Mock()
        mock_metrics.timing = Mock()
        mock_metrics.increment = Mock()

        # Create the MetricsBuffer
        buffer = MetricsBuffer(mock_metrics)

        errors = []
        success_count = [0]

        def flush_continuously():
            """Continuously flush metrics."""
            try:
                for _ in range(50):
                    buffer.flush()
                    time.sleep(0.001)
                success_count[0] += 1
            except Exception as e:
                errors.append(("flush", e))

        def record_continuously():
            """Continuously record timers."""
            try:
                for i in range(50):
                    buffer.record_timer(f"test.timer.{i % 10}", float(i))
                    time.sleep(0.001)
                success_count[0] += 1
            except Exception as e:
                errors.append(("record", e))

        # Start multiple threads
        threads = []
        for _ in range(3):
            t1 = threading.Thread(target=flush_continuously)
            t2 = threading.Thread(target=record_continuously)
            threads.extend([t1, t2])
            t1.start()
            t2.start()

        # Wait for all threads to complete
        for t in threads:
            t.join(timeout=5.0)

        # Check that no RuntimeError occurred
        runtime_errors = [e for source, e in errors if isinstance(e, RuntimeError)]
        assert not runtime_errors, f"RuntimeError occurred: {runtime_errors}"
        assert not errors, f"Unexpected errors occurred: {errors}"
        assert success_count[0] == 6, f"Expected 6 successful threads, got {success_count[0]}"

    def test_patch_can_be_applied_multiple_times(self):
        """Test that applying the patch multiple times doesn't cause issues."""
        from sentry.utils.arroyo_patches import apply_all_patches

        # Apply the patch multiple times
        apply_all_patches()
        apply_all_patches()
        apply_all_patches()

        # Import and verify the patch is still working
        from arroyo.processing.processor import MetricsBuffer

        mock_metrics = Mock()
        mock_metrics.timing = Mock()
        mock_metrics.increment = Mock()

        buffer = MetricsBuffer(mock_metrics)
        buffer.incr_counter("test.counter", 1)
        buffer.flush()

        # Verify the mock was called
        assert mock_metrics.increment.called

    @pytest.mark.parametrize("num_threads", [2, 5, 10])
    def test_high_concurrency_stress_test(self, num_threads):
        """
        Stress test with high concurrency to ensure the patch handles
        various levels of concurrent access.
        """
        from sentry.utils.arroyo_patches import apply_all_patches

        apply_all_patches()

        from arroyo.processing.processor import MetricsBuffer

        mock_metrics = Mock()
        mock_metrics.timing = Mock()
        mock_metrics.increment = Mock()

        buffer = MetricsBuffer(mock_metrics)

        errors = []
        operations_per_thread = 100

        def worker():
            """Perform mixed operations."""
            try:
                for i in range(operations_per_thread):
                    if i % 3 == 0:
                        buffer.flush()
                    elif i % 3 == 1:
                        buffer.incr_counter(f"test.counter.{i % 5}", 1)
                    else:
                        buffer.record_timer(f"test.timer.{i % 5}", float(i))
            except Exception as e:
                errors.append(e)

        threads = [threading.Thread(target=worker) for _ in range(num_threads)]
        for t in threads:
            t.start()
        for t in threads:
            t.join(timeout=10.0)

        runtime_errors = [e for e in errors if isinstance(e, RuntimeError)]
        assert not runtime_errors, (
            f"RuntimeError occurred with {num_threads} threads: {runtime_errors}"
        )
        assert not errors, f"Unexpected errors with {num_threads} threads: {errors}"
