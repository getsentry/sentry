from typing import int
"""Integration tests for thread leak assertion utilities."""

import builtins
import re
from threading import Event, Thread

import pytest

from sentry.testutils.thread_leaks.assertion import ThreadLeakAssertionError, assert_none

log_test_info = builtins.print


class TestAssertNoneIntegration:
    def test_no_leaks_passes_cleanly(self) -> None:
        """Test that clean code passes without issues."""
        with assert_none():
            pass  # No threads created
        # Should not raise

    def test_thread_leak_strict_mode_raises(self) -> None:
        """Test that thread leaks raise in strict mode."""
        stop = Event()
        thread = Thread(target=stop.wait, daemon=True)
        try:
            with pytest.raises(ThreadLeakAssertionError) as exc_info:
                with assert_none():
                    # Create a daemon thread that won't block test completion
                    thread.start()
        finally:
            stop.set()
            thread.join()

        stack_diff = str(exc_info.value)
        log_test_info(f"ORIG: {stack_diff}")

        # all of the numbers are effectively random
        stack_diff = re.sub("[0-9]+", "$N", stack_diff)
        assert "\n  <_MainThread(MainThread, started $N)>@None\n" in stack_diff

        # Remove context lines, containing thread leaks from other tests
        stack_diff = re.sub("^ .*\n", "", stack_diff, flags=re.MULTILINE)

        # Verify the error message contains useful debugging info
        assert (
            stack_diff
            == """
+ <Thread(Thread-$N (wait), started daemon $N)>@threading.Event.wait
+     File "./tests/sentry/testutils/thread_leaks/test_assertion.py", line $N, in test_thread_leak_strict_mode_raises
+       thread = Thread(target=stop.wait, daemon=True)
+ \n"""  # note: that's a load-bearing whitespace!
        )

    def test_thread_that_exits_during_context_passes(self) -> None:
        """Test that threads which complete and exit don't trigger assertion error."""
        with assert_none():
            # Create and start a thread that will complete quickly
            thread = Thread(target=lambda: None, daemon=True)
            thread.start()
            # Wait for thread to complete before context exits
            thread.join(timeout=1.0)
        # Should not raise - thread completed and is no longer active

    def test_thread_leak_always_raises(self) -> None:
        """Test that thread leaks always raise an error (no more non-strict mode)."""
        stop = Event()
        thread = Thread(target=stop.wait, daemon=True)
        try:
            with pytest.raises(ThreadLeakAssertionError) as exc_info:
                with assert_none():
                    # Create a daemon thread leak
                    thread.start()
        finally:
            stop.set()
            thread.join()

        # Verify the exception contains the leaked thread
        assert hasattr(exc_info.value, "thread_leaks")
        assert thread in exc_info.value.thread_leaks
