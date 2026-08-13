from __future__ import annotations

from concurrent.futures import Future
from unittest.mock import MagicMock, patch
from uuid import uuid4

from sentry.replays.tasks import delete_replays_script_async
from sentry.replays.usecases.delete import DELETE_THREAD_POOL_SIZE
from sentry.taskworker.namespaces import replays_long_tasks
from sentry.testutils.cases import TestCase


class TestDeleteReplaysScriptAsync(TestCase):
    @patch("sentry.replays.usecases.delete._delete_if_exists")
    def test_deletes_inclusive_of_top_segment(self, mock_delete: object) -> None:
        replay_id = uuid4().hex

        with patch("sentry.replays.tasks.make_recording_filename", side_effect=lambda s: str(s)):
            delete_replays_script_async(
                retention_days=90,
                project_id=self.project.id,
                replay_id=replay_id,
                max_segment_id=3,
            )

        # Segments 0, 1, 2, and 3 must all be scheduled for deletion. An exclusive range would
        # leave segment 3 (the top segment) behind.
        assert mock_delete.call_count == 4  # type: ignore[attr-defined]

    @patch("sentry.replays.usecases.delete._delete_if_exists")
    def test_null_max_segment_id_is_a_no_op(self, mock_delete: object) -> None:
        replay_id = uuid4().hex

        delete_replays_script_async(
            retention_days=90,
            project_id=self.project.id,
            replay_id=replay_id,
            max_segment_id=None,
        )

        assert mock_delete.call_count == 0  # type: ignore[attr-defined]

    def test_registered_on_long_pool_with_alias(self) -> None:
        name = "sentry.replays.tasks.delete_recording_async"
        assert replays_long_tasks.contains(name)

    @patch("sentry.replays.usecases.delete.storage_kv")
    def test_storage_client_is_warmed_once_per_task(self, mock_storage_kv: object) -> None:
        replay_id = uuid4().hex

        with patch("sentry.replays.tasks.make_recording_filename", side_effect=lambda s: str(s)):
            delete_replays_script_async(
                retention_days=90,
                project_id=self.project.id,
                replay_id=replay_id,
                max_segment_id=3,
            )

        # The client is warmed exactly once, before the fan-out, not once per
        # segment. The four segments are still each deleted through the shared client.
        assert mock_storage_kv.initialize_client.call_count == 1  # type: ignore[attr-defined]
        assert mock_storage_kv.delete.call_count == 4  # type: ignore[attr-defined]

    @patch("sentry.replays.usecases.delete._delete_if_exists")
    @patch("sentry.replays.usecases.delete.ContextPropagatingThreadPoolExecutor")
    def test_thread_pool_is_bounded_by_segment_count(
        self, mock_pool: MagicMock, mock_delete: object
    ) -> None:
        # A single-segment replay must not open the full pool.
        _stub_pool_futures(mock_pool)
        replay_id = uuid4().hex

        with patch("sentry.replays.tasks.make_recording_filename", side_effect=lambda s: str(s)):
            delete_replays_script_async(
                retention_days=90,
                project_id=self.project.id,
                replay_id=replay_id,
                max_segment_id=0,
            )

        mock_pool.assert_called_once_with(max_workers=1)

    @patch("sentry.replays.usecases.delete._delete_if_exists")
    @patch("sentry.replays.usecases.delete.ContextPropagatingThreadPoolExecutor")
    def test_thread_pool_is_capped_at_the_max(
        self, mock_pool: MagicMock, mock_delete: object
    ) -> None:
        # A replay with more segments than the cap opens at most N threads.
        _stub_pool_futures(mock_pool)
        replay_id = uuid4().hex

        with patch("sentry.replays.tasks.make_recording_filename", side_effect=lambda s: str(s)):
            delete_replays_script_async(
                retention_days=90,
                project_id=self.project.id,
                replay_id=replay_id,
                max_segment_id=DELETE_THREAD_POOL_SIZE + 50,
            )

        mock_pool.assert_called_once_with(max_workers=DELETE_THREAD_POOL_SIZE)


def _stub_pool_futures(mock_pool: MagicMock) -> None:
    """Make the patched executor hand back the futures a real pool would.

    `submit` on a bare MagicMock returns another MagicMock, whose `exception()` is a MagicMock rather
    than None -- so the caller reads every delete as failed and tries to raise a mock. These two tests
    only care about `max_workers`, but the double still has to honour the contract around it.
    """

    def submit(function: object, argument: object) -> Future[None]:
        future: Future[None] = Future()
        future.set_result(None)
        return future

    mock_pool.return_value.__enter__.return_value.submit.side_effect = submit
