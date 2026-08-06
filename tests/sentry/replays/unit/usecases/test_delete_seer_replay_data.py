import threading
from unittest.mock import MagicMock, Mock, patch

from sentry.replays.usecases.delete import (
    SEER_DELETE_ATTEMPTS,
    delete_seer_replay_data,
    delete_seer_replay_data_in_batches,
)


@patch("sentry.replays.usecases.delete.make_replay_delete_request")
def test_delete_seer_replay_data_success(mock_seer_request: MagicMock) -> None:
    """Test successful deletion of replay data from Seer."""
    mock_response = Mock()
    mock_response.status = 200
    mock_response.data = "Success"
    mock_seer_request.return_value = mock_response

    replay_ids = ["replay-1", "replay-2", "replay-3"]

    assert delete_seer_replay_data(456, 123, replay_ids) is True

    mock_seer_request.assert_called_once()
    body = mock_seer_request.call_args[0][0]
    assert body == {"replay_ids": replay_ids, "organization_id": 456, "project_id": 123}


@patch("sentry.replays.usecases.delete.make_replay_delete_request")
def test_delete_seer_replay_data_network_exception(mock_seer_request: MagicMock) -> None:
    """Test handling of network/timeout exceptions during Seer API call."""
    mock_seer_request.side_effect = Exception("Network timeout")
    assert delete_seer_replay_data(456, 123, ["replay-1", "replay-2"]) is False
    # Should be called once (retries happen at urllib3 level, invisible to application layer)
    assert mock_seer_request.call_count == 1


@patch("sentry.replays.usecases.delete.make_replay_delete_request")
def test_delete_seer_replay_data_non_200_status(mock_seer_request: MagicMock) -> None:
    """Test handling of non-200 status codes from Seer API."""
    for status in [400, 401, 403, 404, 500, 502, 503, 504]:
        mock_seer_request.reset_mock()
        mock_response = Mock()
        mock_response.status = status
        mock_response.data = "Internal Server Error"
        mock_seer_request.return_value = mock_response

        assert delete_seer_replay_data(456, 123, ["replay-1"]) is False
        mock_seer_request.assert_called_once()


@patch("sentry.replays.usecases.delete.delete_seer_replay_data")
def test_batches_are_split_at_the_batch_size(mock_delete: MagicMock) -> None:
    """Test ids are split into batches small enough to answer inside Seer's 5 second timeout."""
    mock_delete.return_value = True
    replay_ids = [f"replay-{i}" for i in range(250)]

    assert delete_seer_replay_data_in_batches(456, 123, replay_ids) is True

    sent = [call.args[2] for call in mock_delete.call_args_list]
    assert [len(batch) for batch in sorted(sent, key=len, reverse=True)] == [100, 100, 50]
    # Every id is sent exactly once.
    assert sorted(id for batch in sent for id in batch) == sorted(replay_ids)


@patch("sentry.replays.usecases.delete.delete_seer_replay_data")
def test_no_ids_is_a_no_op(mock_delete: MagicMock) -> None:
    assert delete_seer_replay_data_in_batches(456, 123, []) is True
    assert mock_delete.call_count == 0


@patch("sentry.replays.usecases.delete.time.sleep")
@patch("sentry.replays.usecases.delete.delete_seer_replay_data")
def test_a_batch_is_retried_until_it_succeeds(
    mock_delete: MagicMock, mock_sleep: MagicMock
) -> None:
    """Test a batch that fails and then succeeds is not reported as a failure.

    Seer failures here are timeouts, so the point of retrying is to out-wait a slow service.
    """
    mock_delete.side_effect = [False, False, True]

    assert delete_seer_replay_data_in_batches(456, 123, ["replay-1"]) is True
    assert mock_delete.call_count == 3


@patch("sentry.replays.usecases.delete.time.sleep")
@patch("sentry.replays.usecases.delete.delete_seer_replay_data")
def test_a_batch_that_never_succeeds_is_reported(
    mock_delete: MagicMock, mock_sleep: MagicMock
) -> None:
    """Test attempts are bounded and the caller is told the batch failed."""
    mock_delete.return_value = False

    assert delete_seer_replay_data_in_batches(456, 123, ["replay-1"]) is False
    assert mock_delete.call_count == SEER_DELETE_ATTEMPTS


@patch("sentry.replays.usecases.delete.time.sleep")
@patch("sentry.replays.usecases.delete.delete_seer_replay_data")
def test_one_failed_batch_does_not_hide_behind_the_others(
    mock_delete: MagicMock, mock_sleep: MagicMock
) -> None:
    """Test the result is False when any batch failed, and every batch is still attempted.

    `all()` over a generator would stop at the first failure and leave later batches unsent.
    """

    # The first batch fails every attempt; the rest succeed first time.
    def delete(organization_id: int, project_id: int, replay_ids: list[str]) -> bool:
        return "replay-0" not in replay_ids

    mock_delete.side_effect = delete
    replay_ids = [f"replay-{i}" for i in range(250)]

    assert delete_seer_replay_data_in_batches(456, 123, replay_ids) is False
    # 3 batches, and the failing one is attempted SEER_DELETE_ATTEMPTS times.
    assert mock_delete.call_count == 2 + SEER_DELETE_ATTEMPTS


@patch("sentry.replays.usecases.delete.delete_seer_replay_data")
def test_batches_are_sent_concurrently(mock_delete: MagicMock) -> None:
    """Test batches really do overlap rather than being sent one after another.

    The barrier only releases if all three batches are in flight at the same time, so a serial
    implementation fails here by timing out instead of passing quietly.
    """
    barrier = threading.Barrier(3, timeout=10)

    def delete(organization_id: int, project_id: int, replay_ids: list[str]) -> bool:
        barrier.wait()
        return True

    mock_delete.side_effect = delete

    assert delete_seer_replay_data_in_batches(456, 123, [f"replay-{i}" for i in range(250)]) is True
    assert mock_delete.call_count == 3
