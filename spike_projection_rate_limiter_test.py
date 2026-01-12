"""
Tests for spike projection rate limiter.

Run with: pytest spike_projection_rate_limiter_test.py -v
"""

from __future__ import annotations

import threading
import time
from unittest import mock

import pytest
from django.core.cache import cache

# Mock Django cache if not available
try:
    from django.core.cache import cache
except ImportError:
    # Create a simple mock cache for standalone testing
    class MockCache:
        def __init__(self):
            self._data = {}
            self._lock = threading.Lock()
        
        def get(self, key, default=None):
            with self._lock:
                return self._data.get(key, default)
        
        def set(self, key, value, timeout=None):
            with self._lock:
                self._data[key] = value
        
        def add(self, key, value, timeout=None):
            with self._lock:
                if key not in self._data:
                    self._data[key] = value
                    return True
                return False
        
        def incr(self, key, delta=1):
            with self._lock:
                if key in self._data:
                    self._data[key] += delta
                    return self._data[key]
                return None
        
        def decr(self, key, delta=1):
            with self._lock:
                if key in self._data and self._data[key] > 0:
                    self._data[key] -= delta
        
        def delete(self, key):
            with self._lock:
                self._data.pop(key, None)
        
        def clear(self):
            with self._lock:
                self._data.clear()
    
    cache = MockCache()


# Import after cache is set up
import sys
sys.path.insert(0, '/workspace')
from spike_projection_rate_limiter import (
    SpikeProjectionRateLimiter,
    spike_projection_rate_limit,
    get_current_concurrent_count,
    reset_concurrent_count,
)


@pytest.fixture(autouse=True)
def clear_cache():
    """Clear cache before each test."""
    cache.clear()
    yield
    cache.clear()


@pytest.fixture
def rate_limiter():
    """Create a rate limiter with test-friendly settings."""
    return SpikeProjectionRateLimiter(
        max_concurrent=5,
        timeout=60,
        max_wait=2,  # Short wait for tests
        retry_interval=0.1,
    )


class TestSpikeProjectionRateLimiter:
    """Test suite for the spike projection rate limiter."""
    
    def test_acquire_and_release_slot(self, rate_limiter):
        """Test basic slot acquisition and release."""
        # Acquire a slot
        assert rate_limiter.acquire_slot() is True
        assert get_current_concurrent_count() == 1
        
        # Release the slot
        rate_limiter.release_slot()
        assert get_current_concurrent_count() == 0
    
    def test_max_concurrent_limit(self, rate_limiter):
        """Test that max concurrent limit is enforced."""
        # Acquire max_concurrent slots
        for i in range(5):
            assert rate_limiter.acquire_slot() is True, f"Failed to acquire slot {i+1}"
        
        assert get_current_concurrent_count() == 5
        
        # Try to acquire one more - should fail after timeout
        assert rate_limiter.acquire_slot() is False
    
    def test_context_manager(self, rate_limiter):
        """Test the context manager interface."""
        with rate_limiter.limit() as acquired:
            assert acquired is True
            assert get_current_concurrent_count() == 1
        
        # After exiting context, slot should be released
        assert get_current_concurrent_count() == 0
    
    def test_context_manager_exception_handling(self, rate_limiter):
        """Test that slots are released even if an exception occurs."""
        try:
            with rate_limiter.limit() as acquired:
                assert acquired is True
                assert get_current_concurrent_count() == 1
                raise ValueError("Test exception")
        except ValueError:
            pass
        
        # Slot should still be released
        assert get_current_concurrent_count() == 0
    
    def test_concurrent_acquisitions(self, rate_limiter):
        """Test multiple concurrent acquisitions from different threads."""
        results = []
        errors = []
        
        def acquire_and_work(thread_id):
            try:
                with rate_limiter.limit() as acquired:
                    if acquired:
                        results.append(thread_id)
                        # Simulate work
                        time.sleep(0.2)
            except Exception as e:
                errors.append((thread_id, e))
        
        # Start 10 threads trying to acquire slots (max is 5)
        threads = []
        for i in range(10):
            t = threading.Thread(target=acquire_and_work, args=(i,))
            threads.append(t)
            t.start()
        
        # Wait for all threads
        for t in threads:
            t.join()
        
        # Should have no errors
        assert len(errors) == 0
        
        # Some threads should have succeeded (up to max_concurrent)
        assert len(results) <= 5
        assert len(results) >= 1
        
        # Final count should be 0 (all released)
        assert get_current_concurrent_count() == 0
    
    def test_reset_counter(self):
        """Test resetting the concurrent counter."""
        limiter = SpikeProjectionRateLimiter(max_concurrent=5)
        
        # Acquire some slots
        limiter.acquire_slot()
        limiter.acquire_slot()
        assert get_current_concurrent_count() == 2
        
        # Reset
        reset_concurrent_count()
        assert get_current_concurrent_count() == 0
    
    def test_global_rate_limit_function(self):
        """Test the global spike_projection_rate_limit function."""
        # First acquisition should succeed
        with spike_projection_rate_limit() as acquired:
            assert acquired is True
        
        # Should be released
        count = get_current_concurrent_count()
        assert count == 0


class TestRateLimiterUnderLoad:
    """Test rate limiter behavior under heavy load."""
    
    def test_many_concurrent_requests(self):
        """Test with many concurrent requests exceeding the limit."""
        limiter = SpikeProjectionRateLimiter(
            max_concurrent=10,
            max_wait=0.5,
            retry_interval=0.05,
        )
        
        acquired_count = 0
        timeout_count = 0
        lock = threading.Lock()
        
        def try_acquire(thread_id):
            nonlocal acquired_count, timeout_count
            
            with limiter.limit() as acquired:
                if acquired:
                    with lock:
                        acquired_count += 1
                    # Simulate work
                    time.sleep(0.1)
                else:
                    with lock:
                        timeout_count += 1
        
        # Start 50 threads
        threads = []
        for i in range(50):
            t = threading.Thread(target=try_acquire, args=(i,))
            threads.append(t)
            t.start()
        
        for t in threads:
            t.join()
        
        # Should have acquired some slots
        assert acquired_count > 0
        # Should have some timeouts since we exceed max_concurrent
        assert timeout_count > 0
        # Total should be 50
        assert acquired_count + timeout_count == 50
        
        print(f"Acquired: {acquired_count}, Timeouts: {timeout_count}")
    
    def test_burst_then_steady(self):
        """Test burst of requests followed by steady state."""
        limiter = SpikeProjectionRateLimiter(
            max_concurrent=5,
            max_wait=1.0,
            retry_interval=0.1,
        )
        
        results = {"acquired": 0, "timeout": 0}
        lock = threading.Lock()
        
        def make_request():
            with limiter.limit() as acquired:
                if acquired:
                    with lock:
                        results["acquired"] += 1
                    time.sleep(0.05)
                else:
                    with lock:
                        results["timeout"] += 1
        
        # Burst: 20 rapid requests
        burst_threads = []
        for _ in range(20):
            t = threading.Thread(target=make_request)
            burst_threads.append(t)
            t.start()
        
        for t in burst_threads:
            t.join()
        
        burst_acquired = results["acquired"]
        burst_timeout = results["timeout"]
        
        # Wait for things to settle
        time.sleep(0.5)
        
        # Reset counters for steady state
        results = {"acquired": 0, "timeout": 0}
        
        # Steady: 10 requests with delays
        for _ in range(10):
            make_request()
            time.sleep(0.1)
        
        steady_acquired = results["acquired"]
        steady_timeout = results["timeout"]
        
        print(f"Burst - Acquired: {burst_acquired}, Timeouts: {burst_timeout}")
        print(f"Steady - Acquired: {steady_acquired}, Timeouts: {steady_timeout}")
        
        # In steady state, should have fewer timeouts
        assert steady_timeout <= burst_timeout


class TestEdgeCases:
    """Test edge cases and error conditions."""
    
    def test_cache_failure_handling(self, rate_limiter):
        """Test behavior when cache operations fail."""
        with mock.patch('django.core.cache.cache.get', side_effect=Exception("Cache error")):
            # Should handle gracefully and return None
            result = rate_limiter.acquire_slot()
            # In error cases, we currently return False (timeout)
            assert result is False
    
    def test_counter_never_initialized(self):
        """Test when counter was never initialized."""
        cache.clear()
        count = get_current_concurrent_count()
        assert count == 0
    
    def test_rapid_acquire_release_cycles(self, rate_limiter):
        """Test rapid acquisition and release cycles."""
        for _ in range(100):
            assert rate_limiter.acquire_slot() is True
            rate_limiter.release_slot()
        
        assert get_current_concurrent_count() == 0


class TestIntegrationScenario:
    """Test realistic integration scenarios."""
    
    def test_spike_projection_task_simulation(self):
        """Simulate the actual spike projection task flow."""
        limiter = SpikeProjectionRateLimiter(
            max_concurrent=50,
            max_wait=5.0,
            retry_interval=0.1,
        )
        
        def simulate_spike_projection_task(org_id):
            """Simulate running a spike projection for an organization."""
            with limiter.limit() as acquired:
                if not acquired:
                    # In real code, would log and skip
                    return False
                
                # Simulate Snuba query (100ms)
                time.sleep(0.1)
                return True
        
        # Simulate 200 organizations being processed
        results = []
        threads = []
        
        for org_id in range(200):
            t = threading.Thread(
                target=lambda oid: results.append(simulate_spike_projection_task(oid)),
                args=(org_id,)
            )
            threads.append(t)
            t.start()
        
        for t in threads:
            t.join()
        
        successful = sum(1 for r in results if r is True)
        skipped = sum(1 for r in results if r is False)
        
        print(f"Successful: {successful}, Skipped: {skipped}")
        
        # Most should succeed
        assert successful > 100
        # Some may be skipped due to high concurrency
        assert skipped >= 0
        
        # All slots should be released
        assert get_current_concurrent_count() == 0


if __name__ == "__main__":
    # Run tests
    pytest.main([__file__, "-v", "-s"])
