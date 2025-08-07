"""Integration tests for thread leak assertion utilities."""

from threading import Event, Thread

import pytest

from sentry.testutils.thread_leaks.assertion import ThreadLeakAssertionError, assert_none


def norm(stack_diff: object):
    """remove some meaningless uniqueness from the output."""
    import re

    stack_diff = str(stack_diff).replace("# noqa", "")
    return re.sub("[0-9]+", "$N", stack_diff)


class TestAssertNoneIntegration:
    def test_no_leaks_passes_cleanly(self):
        """Test that clean code passes without issues."""
        with assert_none(strict=True):
            pass  # No threads created
        # Should not raise

    def test_thread_leak_strict_mode_raises(self):
        """Test that thread leaks raise in strict mode."""
        stop = Event()
        thread = Thread(target=stop.wait, daemon=True)
        try:
            with pytest.raises(ThreadLeakAssertionError) as exc_info:
                with assert_none(strict=True):
                    # Create a daemon thread that won't block test completion
                    thread.start()
        finally:
            stop.set()
            thread.join()

        # Verify the error message contains useful debugging info
        assert norm(exc_info.value) == norm(
            """
  <Thread(Thread-1 (run_server), started daemon 6107525120)>@pytest_rerunfailures.ServerStatusDB.run_server
  # noqa
+ <Thread(Thread-2 (wait), started daemon 6124351488)>@threading.Event.wait
+     File "./tests/sentry/testutils/thread_leaks/test_assertion.py", line 26, in test_thread_leak_strict_mode_raises
+       thread = Thread(target=stop.wait, daemon=True)
+ # noqa
  <_MainThread(MainThread, started 8767659776)>@None
  # noqa
"""
        )

    def test_thread_that_exits_during_context_passes(self):
        """Test that threads which complete and exit don't trigger assertion error."""
        with assert_none(strict=True):
            # Create and start a thread that will complete quickly
            thread = Thread(target=lambda: None, daemon=True)
            thread.start()
            # Wait for thread to complete before context exits
            thread.join(timeout=1.0)
        # Should not raise - thread completed and is no longer active
