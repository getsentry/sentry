from sentry.runner.commands.cleanup import _STOP_WORKER, _start_pool, _stop_pool
from sentry.testutils.cases import TestCase


class TestCleanupMultiprocessing(TestCase):
    """Test the multiprocessing functionality in cleanup."""

    def test_starting_and_stopping_pool(self) -> None:
        """Test that starting and stopping the pool works."""
        pool, task_queue = _start_pool(1)
        _stop_pool(pool, task_queue)

    def test_worker_queue_empty_behavior(self) -> None:
        """Test worker behavior when there are stop signals in the queue."""
        pool, task_queue = _start_pool(1)

        # Put a stop signal before calling stop_pool
        task_queue.put(_STOP_WORKER)

        # Let the pooled worker handle the stop signal and exit cleanly
        # stop_pool will put additional stop signals for each worker
        _stop_pool(pool, task_queue)

        # Verify all worker processes have terminated
        for process in pool:
            assert not process.is_alive()
