from datetime import timedelta
from time import sleep
from unittest.mock import patch

import pytest

from sentry.relay.config.experimental import TimeChecker, TimeoutException, add_experimental_config


def test_time_checker_throws_on_timeout_hit():
    checker = TimeChecker(timedelta(seconds=1))
    sleep(1)
    with pytest.raises(TimeoutException):
        checker.check()


def test_time_checker_no_throw_on_timeout_no_hit():
    checker = TimeChecker(timedelta(seconds=5))
    checker.check()


@pytest.mark.parametrize("timeout", (-1, 0))
def test_time_checker_noop_on_invalid_timeout(timeout):
    checker = TimeChecker(timedelta(seconds=timeout))
    checker.check()


@patch("sentry.relay.config.experimental._FEATURE_BUILD_TIMEOUT", timedelta(seconds=1))
@patch("sentry.relay.config.experimental.logger.exception")
def test_add_experimental_config_catches_timeout(mock_logger):
    def dummy(timeout: TimeChecker, *args, **kwargs):
        sleep(1)
        timeout.check()

    add_experimental_config({}, "test-key", dummy, 1, 1)  # Does not raise

    # Assert logger message.
    # These many asserts is a workaround to exclude `elapsed` from the assertion
    assert mock_logger.call_args[0] == ("Project config feature build timed out: %s", "test-key")
    extra = mock_logger.call_args[1]["extra"]
    assert extra.pop("elapsed") > timedelta(seconds=1)
    assert extra == {"hard_timeout": timedelta(seconds=1)}
