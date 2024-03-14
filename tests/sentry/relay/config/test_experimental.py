from time import sleep
from unittest.mock import patch

import pytest

from sentry.relay.config.experimental import (
    BuildTimeChecker,
    TimeoutException,
    add_experimental_config,
)


def test_build_time_checker_throws_on_timeout_hit():
    checker = BuildTimeChecker(1)
    sleep(1)
    with pytest.raises(TimeoutException):
        checker.check()


def test_build_time_checker_no_throw_on_timeout_no_hit():
    checker = BuildTimeChecker(5)
    checker.check()


@pytest.mark.parametrize("timeout", (-1, 0))
def test_build_time_checker_no_throw_on_invalid_timeout(timeout):
    checker = BuildTimeChecker(timeout)
    checker.check()


@patch("sentry.relay.config.experimental._FEATURE_BUILD_TIMEOUT", 1)
@patch("sentry.relay.config.experimental.logger.exception")
def test_add_experimental_config_catches_timeout(mock_logger):
    def dummy(timeout: BuildTimeChecker, *args, **kwargs):
        sleep(1)
        timeout.check()

    add_experimental_config({}, "test-key", dummy, 1, 1)  # Does not raise

    # Assert logger message.
    # These many asserts is a workaround to exclude `elapsed` from the assertion
    assert mock_logger.call_args[0][0] == "Project config feature build timed out: test-key"
    extra = mock_logger.call_args[1]["extra"]
    assert extra.pop("elapsed") > 0
    assert extra == {"hard_timeout": 1}
