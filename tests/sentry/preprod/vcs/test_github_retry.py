from unittest.mock import Mock, patch

import pytest

from sentry.preprod.vcs.github_retry import _is_retryable, github_api_call_with_retries
from sentry.shared_integrations.exceptions import (
    ApiConnectionResetError,
    ApiError,
    ApiRateLimitedError,
)


class TestIsRetryable:
    @pytest.mark.parametrize(
        "exc",
        [
            ApiRateLimitedError("rate limited"),
            ApiConnectionResetError("connection reset"),
            ApiError("server error", code=500),
            ApiError("bad gateway", code=502),
            ApiError("unavailable", code=503),
            ApiError("timeout", code=504),
            ApiError("rate limited", code=429),
            ConnectionError("reset"),
            TimeoutError("timed out"),
        ],
    )
    def test_retryable(self, exc):
        assert _is_retryable(exc) is True

    @pytest.mark.parametrize(
        "exc",
        [
            ApiError("not found", code=404),
            ApiError("bad request", code=400),
            ValueError("bad value"),
            FileNotFoundError("no file"),
            PermissionError("denied"),
        ],
    )
    def test_not_retryable(self, exc):
        assert _is_retryable(exc) is False


@patch("sentry.preprod.vcs.github_retry.time.sleep")
class TestGithubApiCallWithRetries:
    def test_success_on_first_attempt(self, mock_sleep):
        fn = Mock(return_value="ok")
        assert github_api_call_with_retries(fn) == "ok"
        fn.assert_called_once()
        mock_sleep.assert_not_called()

    def test_retries_then_succeeds(self, mock_sleep):
        fn = Mock(side_effect=[ApiError("err", code=500), "ok"])
        assert github_api_call_with_retries(fn) == "ok"
        assert fn.call_count == 2
        mock_sleep.assert_called_once_with(2)

    def test_exhausts_attempts_and_raises(self, mock_sleep):
        fn = Mock(side_effect=ApiError("err", code=500))
        with pytest.raises(ApiError):
            github_api_call_with_retries(fn)
        assert fn.call_count == 3
        assert mock_sleep.call_args_list == [((2,),), ((4,),)]

    def test_non_retryable_raises_immediately(self, mock_sleep):
        fn = Mock(side_effect=ApiError("not found", code=404))
        with pytest.raises(ApiError):
            github_api_call_with_retries(fn)
        fn.assert_called_once()
        mock_sleep.assert_not_called()

    def test_custom_max_attempts(self, mock_sleep):
        fn = Mock(side_effect=ConnectionError("reset"))
        with pytest.raises(ConnectionError):
            github_api_call_with_retries(fn, max_attempts=2)
        assert fn.call_count == 2
        mock_sleep.assert_called_once_with(2)
