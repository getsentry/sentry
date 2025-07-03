import logging
from unittest.mock import Mock, call, patch

from urllib3 import PoolManager
from urllib3.exceptions import ConnectTimeoutError
from urllib3.response import HTTPResponse

from sentry.net.retry import LoggedRetry


def test_logged_retry() -> None:
    mock_logger = Mock(spec=logging.Logger)

    pool = PoolManager(
        retries=LoggedRetry(mock_logger, total=2, backoff_factor=0, status_forcelist=[500]),
    )

    with patch(
        "urllib3.connectionpool.HTTPConnectionPool._make_request",
        side_effect=[
            ConnectTimeoutError(),
            HTTPResponse(status=500, body=b"not ok"),
            HTTPResponse(status=200, body=b"ok"),
        ],
    ):
        response = pool.request("GET", "http://example.com")

    assert mock_logger.info.call_count == 2
    mock_logger.assert_has_calls(
        [
            call.info(
                "Request retried",
                extra={
                    "request_method": "GET",
                    "request_url": "/",
                    "retry_total_remaining": 1,
                    "error": "ConnectTimeoutError",
                },
            ),
            call.info(
                "Request retried",
                extra={
                    "request_method": "GET",
                    "request_url": "/",
                    "retry_total_remaining": 0,
                    "response_status": 500,
                },
            ),
        ]
    )
    assert response.status == 200
    assert response.data == b"ok"
