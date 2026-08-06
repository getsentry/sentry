from unittest.mock import MagicMock, Mock, patch

import pytest
from urllib3.exceptions import ReadTimeoutError

from sentry.replays.usecases.delete import (
    SEER_DELETE_RETRY,
    SeerDeleteFailed,
    delete_seer_replay_data,
    delete_seer_replay_data_or_raise,
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
    # Called once: the retrying lives in the `Retry` handed to `make_replay_delete_request`, which
    # this mock replaces wholesale. See `test_seer_delete_retry_actually_applies_to_this_request`
    # for the part that has to be asserted separately.
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


def test_seer_delete_retry_actually_applies_to_this_request() -> None:
    """Test the retry passed to Seer covers the failures Seer actually produces.

    urllib3's default `allowed_methods` excludes POST, so a `Retry` that does not say otherwise
    retries nothing here -- and the failure we see is a read timeout on a POST. Statuses have to be
    listed too, because a 503 is a response rather than an error.
    """
    # A read timeout is retried rather than re-raised, and one attempt is consumed.
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


@patch("sentry.replays.usecases.delete.delete_seer_replay_data")
def test_a_refused_delete_raises_rather_than_reporting_success(mock_delete: MagicMock) -> None:
    """Test exhaustion raises instead of quietly reporting a deletion that did not happen.

    A Seer summary is derived from the replay, so leaving one behind is leaving PII behind. The
    caller has to fail over it the same way it fails over an undeleted blob.
    """
    mock_delete.return_value = False

    with pytest.raises(SeerDeleteFailed):
        delete_seer_replay_data_or_raise(456, 123, ["replay-1"])

    # One call: the retrying happens inside the request, not around it.
    assert mock_delete.call_count == 1


@patch("sentry.replays.usecases.delete.delete_seer_replay_data")
def test_a_successful_delete_is_silent(mock_delete: MagicMock) -> None:
    mock_delete.return_value = True

    delete_seer_replay_data_or_raise(456, 123, ["replay-1"])
