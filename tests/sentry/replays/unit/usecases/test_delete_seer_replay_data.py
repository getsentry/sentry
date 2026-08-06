from unittest.mock import MagicMock, Mock, patch

import pytest
from urllib3.exceptions import ReadTimeoutError

from sentry.replays.usecases.delete import (
    SEER_DELETE_RETRY,
    SeerDeleteFailed,
    delete_seer_replay_data,
)


@patch("sentry.replays.usecases.delete.make_replay_delete_request")
def test_delete_seer_replay_data_success(mock_seer_request: MagicMock) -> None:
    """Test a successful deletion sends the ids and returns quietly."""
    mock_response = Mock()
    mock_response.status = 200
    mock_seer_request.return_value = mock_response

    replay_ids = ["replay-1", "replay-2", "replay-3"]
    delete_seer_replay_data(456, 123, replay_ids)

    mock_seer_request.assert_called_once()
    assert mock_seer_request.call_args[0][0] == {
        "replay_ids": replay_ids,
        "organization_id": 456,
        "project_id": 123,
    }


@patch("sentry.replays.usecases.delete.make_replay_delete_request")
def test_a_transport_failure_propagates(mock_seer_request: MagicMock) -> None:
    """Test a network failure is not swallowed.

    It used to be caught and reported as False, which every caller then ignored, so a Seer outage
    looked like a completed deletion.
    """
    mock_seer_request.side_effect = OSError("network is down")

    with pytest.raises(OSError):
        delete_seer_replay_data(456, 123, ["replay-1"])


@patch("sentry.replays.usecases.delete.make_replay_delete_request")
def test_a_refused_delete_raises(mock_seer_request: MagicMock) -> None:
    """Test a non-2xx response raises rather than reporting a deletion that did not happen.

    A summary is derived from the replay, so leaving one behind leaves PII behind.
    """
    for status in (400, 401, 403, 404, 500, 502, 503):
        mock_seer_request.reset_mock()
        mock_response = Mock()
        mock_response.status = status
        mock_seer_request.return_value = mock_response

        with pytest.raises(SeerDeleteFailed):
            delete_seer_replay_data(456, 123, ["replay-1"])


def test_the_retry_applies_to_this_request() -> None:
    """Test the retry covers the failures Seer actually produces.

    urllib3's default `allowed_methods` excludes POST, so a `Retry` that does not say otherwise
    retries nothing here -- and the failure we see is a read timeout on a POST. Statuses have to be
    listed too, because a 503 is a response rather than an error.
    """
    assert (
        SEER_DELETE_RETRY.increment(
            method="POST", url="/delete", error=ReadTimeoutError(None, "/delete", "timed out")
        ).total
        == SEER_DELETE_RETRY.total - 1
    )

    assert SEER_DELETE_RETRY.is_retry("POST", 429)
    assert SEER_DELETE_RETRY.is_retry("POST", 503)
    # A bad request will not improve; retrying it only burns the timeout budget.
    assert not SEER_DELETE_RETRY.is_retry("POST", 400)
