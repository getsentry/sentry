from unittest.mock import MagicMock, Mock, patch

from sentry.replays.usecases.delete import delete_seer_replay_data
from sentry.utils import json


@patch("sentry.replays.usecases.delete.make_signed_seer_api_request")
def test_delete_seer_replay_data_success(mock_make_seer_api_request: MagicMock) -> None:
    """Test successful deletion of replay data from Seer."""
    mock_response = Mock()
    mock_response.status = 200
    mock_response.data = "Success"
    mock_make_seer_api_request.return_value = mock_response

    replay_ids = ["replay-1", "replay-2", "replay-3"]

    assert delete_seer_replay_data(456, 123, replay_ids) is True

    mock_make_seer_api_request.assert_called_once()
    call_args = mock_make_seer_api_request.call_args
    assert call_args[1]["path"] == "/v1/automation/summarize/replay/breadcrumbs/delete"

    request_body = json.loads(call_args[1]["body"].decode("utf-8"))
    assert request_body == {"replay_ids": replay_ids, "organization_id": 456, "project_id": 123}


@patch("sentry.replays.usecases.delete.make_signed_seer_api_request")
def test_delete_seer_replay_data_network_exception(mock_make_seer_api_request: MagicMock) -> None:
    """Test handling of network/timeout exceptions during Seer API call."""
    mock_make_seer_api_request.side_effect = Exception("Network timeout")
    assert delete_seer_replay_data(456, 123, ["replay-1", "replay-2"]) is False
    # Should be called once (retries happen at urllib3 level, invisible to application layer)
    assert mock_make_seer_api_request.call_count == 1


@patch("sentry.replays.usecases.delete.make_signed_seer_api_request")
def test_delete_seer_replay_data_non_200_status(mock_make_seer_api_request: MagicMock) -> None:
    """Test handling of non-200 status codes from Seer API."""
    for status in [400, 401, 403, 404, 500, 502, 503, 504]:
        mock_make_seer_api_request.reset_mock()
        mock_response = Mock()
        mock_response.status = status
        mock_response.data = "Internal Server Error"
        mock_make_seer_api_request.return_value = mock_response

        assert delete_seer_replay_data(456, 123, ["replay-1"]) is False
        mock_make_seer_api_request.assert_called_once()
