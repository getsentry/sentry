from sentry.runner.commands.cleanup import _STOP_WORKER, multiprocess_worker, start_pool, stop_pool
from sentry.testutils.cases import TestCase


class TestCleanupMultiprocessing(TestCase):
    """Test the multiprocessing functionality in cleanup."""

    def test_starting_and_stopping_pool(self) -> None:
        """Test that starting and stopping the pool works."""
        pool, task_queue = start_pool(1)
        stop_pool(pool, task_queue)

    def test_worker_queue_empty_behavior(self) -> None:
        """Test worker behavior when queue becomes empty."""
        pool, task_queue = start_pool(1)

        # Only put stop signal
        task_queue.put(_STOP_WORKER)

        # Worker should exit cleanly
        multiprocess_worker(task_queue)
        stop_pool(pool, task_queue)
        # Queue should be empty and properly task_done() called
        assert task_queue.empty()
